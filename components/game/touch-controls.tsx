'use client'

import { ArrowUp, RefreshCw } from 'lucide-react'
import type { Phase } from '@/lib/game/types'
import { cn } from '@/lib/utils'

interface TouchControlsProps {
  phase: Phase
  onJumpDown: () => void
  onJumpUp: () => void
  onSwitch: () => void
}

/**
 * Each half of the screen is a large touch zone (left = switch, right = jump) so players
 * never have to hunt for small buttons. The visible buttons show where the zones are.
 */
export function TouchControls({ phase, onJumpDown, onJumpUp, onSwitch }: TouchControlsProps) {
  const next: Phase = phase === 'solar' ? 'ion' : 'solar'
  return (
    <div className="absolute inset-x-0 bottom-0 top-20 flex safe-pad">
      <button
        type="button"
        aria-label={`Switch phase to ${next}`}
        className="group relative flex flex-1 items-end justify-start p-4 outline-none sm:p-6"
        onPointerDown={(e) => {
          e.preventDefault()
          onSwitch()
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span
          className={cn(
            'flex size-20 flex-col items-center justify-center gap-0.5 rounded-full border-2 bg-black/30 backdrop-blur-sm transition-transform group-active:scale-90 sm:size-24',
            next === 'solar' ? 'border-solar text-solar' : 'border-ion text-ion',
          )}
          style={{ boxShadow: `0 0 28px ${next === 'solar' ? 'rgb(255 176 32 / 0.45)' : 'rgb(34 211 238 / 0.45)'}` }}
        >
          <RefreshCw className="size-7" aria-hidden />
          <span className="font-display text-[10px] font-bold uppercase tracking-widest">Switch</span>
        </span>
      </button>
      <button
        type="button"
        aria-label="Jump (tap again in the air to double jump)"
        className="group relative flex flex-1 items-end justify-end p-4 outline-none sm:p-6"
        onPointerDown={(e) => {
          e.preventDefault()
          onJumpDown()
        }}
        onPointerUp={onJumpUp}
        onPointerCancel={onJumpUp}
        onPointerLeave={onJumpUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="flex size-20 flex-col items-center justify-center gap-0.5 rounded-full border-2 border-white/80 bg-black/30 text-white backdrop-blur-sm transition-transform group-active:scale-90 sm:size-24">
          <ArrowUp className="size-8" aria-hidden />
          <span className="font-display text-[10px] font-bold uppercase tracking-widest">Jump</span>
        </span>
      </button>
    </div>
  )
}
