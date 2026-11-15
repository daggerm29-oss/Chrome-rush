'use client'

import type { GameSettings } from '@/lib/client/settings'
import type { QualitySetting } from '@/lib/game/engine'
import { cn } from '@/lib/utils'
import { Panel } from './panel'

interface SettingsPanelProps {
  settings: GameSettings
  onChange: (s: GameSettings) => void
  onClose: () => void
}

const QUALITIES: { value: QualitySetting; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  return (
    <Panel title="Settings" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <Slider label="Music" value={settings.music} onChange={(music) => onChange({ ...settings, music })} />
        <Slider label="Sound effects" value={settings.sfx} onChange={(sfx) => onChange({ ...settings, sfx })} />

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-white">Graphics quality</legend>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/5 p-1">
            {QUALITIES.map((q) => (
              <button
                key={q.value}
                type="button"
                aria-pressed={settings.quality === q.value}
                onClick={() => onChange({ ...settings, quality: q.value })}
                className={cn(
                  'rounded-lg py-2 text-sm font-semibold transition',
                  settings.quality === q.value ? 'bg-white text-night' : 'text-white/70 hover:text-white',
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/55">
            Auto lowers effects if your device drops below a smooth frame rate.
          </p>
        </fieldset>

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-white">Haptic feedback</span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.haptics}
            onClick={() => onChange({ ...settings, haptics: !settings.haptics })}
            className={cn('relative h-7 w-12 rounded-full transition', settings.haptics ? 'bg-ion' : 'bg-white/20')}
          >
            <span className={cn('absolute top-1 size-5 rounded-full bg-white transition-all', settings.haptics ? 'left-6' : 'left-1')} />
            <span className="sr-only">Toggle haptic feedback</span>
          </button>
        </label>

        <div className="rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-white/60">
          <p className="mb-1 font-semibold text-white/80">Keyboard</p>
          <p>Space / W / Up: jump (again mid-air for double jump)</p>
          <p>C / Shift / S / Down: switch phase</p>
          <p>Esc / P: pause</p>
        </div>
      </div>
    </Panel>
  )
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const id = `slider-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-semibold text-white">
          {label}
        </label>
        <span className="text-xs tabular-nums text-white/60">{Math.round(value * 100)}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-ion"
        style={{ touchAction: 'pan-x' }}
      />
    </div>
  )
}
