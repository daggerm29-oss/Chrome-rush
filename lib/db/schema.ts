import { bigint, boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const players = pgTable('players', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  username: text('username'),
  source: text('source').notNull().default('guest'),
  bestScore: integer('best_score').notNull().default(0),
  bestDistance: integer('best_distance').notNull().default(0),
  bestTimeMs: integer('best_time_ms').notNull().default(0),
  totalGames: integer('total_games').notNull().default(0),
  totalCrystals: integer('total_crystals').notNull().default(0),
  totalDistance: bigint('total_distance', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastActive: timestamp('last_active', { withTimezone: true }).notNull().defaultNow(),
})

export const gameRuns = pgTable('game_runs', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull(),
  score: integer('score').notNull(),
  distance: integer('distance').notNull(),
  crystals: integer('crystals').notNull(),
  durationMs: integer('duration_ms').notNull(),
  seed: integer('seed').notNull(),
  livesUsed: integer('lives_used').notNull().default(0),
  valid: boolean('valid').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
