import { NextResponse } from 'next/server'
import { resolveIdentity } from '@/lib/identity'
import { getPlayerStats } from '@/lib/leaderboard'

export async function GET(req: Request) {
  const identity = resolveIdentity(req.headers)
  if (!identity) return NextResponse.json({ identity: null, stats: null })
  const stats = await getPlayerStats(identity.id)
  return NextResponse.json(
    { identity: { displayName: identity.displayName, source: identity.source }, stats },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
