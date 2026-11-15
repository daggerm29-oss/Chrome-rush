import { PHYSICS } from './difficulty'
import type { ObstacleSpec, Phase } from './types'

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const DRONE_RADIUS = 0.42
export const PISTON_LOCKED_BOTTOM = 1.6

/**
 * Moving hazards animate freely while far away, then settle into a fixed, readable state
 * once the player is close. This keeps them dynamic but never randomly unavoidable.
 */
export function droneCenter(o: ObstacleSpec, playerZ: number, speed: number, t: number) {
  const d = o.z - playerZ
  const target = o.variant === 'low' ? 0.6 : 2.05
  const settle = speed * 1.1
  const roam = 1.35 + Math.sin(t * 2.4 + o.id) * 0.95
  if (d <= settle) return target + Math.sin(t * 9 + o.id) * 0.04
  const k = clamp((d - settle) / (speed * 0.6), 0, 1)
  return lerp(target, roam, k)
}

export function pistonBottom(o: ObstacleSpec, playerZ: number, speed: number, t: number) {
  const d = o.z - playerZ
  if (d < -1.2) return Math.max(0, PISTON_LOCKED_BOTTOM - (-d - 1.2) * 1.6)
  const settle = speed * 1.15
  if (d <= settle) return PISTON_LOCKED_BOTTOM
  const pump = (0.5 + 0.5 * Math.sin(t * 5 + o.id)) * PISTON_LOCKED_BOTTOM
  const k = clamp((d - settle) / (speed * 0.5), 0, 1)
  return lerp(PISTON_LOCKED_BOTTOM, pump, k)
}

interface Box {
  dz: number
  y0: number
  y1: number
}

export function obstacleBox(o: ObstacleSpec, playerZ: number, speed: number, t: number): Box {
  switch (o.kind) {
    case 'spikes':
      return { dz: 0.6, y0: -0.3, y1: o.big ? 1.2 : 0.8 }
    case 'saw':
      return { dz: o.big ? 1.1 : 0.8, y0: -0.3, y1: o.big ? 1.6 : 1.1 }
    case 'lowLaser':
      return { dz: 0.15, y0: 0.4, y1: 0.8 }
    case 'highBarrier':
      return { dz: 0.5, y0: 1.55, y1: 5 }
    case 'piston':
      return { dz: 0.7, y0: pistonBottom(o, playerZ, speed, t), y1: 6 }
    case 'drone': {
      const c = droneCenter(o, playerZ, speed, t)
      return { dz: DRONE_RADIUS, y0: c - DRONE_RADIUS, y1: c + DRONE_RADIUS }
    }
    case 'colorGate':
      return { dz: 0.25, y0: -0.5, y1: 5 }
  }
}

export function obstacleHit(o: ObstacleSpec, playerZ: number, feetY: number, speed: number, t: number, phase: Phase) {
  if (o.kind === 'colorGate' && o.color === phase) return false
  const b = obstacleBox(o, playerZ, speed, t)
  const dz = Math.abs(o.z - playerZ)
  if (dz > b.dz + PHYSICS.playerHalfDepth) return false
  const py0 = feetY - o.y + 0.05
  const py1 = py0 + PHYSICS.playerHeight - 0.1
  return py1 > b.y0 && py0 < b.y1
}

/** Vertical clearance when passing an obstacle; small positive values count as near misses. */
export function obstacleClearance(o: ObstacleSpec, playerZ: number, feetY: number, speed: number, t: number) {
  if (o.kind === 'colorGate') return Infinity
  const b = obstacleBox(o, playerZ, speed, t)
  const py0 = feetY - o.y
  const py1 = py0 + PHYSICS.playerHeight
  if (py0 >= b.y1) return py0 - b.y1
  if (py1 <= b.y0) return b.y0 - py1
  return Infinity
}
