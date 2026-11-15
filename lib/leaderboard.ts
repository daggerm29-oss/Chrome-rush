import 'server-only'
import { desc, eq, gt, sql } from 'drizzle-orm'
import { db, schema } from './db'
import type { PlayerIdentity } from './identity'

export type Period = 'all' | 'daily'

export interface LeaderboardEntry {
  rank: number
  name: string
  score: number
  distance: number
  isMe: boolean
}

export interface PlayerStats {
  displayName: string
  bestScore: number
  bestDistance: number
  bestTimeMs: number
  totalGames: number
  totalCrystals: number
  totalDistance: number
  rank: number | null
}

const { players, gameRuns } = schema

export async function getLeaderboard(period: Period, me: PlayerIdentity | null, limit = 50) {
  if (period === 'all') {
    const rows = await db
      .select({ id: players.id, name: players.displayName, score: players.bestScore, distance: players.bestDistance })
      .from(players)
      .where(gt(players.bestScore, 0))
      .orderBy(desc(players.bestScore), players.createdAt)
      .limit(limit)
    const entries: LeaderboardEntry[] = rows.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      score: r.score,
      distance: r.distance,
      isMe: me?.id === r.id,
    }))
    let mine: LeaderboardEntry | null = entries.find((e) => e.isMe) ?? null
    if (!mine && me) {
      const [row] = await db.select().from(players).where(eq(players.id, me.id)).limit(1)
      if (row && row.bestScore > 0) {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(players)
          .where(gt(players.bestScore, row.bestScore))
        mine = { rank: count + 1, name: row.displayName, score: row.bestScore, distance: row.bestDistance, isMe: true }
      }
    }
    return { entries, me: mine }
  }

  const daily = await db.execute<{ player_id: string; name: string; score: number; distance: number }>(sql`
    with best as (
      select player_id, max(score)::int as score, max(distance)::int as distance
      from ${gameRuns}
      where valid and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
      group by player_id
    )
    select b.player_id, p.display_name as name, b.score, b.distance
    from best b join ${players} p on p.id = b.player_id
    order by b.score desc
  `)
  const all = daily.rows.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    score: Number(r.score),
    distance: Number(r.distance),
    isMe: me?.id === r.player_id,
  }))
  return { entries: all.slice(0, limit), me: all.find((e) => e.isMe) ?? null }
}

export async function getPlayerStats(id: string): Promise<PlayerStats | null> {
  const [row] = await db.select().from(players).where(eq(players.id, id)).limit(1)
  if (!row) return null
  let rank: number | null = null
  if (row.bestScore > 0) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(players)
      .where(gt(players.bestScore, row.bestScore))
    rank = count + 1
  }
  return {
    displayName: row.displayName,
    bestScore: row.bestScore,
    bestDistance: row.bestDistance,
    bestTimeMs: row.bestTimeMs,
    totalGames: row.totalGames,
    totalCrystals: row.totalCrystals,
    totalDistance: row.totalDistance,
    rank,
  }
}
