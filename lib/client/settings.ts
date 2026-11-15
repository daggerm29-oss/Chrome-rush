'use client'

import type { QualitySetting } from '@/lib/game/engine'

export interface GameSettings {
  music: number
  sfx: number
  quality: QualitySetting
  haptics: boolean
  tutorialSeen: boolean
  version: number
}

const KEY = 'chroma.settings'
const SETTINGS_VERSION = 2

export const DEFAULT_SETTINGS: GameSettings = {
  music: 0.6,
  sfx: 0.8,
  quality: 'medium',
  haptics: true,
  tutorialSeen: false,
  version: SETTINGS_VERSION,
}

export function loadSettings(): GameSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<GameSettings>
    const merged = { ...DEFAULT_SETTINGS, ...stored, version: SETTINGS_VERSION }
    // Settings saved before this version carried the old default (auto/high); reset them to the new default once.
    if ((stored.version ?? 0) < SETTINGS_VERSION) merged.quality = DEFAULT_SETTINGS.quality
    return merged
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: GameSettings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}
