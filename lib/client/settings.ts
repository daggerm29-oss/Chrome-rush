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
  quality: 'auto',
  haptics: true,
  tutorialSeen: false,
}

export function loadSettings(): GameSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<GameSettings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: GameSettings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}
