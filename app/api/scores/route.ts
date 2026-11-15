import { desc, sql } from 'drizzle-orm'
import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, schema } from '@/lib/db'
import { PHYSICS } from '@/lib/game/difficulty'
import { resolveIdentity } from '@/lib/identity'
import { getPlayerStats } from '@/lib/leaderboard'
import { announceRecords, resolveRegisteredGroup } from '@/lib/telegram/notify'

const MAX_RUN_MS = 1000 * 60 * 90
const MAX_RUNS_PER_MINUTE = 12

const RunSchema = z.object({
  runId: z.string().uuid(),
  score: z.number().int().min(0).max(50_000_000),
  distance: z.number().int().min(0).max(1_000_000),
  crystals: z.number().int().min(0).max(200_000),
  durationMs: z.number().int().min(0).max(MAX_RUN_MS),
  seed: z.number().int().min(0).max(2 ** 31 - 1),
  livesUsed: z.number().int().min(0).max(3),
  maxCombo: z.number().int().min(0).max(100_000).optional(),
})

const MAX_SPEED = PHYSICS.maxSpeed

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

  try {
    const [{ recent }] = await db
      .select({ recent: sql<number>`count(*)::int` })
      .from(schema.gameRuns)
      .where(
        sql`${schema.gameRuns.playerId} = ${identity.id} and ${schema.gameRuns.createdAt} > now() - interval '1 minute'`,
      )
    if (recent >= MAX_RUNS_PER_MINUTE) {
      return NextResponse.json({ error: 'Too many runs, slow down' }, { status: 429, headers: { 'Retry-After': '30' } })
    }

    const previous = await getPlayerStats(identity.id)

    const groupChatId = await resolveRegisteredGroup(identity.groupChatId)
    const [topPlayer] = valid
      ? await db
          .select({ name: schema.players.displayName, score: schema.players.bestScore })
          .from(schema.players)
          .orderBy(desc(schema.players.bestScore))
          .limit(1)
      : []
    const [{ groupBest }] =
      valid && groupChatId
        ? await db
            .select({ groupBest: sql<number>`coalesce(max(${schema.gameRuns.score}), 0)::int` })
            .from(schema.gameRuns)
            .where(sql`${schema.gameRuns.chatId} = ${groupChatId} and ${schema.gameRuns.valid}`)
        : [{ groupBest: 0 }]

    const duplicate = await db.transaction(async (tx) => {
      const inserted = await tx
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
          chatId: groupChatId,
        })
        .onConflictDoNothing()
        .returning({ id: schema.gameRuns.id })

      if (inserted.length === 0) return true

      const best = valid ? run.score : 0
      const bestDistance = valid ? run.distance : 0
      const bestTime = valid ? run.durationMs : 0

      await tx
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
      return false
    })

    if (duplicate) return NextResponse.json({ error: 'Run already submitted' }, { status: 409 })

    if (valid && run.score > 0) {
      after(async () => {
        try {
          await announceRecords({
            player: identity,
            score: run.score,
            distance: run.distance,
            groupChatId,
            previousGlobal: topPlayer && topPlayer.score > 0 ? topPlayer : null,
            previousGroupBest: groupBest,
          })
        } catch (error) {
          console.error('[scores] record announcement failed', error)
        }
      })
    }

    const stats = await getPlayerStats(identity.id)
    return NextResponse.json({
      accepted: valid,
      isNewBest: valid && run.score > (previous?.bestScore ?? 0),
      stats,
    })
  } catch (error) {
    console.error('[scores] failed to save run', error)
    return NextResponse.json({ error: 'Could not save run' }, { status: 500 })
  }
}
