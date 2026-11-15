import type { PlatformSpec, SurfaceColor } from './types'

export const PLATFORM_THICKNESS = 1.4

export function platformTop(p: PlatformSpec, t: number) {
  let y = p.y + p.dropOffset
  if (p.kind === 'moving') y += p.amplitude * Math.sin((t * Math.PI * 2) / p.period + p.phaseOffset)
  return y
}

export function platformColor(p: PlatformSpec, t: number): SurfaceColor {
  if (p.kind !== 'alternating') return p.color
  return Math.floor((t + p.phaseOffset) / p.period) % 2 === 0 ? 'solar' : 'ion'
}

/** 0..1 progress toward the next colour flip of an alternating platform. */
export function alternatingProgress(p: PlatformSpec, t: number) {
  const v = (t + p.phaseOffset) / p.period
  return v - Math.floor(v)
}

export function isSolid(p: PlatformSpec) {
  return p.dropOffset > -0.35
}
