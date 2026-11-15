export type Phase = 'solar' | 'ion'
export type SurfaceColor = Phase | 'neutral'

export type PlatformKind = 'static' | 'moving' | 'alternating' | 'collapsing'

export interface PlatformSpec {
  id: number
  z0: number
  z1: number
  y: number
  width: number
  color: SurfaceColor
  kind: PlatformKind
  period: number
  phaseOffset: number
  amplitude: number
  touchedAt: number
  dropOffset: number
  dropVelocity: number
  hasFrame: boolean
}

export type ObstacleKind =
  | 'spikes'
  | 'saw'
  | 'lowLaser'
  | 'highBarrier'
  | 'piston'
  | 'drone'
  | 'colorGate'
  | 'flipGate'
  | 'autoGate'
  | 'block'
  | 'tower'
  | 'spikeField'
  | 'roller'
  | 'fallingBlock'

export interface ObstacleSpec {
  id: number
  kind: ObstacleKind
  z: number
  y: number
  color: Phase
  variant: 'low' | 'high'
  passed: boolean
  big: boolean
}

export interface CrystalSpec {
  id: number
  z: number
  y: number
  x: number
  bonus: boolean
  collected: boolean
  slot: number
}

export type PowerUpType = 'magnet' | 'shield' | 'multiplier' | 'slowmo' | 'surge'

export interface PowerUpSpec {
  id: number
  z: number
  y: number
  type: PowerUpType
  collected: boolean
}

export type DeathCause = 'fall' | 'wall' | 'color' | 'hazard' | 'gate'

export interface ActivePowerUp {
  type: PowerUpType
  remaining: number
  duration: number
}

export interface HudState {
  distance: number
  score: number
  crystals: number
  phase: Phase
  combo: number
  multiplier: number
  lives: number
  maxLives: number
  powerUps: ActivePowerUp[]
  shield: boolean
  biome: string
  speed: number
  invulnerable: boolean
}

export interface RunResult {
  runId: string
  score: number
  distance: number
  crystals: number
  durationMs: number
  seed: number
  livesUsed: number
  maxCombo: number
}

export type EngineMode =
  | 'menu'
  | 'countdown'
  | 'playing'
  | 'dying'
  | 'respawning'
  | 'paused'
  | 'over'

export type Quality = 'low' | 'medium' | 'high'

export type ToastTone = 'solar' | 'ion' | 'neutral' | 'danger'

export interface EngineEvents {
  onHud: (hud: HudState) => void
  onModeChange: (mode: EngineMode) => void
  onCountdown: (value: number) => void
  onDeath: (info: { cause: DeathCause; livesLeft: number }) => void
  onGameOver: (result: RunResult) => void
  onToast: (text: string, tone: ToastTone) => void
  onHaptic: (kind: 'light' | 'medium' | 'heavy' | 'success' | 'error') => void
}
