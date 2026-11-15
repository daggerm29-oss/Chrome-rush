'use client'

import { HelpCircle, Play, Settings, Trophy } from 'lucide-react'
import type { PlayerStatsDto } from '@/lib/client/api'

interface MainMenuProps {
  stats: PlayerStatsDto | null | undefined
  name: string | null
  onPlay: () => void
  onLeaderboard: () => void
  onSettings: () => void
  onHowTo: () => void
}

export function MainMenu({ stats, name, onPlay, onLeaderboard, onSettings, onHowTo }: MainMenuProps) {
  return (
    <div className="absolute inset-0 overflow-y-auto bg-gradient-to-r from-night/85 via-night/40 to-transparent safe-pad">
      <div className="flex min-h-full flex-col justify-center gap-6 p-5 sm:p-8 landscape:flex-row landscape:items-center landscape:justify-between short:gap-4 short:p-3 short:px-5">
        <div className="flex max-w-md flex-col gap-5 short:gap-3">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-white/60 short:text-[10px]">
              Phase runner
            </p>
            <h1 className="font-display text-5xl font-bold leading-none tracking-tight sm:text-6xl short:whitespace-nowrap short:text-4xl">
              <span className="text-solar text-glow-solar">CHROMA</span>{' '}
              <span className="text-ion text-glow-ion">RUSH</span>
            </h1>
            <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-white/75 short:hidden">
              Match your colour to the ground beneath you. Dark platforms are safe for both phases. Three lives per run.
            </p>
          </div>

          <button
            type="button"
            onClick={onPlay}
            className="group flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-solar px-6 py-4 font-display text-xl font-bold uppercase tracking-wider text-night shadow-[0_0_40px_rgb(255_176_32/0.45)] transition hover:brightness-110 active:scale-[0.97] short:py-2.5 short:text-lg"
          >
            <Play className="size-6 fill-night short:size-5" aria-hidden />
            Play
          </button>

          <div className="flex flex-wrap gap-2">
            <MenuButton icon={Trophy} label="Leaderboard" onClick={onLeaderboard} />
            <MenuButton icon={Settings} label="Settings" onClick={onSettings} />
            <MenuButton icon={HelpCircle} label="How to play" onClick={onHowTo} />
          </div>
        </div>

        <div className="glass flex w-full max-w-sm flex-col gap-4 rounded-2xl p-4 short:max-w-[17rem] short:gap-2 short:p-3">
          <p className="truncate text-sm text-white/70">
            Playing as <span className="font-semibold text-white">{name ?? 'Player'}</span>
          </p>
          <dl className="grid grid-cols-2 gap-3 short:gap-2">
            <Stat label="Best score" value={stats?.bestScore} />
            <Stat label="Best distance" value={stats?.bestDistance} suffix=" m" />
            <Stat label="Crystals" value={stats?.totalCrystals} />
            <Stat label="Global rank" value={stats?.rank ?? undefined} prefix="#" />
          </dl>
        </div>
      </div>
    </div>
  )
}

function MenuButton({ icon: Icon, label, onClick }: { icon: typeof Play; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95 short:gap-1.5 short:px-3 short:py-1.5 short:text-xs"
    >
      <Icon className="size-4 short:size-3.5" aria-hidden />
      {label}
    </button>
  )
}

function Stat({ label, value, prefix = '', suffix = '' }: { label: string; value: number | undefined; prefix?: string; suffix?: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2 short:px-2.5 short:py-1">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-white/55 short:text-[9px]">{label}</dt>
      <dd className="font-display text-xl font-bold tabular-nums text-white short:text-base">
        {value === undefined || value === 0 ? '--' : `${prefix}${value.toLocaleString('en-US')}${suffix}`}
      </dd>
    </div>
  )
}
