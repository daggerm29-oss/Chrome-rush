'use client'

import dynamic from 'next/dynamic'

const GameApp = dynamic(() => import('./game-app').then((m) => m.GameApp), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-night">
      <p className="font-display text-4xl font-bold tracking-tight">
        <span className="text-solar">CHROMA</span> <span className="text-ion">RUSH</span>
      </p>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Loading game">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-solar to-ion" />
      </div>
    </div>
  ),
})

export function GameRoot() {
  return <GameApp />
}
