import 'server-only'
import { verifyInitDataFull } from './telegram/verify'

export interface PlayerIdentity {
  id: string
  displayName: string
  username: string | null
  source: 'telegram' | 'guest'
  /** Group the Mini App was opened from (from the signed start_param); unverified until checked against tg_groups. */
  groupChatId: string | null
}

/** Group deep links carry the chat id as `g<digits>` with a leading `n` standing in for the minus sign. */
export function groupParam(chatId: number | string) {
  return `g${String(chatId).replace('-', 'n')}`
}

function parseGroupParam(param: string | null): string | null {
  const match = param?.match(/^g(n?)(\d{5,16})$/)
  return match ? `${match[1] ? '-' : ''}${match[2]}` : null
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
  if (initData) {
    // Never fall back to a guest identity when Telegram data is present but invalid or expired;
    // that would silently credit the run to a different account.
    const verified = token ? verifyInitDataFull(initData, token) : null
    if (!verified) return null
    const { user, startParam } = verified
    const full = [user.first_name, user.last_name].filter(Boolean).join(' ')
    return {
      id: `tg:${user.id}`,
      displayName: sanitizeName(full || user.username, `Player ${String(user.id).slice(-4)}`),
      username: user.username ?? null,
      source: 'telegram',
      groupChatId: parseGroupParam(startParam),
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
      groupChatId: null,
    }
  }
  return null
}
