import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { getLeaderboard, getPlayerStats } from '@/lib/leaderboard'

interface TgMessage {
  message_id: number
  chat: { id: number; type: string }
  from?: { id: number; first_name: string; username?: string }
  text?: string
}

interface TgUpdate {
  update_id: number
  message?: TgMessage
}

function appUrl(req: Request) {
  return process.env.TELEGRAM_WEB_APP_URL ?? new URL('/', req.url).toString()
}

async function tg(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

function playButton(req: Request, chatType: string) {
  const url = appUrl(req)
  const botUsername = process.env.TELEGRAM_BOT_USERNAME
  // web_app buttons only work in private chats; groups get a deep link to the Mini App.
  if (chatType === 'private') return { text: 'Play Chroma Rush', web_app: { url } }
  return { text: 'Play Chroma Rush', url: botUsername ? `https://t.me/${botUsername}?startapp=play` : url }
}

const escape = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!)

export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expected) {
    const got = req.headers.get('x-telegram-bot-api-secret-token') ?? ''
    const a = Buffer.from(got)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }
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
  const keyboard = { inline_keyboard: [[playButton(req, msg.chat.type)]] }

  try {
    switch (command) {
      case '/start':
      case '/play':
        await tg('sendMessage', {
          chat_id: chatId,
          parse_mode: 'HTML',
          text:
            '<b>Chroma Rush</b>\nRun across floating worlds, switch between <b>Solar</b> and <b>Ion</b> phases, and never touch the wrong colour.\n\nYou have 3 lives per run. How far can you go?',
          reply_markup: keyboard,
        })
        break
      case '/stats': {
        const stats = msg.from ? await getPlayerStats(`tg:${msg.from.id}`) : null
        await tg('sendMessage', {
          chat_id: chatId,
          parse_mode: 'HTML',
          text: stats
            ? `<b>${escape(stats.displayName)}</b>\nBest score: <b>${stats.bestScore.toLocaleString('en-US')}</b>\nBest distance: ${stats.bestDistance.toLocaleString('en-US')} m\nGames played: ${stats.totalGames}\nCrystals collected: ${stats.totalCrystals.toLocaleString('en-US')}\nGlobal rank: ${stats.rank ? `#${stats.rank}` : 'unranked'}`
            : 'No runs yet. Tap below to play your first run.',
          reply_markup: keyboard,
        })
        break
      }
      case '/leaderboard':
      case '/top': {
        const { entries } = await getLeaderboard('all', null, 10)
        const lines = entries.length
          ? entries.map((e) => `${e.rank}. ${escape(e.name)} - <b>${e.score.toLocaleString('en-US')}</b> (${e.distance.toLocaleString('en-US')} m)`).join('\n')
          : 'No scores yet. Be the first!'
        await tg('sendMessage', { chat_id: chatId, parse_mode: 'HTML', text: `<b>Global Top 10</b>\n${lines}`, reply_markup: keyboard })
        break
      }
      case '/help':
        await tg('sendMessage', {
          chat_id: chatId,
          text: 'Commands:\n/play - open the game\n/stats - your stats\n/leaderboard - global top 10\n/help - this message\n\nControls: tap JUMP (tap again mid-air to double jump), tap SWITCH to change colour.',
          reply_markup: keyboard,
        })
        break
    }
  } catch (error) {
    console.error('[telegram] webhook handling failed', error)
  }

  return NextResponse.json({ ok: true })
}
