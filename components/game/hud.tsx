'use client'

import { Heart, Magnet, Pause, Shield, Sparkles, Timer, Zap } from 'lucide-react'
import type { HudState, PowerUpType } from '@/lib/game/types'
import { cn } from '@/lib/utils'

const POWERUP_META: Record<PowerUpType, { label: string; icon: typeof Magnet; color: string }> = {
  magnet: { label: 'Magnet', icon: Magnet, color: '#a78bfa' },
  shield: { label: 'Shield', icon: Shield, color: '#4ade80' },
  multiplier: { label: 'x2', icon: Zap, color: '#ff4fd8' },
  slowmo: { label: 'Warp', icon: Timer, color: '#e0f2fe' },
  surge: { label: 'Surge', icon: Sparkles, color: '#facc15' },
}

interface HudProps {
  hud: HudState
  onPause: () => void
}

export function Hud({ hud, onPause }: HudProps) {
  const phaseColor = hud.phase === 'solar' ? 'text-solar' : 'text-ion'
  return (
    <div className="pointer-events-none absolute inset-0 safe-pad">
      <div className="flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="glass rounded-xl px-3 py-2 sm:px-4">
          <p className="font-display text-2xl font-bold leading-none tabular-nums text-white sm:text-3xl">
            {hud.score.toLocaleString('en-US')}
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs font-medium text-white/70 tabular-nums sm:text-sm">
            <span>{hud.distance.toLocaleString('en-US')} m</span>
            <span className="flex items-center gap-1 text-crystal">
              <span aria-hidden className="inline-block size-2 rotate-45 bg-crystal" />
              {hud.crystals}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center gap-2">
          {hud.multiplier > 1 && (
            <div
              key={hud.multiplier}
              className={cn('animate-pop-in font-display text-lg font-bold tabular-nums sm:text-xl', phaseColor, hud.phase === 'solar' ? 'text-glow-solar' : 'text-glow-ion')}
            >
              {`x${hud.multiplier.toFixed(1)}`}
              <span className="ml-1.5 text-xs font-medium text-white/60">{`${hud.combo} combo`}</span>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-1.5">
            {hud.shield && <PowerChip type="shield" progress={1} />}
            {hud.powerUps.map((p) => (
              <PowerChip key={p.type} type={p.type} progress={p.remaining / p.duration} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="glass flex items-center gap-1 rounded-xl px-2.5 py-2" aria-label={`${hud.lives} of ${hud.maxLives} lives remaining`}>
            {Array.from({ length: hud.maxLives }).map((_, i) => (
              <Heart
                key={i}
                aria-hidden
                className={cn('size-4 sm:size-5 transition-all', i < hud.lives ? 'fill-hazard text-hazard' : 'text-white/25')}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onPause}
            className="glass pointer-events-auto flex size-10 items-center justify-center rounded-xl text-white transition hover:bg-white/10 active:scale-95"
            aria-label="Pause game"
          >
            <Pause className="size-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function PowerChip({ type, progress }: { type: PowerUpType; progress: number }) {
  const meta = POWERUP_META[type]
  const Icon = meta.icon
  return (
    <div className="glass relative flex items-center gap-1.5 overflow-hidden rounded-full px-2.5 py-1 text-xs font-semibold text-white">
      <Icon className="size-3.5" style={{ color: meta.color }} aria-hidden />
      <span>{meta.label}</span>
      <span
        className="absolute bottom-0 left-0 h-0.5"
        style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%`, background: meta.color }}
      />
    </div>
  )
}
