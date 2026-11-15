import 'server-only'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { chromaPool?: Pool }

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Connect the Neon integration to enable scores and leaderboards.')
}

const pool = globalForDb.chromaPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })

if (process.env.NODE_ENV !== 'production') globalForDb.chromaPool = pool

export const db = drizzle(pool, { schema })
export { schema }
