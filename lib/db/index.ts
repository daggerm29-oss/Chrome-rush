import 'server-only'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { chromaPool?: Pool }

const pool =
  globalForDb.chromaPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  })

if (process.env.NODE_ENV !== 'production') globalForDb.chromaPool = pool

export const db = drizzle(pool, { schema })
export { schema }
