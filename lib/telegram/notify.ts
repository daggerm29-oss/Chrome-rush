import 'server-only'
import { desc, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { groupParam, type PlayerIdentity } from '@/lib/identity'

const PLAY_NOTICE_COOLDOWN_MINUTES = 30
const MAX_BROADCAST_GROUPS = 100

export const escapeHtml = (s: string) =>
  s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!)

export async function tgCall(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch (error) {
    console.error('[telegram] api call failed', method, error)
    return false
  }
}

/** Links to the Mini App; group links carry the chat id so runs can be attributed to that group. */
export function miniAppLink(groupChatId?: string | number | null) {
  const bot = process.env.TELEGRAM_BOT_USERNAME
  const shortName = process.env.NEXT_PUBLIC_TELEGRAM_APP_SHORT_NAME
  if (!bot) return process.env.TELEGRAM_WEB_APP_URL ?? ''
  const base = shortName ? `https://t.me/${bot}/${shortName}` : `https://t.me/${bot}`
  const param = groupChatId ? groupParam(groupChatId) : 'play'
  return `${base}?startapp=${param}`
}

export function playKeyboard(groupChatId: string | number) {
  return { inline_keyboard: [[{ text: 'Play Chroma Rush', url: miniAppLink(groupChatId) }]] }
}

function mention(player: { id: string; displayName: string }) {
  const name = escapeHtml(player.displayName)
  const telegramId = player.id.startsWith('tg:') ? player.id.slice(3) : null
  return telegramId ? `<a href="tg://user?id=${telegramId}">${name}</a>` : `<b>${name}</b>`
}

const fmt = (n: number) => n.toLocaleString('en-US')

export async function registerGroup(chatId: number | string, title: string | undefined) {
  await db
    .insert(schema.tgGroups)
    .values({ chatId: String(chatId), title: title ?? null })
    .onConflictDoUpdate({ target: schema.tgGroups.chatId, set: { title: title ?? null } })
}

/** Only groups where the bot has seen a command are trusted as announcement targets. */
export async function resolveRegisteredGroup(chatId: string | null) {
  if (!chatId) return null
  const [row] = await db.select({ id: schema.tgGroups.chatId }).from(schema.tgGroups).where(eq(schema.tgGroups.chatId, chatId))
  return row?.id ?? null
}

export async function announcePlaying(player: PlayerIdentity, chatId: string) {
  const claimed = await db.execute(sql`
    insert into tg_play_notices (chat_id, player_id, notified_at)
    values (${chatId}, ${player.id}, now())
    on conflict (chat_id, player_id) do update set notified_at = now()
    where tg_play_notices.notified_at < now() - make_interval(mins => ${PLAY_NOTICE_COOLDOWN_MINUTES})
    returning chat_id
  `)
  if (claimed.rows.length === 0) return false

  return tgCall('sendMessage', {
    chat_id: chatId,
    parse_mode: 'HTML',
    text: `${mention(player)} is playing Chroma Rush...`,
    reply_markup: playKeyboard(chatId),
    disable_notification: true,
  })
}

export interface RecordContext {
  player: PlayerIdentity
  score: number
  distance: number
  groupChatId: string | null
  previousGlobal: { name: string; score: number } | null
  previousGroupBest: number
}

export async function announceRecords(ctx: RecordContext) {
  const { player, score, distance, groupChatId, previousGlobal, previousGroupBest } = ctx
  const isGlobalRecord = score > (previousGlobal?.score ?? 0)
  const isGroupRecord = !!groupChatId && score > previousGroupBest

  if (isGlobalRecord) {
    const beaten = previousGlobal ? ` The previous record was ${fmt(previousGlobal.score)} by ${escapeHtml(previousGlobal.name)}.` : ''
    const text = `New world record! ${mention(player)} scored <b>${fmt(score)}</b> (${fmt(distance)} m).${beaten}`
    const groups = await db
      .select({ id: schema.tgGroups.chatId })
      .from(schema.tgGroups)
      .orderBy(desc(schema.tgGroups.createdAt))
      .limit(MAX_BROADCAST_GROUPS)
    await Promise.all(
      groups.map((g) => tgCall('sendMessage', { chat_id: g.id, parse_mode: 'HTML', text, reply_markup: playKeyboard(g.id) })),
    )
    return
  }

  if (isGroupRecord && groupChatId) {
    const text =
      previousGroupBest > 0
        ? `${mention(player)} just set a new group record: <b>${fmt(score)}</b> (previous best ${fmt(previousGroupBest)}).`
        : `${mention(player)} set the first score in this group: <b>${fmt(score)}</b>.`
    await tgCall('sendMessage', { chat_id: groupChatId, parse_mode: 'HTML', text, reply_markup: playKeyboard(groupChatId) })
  }
}
