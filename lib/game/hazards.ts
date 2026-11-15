import { PHYSICS } from './difficulty'
import type { ObstacleKind, ObstacleSpec, Phase } from './types'

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const DRONE_RADIUS = 0.42
export const PISTON_LOCKED_BOTTOM = 1.6
export const FALLING_BLOCK_HEIGHT = 1.4
export const FALLING_BLOCK_START = 5.5
export const BLOCK_HEIGHT = 1.4
export const TOWER_HEIGHT = 2.6
export const ROLLER_HEIGHT = 1.4
export const SPIKE_FIELD_HEIGHT = 0.8

/** Obstacles that kill you unless your phase matches their colour. */
export function isMatchGate(kind: ObstacleKind) {
  return kind === 'colorGate' || kind === 'flipGate'
}

/** Any gate-style obstacle (never a vertical hazard). */
export function isGate(kind: ObstacleKind) {
  return kind === 'colorGate' || kind === 'flipGate' || kind === 'autoGate'
}

/** Extra empty space (m) the generator keeps after an obstacle so the next one stays fair. */
export function clearZoneAfter(kind: ObstacleKind, speed: number) {
  switch (kind) {
    case 'spikeField':
      return 3
    case 'roller':
      return 1.4
    case 'block':
    case 'fallingBlock':
      return 1
    case 'tower':
      return 1 + speed * 0.3
    default:
      return 0
  }
}

const opposite = (p: Phase): Phase => (p === 'solar' ? 'ion' : 'solar')

/** Seconds-before-contact a flipGate stops changing colour. */
export function flipGateLockDistance(speed: number) {
  return speed * 0.8 + 1.5
}

/** A flipGate blinks between two colours while far away, then locks to its final colour. */
export function gateColor(o: ObstacleSpec, playerZ: number, speed: number, t: number): Phase {
  if (o.kind !== 'flipGate') return o.color
  const d = o.z - playerZ
  if (d <= flipGateLockDistance(speed)) return o.color
  return Math.floor(t * 1.7 + o.id) % 2 === 0 ? opposite(o.color) : o.color
}

export function flipGateLocked(o: ObstacleSpec, playerZ: number, speed: number) {
  return o.z - playerZ <= flipGateLockDistance(speed)
}

/** The block hangs in the air with a red warning pad below, then drops once the player is close. */
export function fallingBlockTriggerDistance(speed: number) {
  return speed * 0.95 + 4
}

export function fallingBlockBottom(o: ObstacleSpec, playerZ: number, speed: number) {
  const d = o.z - playerZ
  const trigger = fallingBlockTriggerDistance(speed)
  const f = clamp((trigger - d) / (speed * 0.3), 0, 1)
  return lerp(FALLING_BLOCK_START, 0, f * f)
}

/** 0..1, how close the falling block is to dropping (for the warning pulse). */
export function fallingBlockWarning(o: ObstacleSpec, playerZ: number, speed: number) {
  const d = o.z - playerZ
  const trigger = fallingBlockTriggerDistance(speed)
  return clamp(1 - (d - trigger) / (speed * 0.9), 0, 1)
}

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
    case 'flipGate':
    case 'autoGate':
      return { dz: 0.25, y0: -0.5, y1: 5 }
    case 'block':
      return { dz: 0.5, y0: -0.3, y1: BLOCK_HEIGHT }
    case 'tower':
      return { dz: 0.5, y0: -0.3, y1: TOWER_HEIGHT }
    case 'spikeField':
      return { dz: 1.5, y0: -0.3, y1: SPIKE_FIELD_HEIGHT }
    case 'roller':
      return { dz: 0.65, y0: -0.3, y1: ROLLER_HEIGHT }
    case 'fallingBlock': {
      const bottom = fallingBlockBottom(o, playerZ, speed)
      return { dz: 0.6, y0: bottom > 0 ? bottom : -0.3, y1: bottom + FALLING_BLOCK_HEIGHT }
    }
  }
}

export function obstacleHit(o: ObstacleSpec, playerZ: number, feetY: number, speed: number, t: number, phase: Phase) {
  if (o.kind === 'autoGate') return false
  if (isMatchGate(o.kind) && gateColor(o, playerZ, speed, t) === phase) return false
  const b = obstacleBox(o, playerZ, speed, t)
  const dz = Math.abs(o.z - playerZ)
  if (dz > b.dz + PHYSICS.playerHalfDepth) return false
  const py0 = feetY - o.y + 0.05
  const py1 = py0 + PHYSICS.playerHeight - 0.1
  return py1 > b.y0 && py0 < b.y1
}

/** Vertical clearance when passing an obstacle; small positive values count as near misses. */
export function obstacleClearance(o: ObstacleSpec, playerZ: number, feetY: number, speed: number, t: number) {
  if (isGate(o.kind)) return Infinity
  const b = obstacleBox(o, playerZ, speed, t)
  const py0 = feetY - o.y
  const py1 = py0 + PHYSICS.playerHeight
  if (py0 >= b.y1) return py0 - b.y1
  if (py1 <= b.y0) return b.y0 - py1
  return Infinity
}
