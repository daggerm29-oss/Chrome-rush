export function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (min: number, max: number) => min + (max - min) * next(),
    int: (min: number, max: number) => Math.floor(min + (max - min + 1) * next()),
    chance: (p: number) => next() < p,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    weighted: <T>(entries: readonly (readonly [T, number])[]): T => {
      const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0)
      let r = next() * total
      for (const [item, w] of entries) {
        r -= Math.max(0, w)
        if (r <= 0) return item
      }
      return entries[entries.length - 1][0]
    },
  }
}

export type Rng = ReturnType<typeof createRng>

export const PHYSICS = {
  gravity: 42,
  jumpVelocity: 13.5,
  doubleJumpVelocity: 12.5,
  jumpCutFactor: 0.55,
  playerHeight: 1.2,
  playerHalfDepth: 0.35,
  coyoteTime: 0.09,
  jumpBuffer: 0.12,
  minSpeed: 11,
  maxSpeed: 24.5,
} as const

/** Continuous 0..1 difficulty curve. ~0.22 at 30s, ~0.39 at 1min, ~0.63 at 2min, ~0.86 at 4min. */
export function difficultyAt(seconds: number) {
  return 1 - Math.exp(-seconds / 120)
}

export function speedAt(difficulty: number) {
  return PHYSICS.minSpeed + (PHYSICS.maxSpeed - PHYSICS.minSpeed) * Math.pow(difficulty, 0.75)
}

/** Time (s) the player is airborne using a full double jump at apex, returning to height dy relative to takeoff. */
export function doubleJumpAirTime(dy: number) {
  const { gravity: g, jumpVelocity: j1, doubleJumpVelocity: j2 } = PHYSICS
  const t1 = j1 / g
  const h1 = (j1 * j1) / (2 * g)
  const t2 = j2 / g
  const apex = h1 + (j2 * j2) / (2 * g)
  const fall = apex - dy
  if (fall < 0) return 0
  return t1 + t2 + Math.sqrt((2 * fall) / g)
}

export function singleJumpAirTime(dy: number) {
  const { gravity: g, jumpVelocity: j1 } = PHYSICS
  const apex = (j1 * j1) / (2 * g)
  const fall = apex - dy
  if (fall < 0) return 0
  return j1 / g + Math.sqrt((2 * fall) / g)
}

export const SINGLE_JUMP_HEIGHT = (PHYSICS.jumpVelocity ** 2) / (2 * PHYSICS.gravity)
export const DOUBLE_JUMP_HEIGHT =
  SINGLE_JUMP_HEIGHT + (PHYSICS.doubleJumpVelocity ** 2) / (2 * PHYSICS.gravity)
