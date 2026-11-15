import 'server-only'
import { verifyInitData } from './telegram/verify'

export interface PlayerIdentity {
  id: string
  displayName: string
  username: string | null
  source: 'telegram' | 'guest'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function sanitizeName(raw: string | null | undefined, fallback: string) {
  const cleaned = (raw ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20)
  return cleaned || fallback
}

/**
 * Telegram users are identified by verified initData. Browser players fall back to a
 * random guest UUID that is never exposed publicly (leaderboards only return names).
 */
export function resolveIdentity(headers: Headers): PlayerIdentity | null {
  const initData = headers.get('x-tg-init-data')
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (initData && token) {
    const user = verifyInitData(initData, token)
    if (user) {
      const full = [user.first_name, user.last_name].filter(Boolean).join(' ')
      return {
        id: `tg:${user.id}`,
        displayName: sanitizeName(full || user.username, `Pilot ${String(user.id).slice(-4)}`),
        username: user.username ?? null,
        source: 'telegram',
      }
    }
  }

  const guestId = headers.get('x-guest-id')
  if (guestId && UUID_RE.test(guestId)) {
    let name: string | null = null
    try {
      name = decodeURIComponent(headers.get('x-guest-name') ?? '')
    } catch {
      name = null
    }
    return {
      id: `guest:${guestId.toLowerCase()}`,
      displayName: sanitizeName(name, `Runner ${guestId.slice(0, 4).toUpperCase()}`),
      username: null,
      source: 'guest',
    }
  }
  return null
}
