import 'server-only'
import crypto from 'node:crypto'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

/**
 * Validates Telegram Mini App initData per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(initData: string, botToken: string, maxAgeSeconds = 60 * 60 * 24): TelegramUser | null {
  return verifyInitDataFull(initData, botToken, maxAgeSeconds)?.user ?? null
}

export function verifyInitDataFull(
  initData: string,
  botToken: string,
  maxAgeSeconds = 60 * 60 * 24,
): { user: TelegramUser; startParam: string | null } | null {
  if (!initData || !botToken) return null
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  if (!crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'))) return null

  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > maxAgeSeconds) return null

  try {
    const user = JSON.parse(params.get('user') ?? 'null') as TelegramUser | null
    if (!user || typeof user.id !== 'number') return null
    return { user, startParam: params.get('start_param') }
  } catch {
    return null
  }
}
