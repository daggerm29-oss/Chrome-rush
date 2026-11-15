'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { apiFetcher, type LeaderboardDto } from '@/lib/client/api'
import { cn } from '@/lib/utils'
import { Panel } from './panel'

export function LeaderboardPanel({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<'all' | 'daily'>('all')
  const { data, error, isLoading } = useSWR<LeaderboardDto>(`/api/leaderboard?period=${period}`, apiFetcher, {
    refreshInterval: 30_000,
  })

  return (
    <Panel title="Leaderboard" onClose={onClose} wide>
      <div className="mb-3 flex gap-1 rounded-xl bg-white/5 p-1" role="tablist" aria-label="Leaderboard period">
        {(['all', 'daily'] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => setPeriod(p)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-semibold transition',
              period === p ? 'bg-white text-night' : 'text-white/70 hover:text-white',
            )}
          >
            {p === 'all' ? 'All time' : 'Today'}
          </button>
        ))}
      </div>

      {error && <p className="py-6 text-center text-sm text-white/60">Could not load the leaderboard. Try again shortly.</p>}
      {isLoading && !data && (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
      )}
      {data && data.entries.length === 0 && (
        <p className="py-6 text-center text-sm text-white/60">No runs yet. Set the first record!</p>
      )}
      {data && data.entries.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {data.entries.map((e) => (
            <Row key={`${e.rank}-${e.name}`} {...e} />
          ))}
        </ol>
      )}
      {data?.me && !data.entries.some((e) => e.isMe) && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-white/50">Your position</p>
          <ol>
            <Row {...data.me} />
          </ol>
        </div>
      )}
    </Panel>
  )
}

function Row({ rank, name, score, distance, isMe }: LeaderboardDto['entries'][number]) {
  const medal = rank === 1 ? 'text-solar' : rank === 2 ? 'text-slate-200' : rank === 3 ? 'text-orange-400' : 'text-white/50'
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5',
        isMe ? 'bg-ion/15 ring-1 ring-ion/60' : 'bg-white/5',
      )}
    >
      <span className={cn('w-8 font-display text-base font-bold tabular-nums', medal)}>{`#${rank}`}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
        {name}
        {isMe && <span className="ml-2 text-xs font-medium text-ion">You</span>}
      </span>
      <span className="text-xs tabular-nums text-white/55">{`${distance.toLocaleString('en-US')} m`}</span>
      <span className="w-20 text-right font-display text-base font-bold tabular-nums text-white">{score.toLocaleString('en-US')}</span>
    </li>
  )
}
