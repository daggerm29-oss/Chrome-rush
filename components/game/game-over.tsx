'use client'

import { Home, RotateCcw, Share2, Trophy } from 'lucide-react'
import type { SubmitResponse } from '@/lib/client/api'
import type { RunResult } from '@/lib/game/types'

interface GameOverProps {
  result: RunResult
  submit: { status: 'pending' | 'done' | 'error'; data?: SubmitResponse }
  onRetry: () => void
  onMenu: () => void
  onLeaderboard: () => void
  onShare: () => void
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function GameOver({ result, submit, onRetry, onMenu, onLeaderboard, onShare }: GameOverProps) {
  const isNewBest = submit.data?.isNewBest
  const rank = submit.data?.stats?.rank
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-night/75 p-3 backdrop-blur-md safe-pad">
      <div className="glass animate-pop-in flex w-full max-w-2xl flex-col gap-4 rounded-2xl p-5 landscape:flex-row landscape:items-stretch">
        <div className="flex flex-1 flex-col justify-center gap-1">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-hazard">Run over</p>
          {isNewBest && (
            <p className="font-display text-sm font-bold uppercase tracking-widest text-solar text-glow-solar">New personal best</p>
          )}
          <p className="font-display text-5xl font-bold leading-none tabular-nums text-white sm:text-6xl">
            {result.score.toLocaleString('en-US')}
          </p>
          <p className="text-sm text-white/60" aria-live="polite">
            {submit.status === 'pending' && 'Saving your run...'}
            {submit.status === 'error' && 'Could not save this run. Check your connection.'}
            {submit.status === 'done' && submit.data && !submit.data.accepted && 'Run recorded but not ranked.'}
            {submit.status === 'done' && submit.data?.accepted && (rank ? `Global rank #${rank}` : 'Run saved')}
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Distance" value={`${result.distance.toLocaleString('en-US')} m`} />
            <Stat label="Crystals" value={result.crystals.toLocaleString('en-US')} />
            <Stat label="Time" value={formatTime(result.durationMs)} />
            <Stat label="Best combo" value={String(result.maxCombo)} />
          </dl>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center justify-center gap-2 rounded-xl bg-solar py-3 font-display text-lg font-bold uppercase tracking-wider text-night shadow-[0_0_30px_rgb(255_176_32/0.4)] transition hover:brightness-110 active:scale-[0.98]"
          >
            <RotateCcw className="size-5" aria-hidden />
            Run again
          </button>
          <div className="grid grid-cols-3 gap-2">
            <SmallButton icon={Home} label="Menu" onClick={onMenu} />
            <SmallButton icon={Trophy} label="Ranks" onClick={onLeaderboard} />
            <SmallButton icon={Share2} label="Share" onClick={onShare} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-white/55">{label}</dt>
      <dd className="font-display text-lg font-bold tabular-nums text-white">{value}</dd>
    </div>
  )
}

function SmallButton({ icon: Icon, label, onClick }: { icon: typeof Home; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-xl bg-white/5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  )
}
