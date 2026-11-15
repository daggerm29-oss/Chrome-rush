import { after, NextResponse } from 'next/server'
import { resolveIdentity } from '@/lib/identity'
import { announcePlaying, resolveRegisteredGroup } from '@/lib/telegram/notify'

export async function POST(req: Request) {
  const identity = resolveIdentity(req.headers)
  if (!identity || identity.source !== 'telegram' || !identity.groupChatId) {
    return NextResponse.json({ announced: false })
  }

  const chatId = await resolveRegisteredGroup(identity.groupChatId)
  if (!chatId) return NextResponse.json({ announced: false })

  after(async () => {
    try {
      await announcePlaying(identity, chatId)
    } catch (error) {
      console.error('[telegram] playing notice failed', error)
    }
  })
  return NextResponse.json({ announced: true })
}
