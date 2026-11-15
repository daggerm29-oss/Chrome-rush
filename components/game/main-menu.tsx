'use client'

import { HelpCircle, Play, Settings, Trophy } from 'lucide-react'
import { useState } from 'react'
import type { PlayerStatsDto } from '@/lib/client/api'

interface MainMenuProps {
  stats: PlayerStatsDto | null | undefined
  isTelegram: boolean
  telegramName: string | null
  guestName: string
  onGuestNameChange: (name: string) => void
  onPlay: () => void
  onLeaderboard: () => void
  onSettings: () => void
  onHowTo: () => void
}

export function MainMenu({
  stats,
  isTelegram,
  telegramName,
  guestName,
  onGuestNameChange,
  onPlay,
  onLeaderboard,
  onSettings,
  onHowTo,
}: MainMenuProps) {
  const [draft, setDraft] = useState(guestName)

  return (
    <div className="absolute inset-0 overflow-y-auto bg-gradient-to-r from-night/85 via-night/40 to-transparent safe-pad">
      <div className="flex min-h-full flex-col justify-center gap-6 p-5 sm:p-8 landscape:flex-row landscape:items-center landscape:justify-between">
        <div className="flex max-w-md flex-col gap-5">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Phase runner</p>
            <h1 className="font-display text-5xl font-bold leading-none tracking-tight sm:text-6xl">
              <span className="text-solar text-glow-solar">CHROMA</span>{' '}
              <span className="text-ion text-glow-ion">RUSH</span>
            </h1>
            <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-white/75">
              Match your colour to the ground beneath you. Dark platforms are safe for both phases. Three lives per run.
            </p>
          </div>

          <button
            type="button"
            onClick={onPlay}
            className="group flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-solar px-6 py-4 font-display text-xl font-bold uppercase tracking-wider text-night shadow-[0_0_40px_rgb(255_176_32/0.45)] transition hover:brightness-110 active:scale-[0.97]"
          >
            <Play className="size-6 fill-night" aria-hidden />
            Play
          </button>

          <div className="flex flex-wrap gap-2">
            <MenuButton icon={Trophy} label="Leaderboard" onClick={onLeaderboard} />
            <MenuButton icon={Settings} label="Settings" onClick={onSettings} />
            <MenuButton icon={HelpCircle} label="How to play" onClick={onHowTo} />
          </div>
        </div>

        <div className="glass flex w-full max-w-sm flex-col gap-4 rounded-2xl p-4">
          {isTelegram ? (
            <p className="text-sm text-white/70">
              Playing as <span className="font-semibold text-white">{telegramName ?? 'Telegram pilot'}</span>
            </p>
          ) : (
            <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wider text-white/60">
              Pilot name
              <input
                value={draft}
                maxLength={20}
                placeholder="Enter a name for the leaderboard"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => onGuestNameChange(draft.trim())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-base font-normal normal-case tracking-normal text-white placeholder:text-white/35 focus:border-ion focus:outline-none"
                style={{ userSelect: 'text' }}
              />
            </label>
          )}
          <dl className="grid grid-cols-2 gap-3">
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
      className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  )
}

function Stat({ label, value, prefix = '', suffix = '' }: { label: string; value: number | undefined; prefix?: string; suffix?: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-white/55">{label}</dt>
      <dd className="font-display text-xl font-bold tabular-nums text-white">
        {value === undefined || value === 0 ? '--' : `${prefix}${value.toLocaleString('en-US')}${suffix}`}
      </dd>
    </div>
  )
}
