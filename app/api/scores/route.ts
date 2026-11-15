import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { resolveIdentity } from '@/lib/identity'
import { getPlayerStats } from '@/lib/leaderboard'

const RunSchema = z.object({
  runId: z.string().uuid(),
  score: z.number().int().min(0).max(50_000_000),
  distance: z.number().int().min(0).max(1_000_000),
  crystals: z.number().int().min(0).max(200_000),
  durationMs: z.number().int().min(0).max(1000 * 60 * 60 * 4),
  seed: z.number().int().min(0).max(2 ** 31),
  livesUsed: z.number().int().min(0).max(3),
  maxCombo: z.number().int().min(0).max(100_000).optional(),
})

const MAX_SPEED = 24.5

/** Plausibility checks derived from the game's physics and scoring rules. */
function isPlausible(run: z.infer<typeof RunSchema>) {
  const seconds = run.durationMs / 1000
  if (run.distance > 30 && seconds < 2) return false
  if (run.distance > seconds * MAX_SPEED * 1.08 + 40) return false
  if (run.crystals > run.distance * 0.9 + 60) return false
  const maxScore = run.distance * 10 + (run.distance / 8) * 300 + run.crystals * 450 + 10_000
  if (run.score > maxScore) return false
  return true
}

export async function POST(req: Request) {
  const identity = resolveIdentity(req.headers)
  if (!identity) return NextResponse.json({ error: 'Unknown player' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = RunSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid run' }, { status: 400 })
  const run = parsed.data
  const valid = isPlausible(run)

  const previous = await getPlayerStats(identity.id)

  const inserted = await db
    .insert(schema.gameRuns)
    .values({
      id: run.runId,
      playerId: identity.id,
      score: run.score,
      distance: run.distance,
      crystals: run.crystals,
      durationMs: run.durationMs,
      seed: run.seed,
      livesUsed: run.livesUsed,
      valid,
    })
    .onConflictDoNothing()
    .returning({ id: schema.gameRuns.id })

  if (inserted.length === 0) return NextResponse.json({ error: 'Run already submitted' }, { status: 409 })

  const best = valid ? run.score : 0
  const bestDistance = valid ? run.distance : 0
  const bestTime = valid ? run.durationMs : 0

  await db
    .insert(schema.players)
    .values({
      id: identity.id,
      displayName: identity.displayName,
      username: identity.username,
      source: identity.source,
      bestScore: best,
      bestDistance,
      bestTimeMs: bestTime,
      totalGames: 1,
      totalCrystals: valid ? run.crystals : 0,
      totalDistance: valid ? run.distance : 0,
    })
    .onConflictDoUpdate({
      target: schema.players.id,
      set: {
        displayName: identity.displayName,
        username: identity.username,
        bestScore: sql`greatest(${schema.players.bestScore}, ${best})`,
        bestDistance: sql`greatest(${schema.players.bestDistance}, ${bestDistance})`,
        bestTimeMs: sql`greatest(${schema.players.bestTimeMs}, ${bestTime})`,
        totalGames: sql`${schema.players.totalGames} + 1`,
        totalCrystals: sql`${schema.players.totalCrystals} + ${valid ? run.crystals : 0}`,
        totalDistance: sql`${schema.players.totalDistance} + ${valid ? run.distance : 0}`,
        lastActive: sql`now()`,
      },
    })

  const stats = await getPlayerStats(identity.id)
  return NextResponse.json({
    accepted: valid,
    isNewBest: valid && run.score > (previous?.bestScore ?? 0),
    stats,
  })
}
