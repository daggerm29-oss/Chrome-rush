'use client'

import type { QualitySetting } from '@/lib/game/engine'

export interface GameSettings {
  music: number
  sfx: number
  quality: QualitySetting
  haptics: boolean
  tutorialSeen: boolean
}

const KEY = 'chroma.settings'

export const DEFAULT_SETTINGS: GameSettings = {
  music: 0.6,
  sfx: 0.8,
  quality: 'high',
  haptics: true,
  tutorialSeen: false,
}

export function loadSettings(): GameSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const merged = { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<GameSettings>) }
    // 'auto' was the old default and silently dropped players to low; it is no longer offered.
    if (merged.quality === 'auto') merged.quality = 'high'
    return merged
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: GameSettings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}
