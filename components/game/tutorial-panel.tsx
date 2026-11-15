'use client'

import { ArrowUp, Flame, Heart, RefreshCw, Sparkles, Zap } from 'lucide-react'
import { Panel } from './panel'

interface TutorialPanelProps {
  onDone: () => void
  ctaLabel?: string
}

const STEPS = [
  {
    icon: ArrowUp,
    title: 'Jump & double jump',
    body: 'Tap the right side (or Space) to jump. Tap again in mid-air for a double jump. Release early for a shorter hop.',
    color: '#ffffff',
  },
  {
    icon: RefreshCw,
    title: 'Switch phase',
    body: 'Tap the left side (or C) to flip between Solar and Ion. Land only on your colour, or on dark platforms which are always safe.',
    color: '#22d3ee',
  },
  {
    icon: Sparkles,
    title: 'Chain combos',
    body: 'Crystals, near misses, perfect landings and colour gates build your multiplier up to x5. Grab power-ups for magnets, shields and more.',
    color: '#ff4fd8',
  },
  {
    icon: Zap,
    title: 'Colour-shifting tiles',
    body: 'The rails of a shifting tile show the colour it will become next. When the whole tile starts flashing, it is about to flip, so switch phase to match.',
    color: '#facc15',
  },
  {
    icon: Flame,
    title: 'Learn the hazards',
    body: 'Hop blocks, rollers, spike fields and falling blocks (watch the red pad). Double jump towers. Flickering gates lock their colour just before you reach them. Rings repaint you automatically.',
    color: '#fb923c',
  },
  {
    icon: Heart,
    title: 'Three lives',
    body: 'Fall, crash or touch the wrong colour and you lose a life, then respawn right where you fell. Lose all three and the run ends.',
    color: '#ff2d55',
  },
]

export function TutorialPanel({ onDone, ctaLabel = 'Got it' }: TutorialPanelProps) {
  return (
    <Panel title="How to play" onClose={onDone} wide>
      <ul className="grid gap-3 sm:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.title} className="flex gap-3 rounded-xl bg-white/5 p-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/5"
              style={{ color: s.color }}
              aria-hidden
            >
              <s.icon className="size-5" />
            </span>
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/70">{s.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onDone}
        className="mt-4 w-full rounded-xl bg-ion py-3 font-display text-base font-bold uppercase tracking-wider text-night transition hover:brightness-110 active:scale-[0.98]"
      >
        {ctaLabel}
      </button>
    </Panel>
  )
}
