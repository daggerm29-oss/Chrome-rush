'use client'

interface TelegramWebApp {
  initData: string
  initDataUnsafe: { user?: { id: number; first_name: string; last_name?: string; username?: string } }
  version: string
  platform: string
  isExpanded: boolean
  isFullscreen?: boolean
  ready: () => void
  expand: () => void
  close: () => void
  requestFullscreen?: () => void
  exitFullscreen?: () => void
  lockOrientation?: () => void
  unlockOrientation?: () => void
  disableVerticalSwipes?: () => void
  enableClosingConfirmation?: () => void
  disableClosingConfirmation?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  setBottomBarColor?: (color: string) => void
  isVersionAtLeast?: (v: string) => boolean
  openTelegramLink?: (url: string) => void
  onEvent?: (event: string, cb: () => void) => void
  offEvent?: (event: string, cb: () => void) => void
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  const app = window.Telegram?.WebApp
  // The script defines WebApp everywhere; initData is only present inside Telegram.
  if (!app || !app.initData) return null
  return app
}

export function initTelegram() {
  const app = getWebApp()
  if (!app) return null
  try {
    app.ready()
    app.expand()
    app.disableVerticalSwipes?.()
    app.setHeaderColor?.('#070b17')
    app.setBackgroundColor?.('#070b17')
    app.setBottomBarColor?.('#070b17')
  } catch {
    // Older clients may not support every method.
  }
  return app
}

/** Enters immersive landscape-friendly mode where the platform allows it. */
export async function enterImmersive() {
  const app = getWebApp()
  if (app) {
    try {
      if (app.isVersionAtLeast?.('8.0')) {
        app.requestFullscreen?.()
        app.lockOrientation?.()
      }
    } catch {
      // ignore
    }
    return
  }
  if (typeof document === 'undefined') return
  const isTouch = window.matchMedia('(pointer: coarse)').matches
  if (!isTouch) return
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    }
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    await orientation.lock?.('landscape')
  } catch {
    // Orientation lock is unsupported on iOS Safari; the rotate hint covers that case.
  }
}

export function haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'error') {
  const app = getWebApp()
  try {
    if (app?.HapticFeedback) {
      if (kind === 'success' || kind === 'error') app.HapticFeedback.notificationOccurred(kind)
      else app.HapticFeedback.impactOccurred(kind)
      return
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(kind === 'heavy' || kind === 'error' ? 40 : kind === 'medium' ? 20 : 8)
    }
  } catch {
    // ignore
  }
}

export async function shareScore(text: string, url: string) {
  const app = getWebApp()
  if (app?.openTelegramLink) {
    app.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`)
    return 'shared'
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: 'Chroma Rush', text, url })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
