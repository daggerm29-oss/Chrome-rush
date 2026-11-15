'use client'

import { Home, Play, Settings, Smartphone } from 'lucide-react'
import type { DeathCause, ToastTone } from '@/lib/game/types'
import { cn } from '@/lib/utils'
import { Panel } from './panel'

export function PauseMenu({ onResume, onSettings, onQuit }: { onResume: () => void; onSettings: () => void; onQuit: () => void }) {
  return (
    <Panel title="Paused">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onResume}
          className="flex items-center justify-center gap-2 rounded-xl bg-ion py-3 font-display text-lg font-bold uppercase tracking-wider text-night transition hover:brightness-110 active:scale-[0.98]"
        >
          <Play className="size-5 fill-night" aria-hidden />
          Resume
        </button>
        <button
          type="button"
          onClick={onSettings}
          className="flex items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          <Settings className="size-4" aria-hidden />
          Settings
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="flex items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
        >
          <Home className="size-4" aria-hidden />
          Quit to menu
        </button>
      </div>
    </Panel>
  )
}

export function CountdownOverlay({ value, label }: { value: number; label?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center" aria-live="assertive">
      {value >= 0 && (
        <span key={value} className="animate-pop-in font-display text-8xl font-bold text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.6)]">
          {value > 0 ? value : 'GO'}
        </span>
      )}
      {label && <span className="mt-2 font-display text-sm font-semibold uppercase tracking-[0.3em] text-white/80">{label}</span>}
    </div>
  )
}

const DEATH_TEXT: Record<DeathCause, string> = {
  fall: 'Fell into the void',
  wall: 'Hit a wall',
  color: 'Wrong colour',
  hazard: 'Hit a hazard',
  gate: 'Wrong gate colour',
}

export function DeathBanner({ cause, livesLeft }: { cause: DeathCause; livesLeft: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center" aria-live="assertive">
      <div className="animate-pop-in flex flex-col items-center gap-1 rounded-2xl bg-hazard/15 px-6 py-4 backdrop-blur-sm ring-1 ring-hazard/50">
        <span className="font-display text-2xl font-bold uppercase tracking-wider text-hazard">{DEATH_TEXT[cause]}</span>
        <span className="text-sm font-medium text-white/80">
          {livesLeft > 0 ? `${livesLeft} ${livesLeft === 1 ? 'life' : 'lives'} left` : 'No lives left'}
        </span>
      </div>
    </div>
  )
}

export interface ToastItem {
  id: number
  text: string
  tone: ToastTone
}

export function Toasts({ items }: { items: ToastItem[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[30%] z-10 flex flex-col items-center gap-1" aria-live="polite">
      {items.map((t) => (
        <span
          key={t.id}
          className={cn(
            'animate-toast font-display text-lg font-bold uppercase tracking-wider',
            t.tone === 'solar' && 'text-solar text-glow-solar',
            t.tone === 'ion' && 'text-ion text-glow-ion',
            t.tone === 'neutral' && 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]',
            t.tone === 'danger' && 'text-hazard',
          )}
        >
          {t.text}
        </span>
      ))}
    </div>
  )
}

export function RotateHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-night/95 p-8 text-center safe-pad">
      <Smartphone className="size-14 rotate-90 text-ion motion-safe:animate-pulse" aria-hidden />
      <div>
        <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-white">Rotate your device</h2>
        <p className="mt-2 max-w-xs text-pretty text-sm leading-relaxed text-white/70">
          Chroma Rush plays best in landscape so you can see the gaps coming.
        </p>
      </div>
      <button type="button" onClick={onDismiss} className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15">
        Play in portrait anyway
      </button>
    </div>
  )
}
