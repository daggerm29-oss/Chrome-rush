import { NextResponse } from 'next/server'
import { resolveIdentity } from '@/lib/identity'
import { getLeaderboard, type Period } from '@/lib/leaderboard'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const period: Period = url.searchParams.get('period') === 'daily' ? 'daily' : 'all'
  const identity = resolveIdentity(req.headers)
  const data = await getLeaderboard(period, identity)
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
