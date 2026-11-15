import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { getLeaderboard, getPlayerStats } from '@/lib/leaderboard'
import { escapeHtml, playKeyboard, registerGroup, tgCall } from '@/lib/telegram/notify'

interface TgMessage {
  message_id: number
  chat: { id: number; type: string; title?: string }
  from?: { id: number; first_name: string; username?: string }
  text?: string
}

interface TgUpdate {
  update_id: number
  message?: TgMessage
}

const fmt = (n: number) => n.toLocaleString('en-US')

function keyboardFor(req: Request, chat: TgMessage['chat']) {
  if (chat.type === 'private') {
    const url = process.env.TELEGRAM_WEB_APP_URL ?? new URL('/', req.url).toString()
    return { inline_keyboard: [[{ text: 'Play Chroma Rush', web_app: { url } }]] }
  }
  // web_app buttons only work in private chats; groups get a deep link that records which group the run came from.
  return playKeyboard(chat.id)
}

export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return NextResponse.json({ ok: false }, { status: 503 })
  const got = req.headers.get('x-telegram-bot-api-secret-token') ?? ''
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let update: TgUpdate
  try {
    update = (await req.json()) as TgUpdate
  } catch {
    return NextResponse.json({ ok: true })
  }

  const msg = update.message
  const text = msg?.text?.trim() ?? ''
  if (!msg || !text.startsWith('/')) return NextResponse.json({ ok: true })

  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase()
  const chatId = msg.chat.id
  const reply_markup = keyboardFor(req, msg.chat)

  try {
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      await registerGroup(chatId, msg.chat.title)
    }

    switch (command) {
      case '/start':
      case '/playchroma':
        await tgCall('sendMessage', {
          chat_id: chatId,
          parse_mode: 'HTML',
          text:
            '<b>Chroma Rush</b>\nRun across floating worlds, switch between <b>Solar</b> and <b>Ion</b> phases, and never touch the wrong colour.\n\nYou have 3 lives per run. How far can you go?',
          reply_markup,
        })
        break
      case '/stats': {
        const stats = msg.from ? await getPlayerStats(`tg:${msg.from.id}`) : null
        await tgCall('sendMessage', {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: stats
            ? `<b>${escapeHtml(stats.displayName)}</b>\nBest score: <b>${fmt(stats.bestScore)}</b>\nBest distance: ${fmt(stats.bestDistance)} m\nGames played: ${stats.totalGames}\nCrystals collected: ${fmt(stats.totalCrystals)}\nGlobal rank: ${stats.rank ? `#${stats.rank}` : 'unranked'}`
            : 'No runs yet. Tap below to play your first run.',
          reply_markup,
        })
        break
      }
      case '/topplayers': {
        const { entries } = await getLeaderboard('all', null, 10)
        const lines = entries.length
          ? entries.map((e) => `${e.rank}. ${escapeHtml(e.name)} - <b>${fmt(e.score)}</b> (${fmt(e.distance)} m)`).join('\n')
          : 'No scores yet. Be the first!'
        await tgCall('sendMessage', { chat_id: chatId, parse_mode: 'HTML', text: `<b>Top Players</b>\n${lines}`, reply_markup })
        break
      }
      case '/help':
        await tgCall('sendMessage', {
          chat_id: chatId,
          text: 'Commands:\n/playchroma - open the game\n/topplayers - global top 10\n/stats - your stats\n/help - this message\n\nControls: tap JUMP (tap again mid-air to double jump), tap SWITCH to change colour.',
          reply_markup,
        })
        break
    }
  } catch (error) {
    console.error('[telegram] webhook handling failed', error)
  }

  return NextResponse.json({ ok: true })
}
