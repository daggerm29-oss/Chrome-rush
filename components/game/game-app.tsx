'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import {
  apiFetcher,
  getGuestName,
  type PlayerStatsDto,
  setGuestName,
  type SubmitResponse,
  submitRun,
} from '@/lib/client/api'
import { type GameSettings, loadSettings, saveSettings } from '@/lib/client/settings'
import { GameEngine } from '@/lib/game/engine'
import type { DeathCause, EngineMode, HudState, RunResult, ToastTone } from '@/lib/game/types'
import { enterImmersive, haptic, initTelegram, shareScore } from '@/lib/telegram/client'
import { GameOver } from './game-over'
import { Hud } from './hud'
import { LeaderboardPanel } from './leaderboard-panel'
import { MainMenu } from './main-menu'
import { CountdownOverlay, DeathBanner, PauseMenu, RotateHint, type ToastItem, Toasts } from './overlays'
import { SettingsPanel } from './settings-panel'
import { TouchControls } from './touch-controls'
import { TutorialPanel } from './tutorial-panel'

type PanelKind = null | 'leaderboard' | 'settings' | 'tutorial'

const IN_RUN: EngineMode[] = ['countdown', 'playing', 'dying', 'respawning', 'paused']

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const [mode, setMode] = useState<EngineMode>('menu')
  const [hud, setHud] = useState<HudState | null>(null)
  const [countdown, setCountdown] = useState(-1)
  const [death, setDeath] = useState<{ cause: DeathCause; livesLeft: number } | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)
  const [submit, setSubmit] = useState<{ status: 'pending' | 'done' | 'error'; data?: SubmitResponse }>({ status: 'pending' })
  const [panel, setPanel] = useState<PanelKind>(null)
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings())
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [portrait, setPortrait] = useState(false)
  const [rotateDismissed, setRotateDismissed] = useState(false)
  const [telegram, setTelegram] = useState<{ active: boolean; name: string | null }>({ active: false, name: null })
  const [guestName, setGuestNameState] = useState(() => getGuestName())
  const startAfterTutorial = useRef(false)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const toastId = useRef(0)

  const { mutate } = useSWRConfig()
  const { data: playerData, mutate: mutatePlayer } = useSWR<{ stats: PlayerStatsDto | null }>('/api/player', apiFetcher)

  const pushToast = useCallback((text: string, tone: ToastTone) => {
    const id = ++toastId.current
    setToasts((list) => [...list.slice(-2), { id, text, tone }])
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 1400)
  }, [])

  const handleGameOver = useCallback(
    (run: RunResult) => {
      setResult(run)
      setSubmit({ status: 'pending' })
      submitRun(run)
        .then((data) => {
          setSubmit({ status: 'done', data })
          void mutatePlayer()
          void mutate((key) => typeof key === 'string' && key.startsWith('/api/leaderboard'))
        })
        .catch(() => setSubmit({ status: 'error' }))
    },
    [mutate, mutatePlayer],
  )

  // Engine lifecycle
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new GameEngine(
      canvas,
      {
        onHud: setHud,
        onModeChange: (m) => {
          setMode(m)
          if (m !== 'dying') setDeath(null)
        },
        onCountdown: setCountdown,
        onDeath: setDeath,
        onGameOver: handleGameOver,
        onToast: pushToast,
        onHaptic: (kind) => {
          if (settingsRef.current.haptics) haptic(kind)
        },
      },
      settingsRef.current.quality,
    )
    engine.setVolumes(settingsRef.current.music, settingsRef.current.sfx)
    engineRef.current = engine
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [handleGameOver, pushToast])

  // Settings sync
  useEffect(() => {
    saveSettings(settings)
    engineRef.current?.setVolumes(settings.music, settings.sfx)
    engineRef.current?.setQuality(settings.quality)
  }, [settings])

  // Telegram + orientation
  useEffect(() => {
    const app = initTelegram()
    if (app) {
      const u = app.initDataUnsafe.user
      setTelegram({ active: true, name: u ? [u.first_name, u.last_name].filter(Boolean).join(' ') : null })
    }
    const mq = window.matchMedia('(orientation: portrait) and (pointer: coarse)')
    const update = () => setPortrait(mq.matches)
    update()
    mq.addEventListener('change', update)
    const onVisibility = () => {
      if (document.hidden && engineRef.current && IN_RUN.includes(engineRef.current.mode)) engineRef.current.pause()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      mq.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const beginRun = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    setResult(null)
    setDeath(null)
    setPanel(null)
    engine.startRun()
  }, [])

  const handlePlay = useCallback(() => {
    engineRef.current?.unlockAudio()
    void enterImmersive()
    if (!settingsRef.current.tutorialSeen) {
      startAfterTutorial.current = true
      setPanel('tutorial')
      return
    }
    beginRun()
  }, [beginRun])

  const closeTutorial = useCallback(() => {
    setSettings((s) => ({ ...s, tutorialSeen: true }))
    setPanel(null)
    if (startAfterTutorial.current) {
      startAfterTutorial.current = false
      beginRun()
    }
  }, [beginRun])

  const handlePause = useCallback(() => engineRef.current?.pause(), [])
  const handleResume = useCallback(() => {
    engineRef.current?.unlockAudio()
    engineRef.current?.resume()
  }, [])

  // Keyboard controls
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const engine = engineRef.current
      if (!engine) return
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const k = e.key.toLowerCase()
      if ([' ', 'arrowup', 'w'].includes(k)) {
        e.preventDefault()
        if (!e.repeat) engine.jumpPress()
      } else if (['c', 'shift', 'arrowdown', 's', 'x'].includes(k)) {
        e.preventDefault()
        if (!e.repeat) engine.switchPhase()
      } else if (k === 'escape' || k === 'p') {
        if (engine.mode === 'paused') engine.resume()
        else engine.pause()
      } else if (k === 'enter' && (engine.mode === 'menu' || engine.mode === 'over') && !panel) {
        handlePlay()
      }
    }
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ([' ', 'arrowup', 'w'].includes(k)) engineRef.current?.jumpRelease()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [handlePlay, panel])

  const handleShare = useCallback(async () => {
    if (!result) return
    const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    const shortName = process.env.NEXT_PUBLIC_TELEGRAM_APP_SHORT_NAME
    const url = bot ? (shortName ? `https://t.me/${bot}/${shortName}` : `https://t.me/${bot}?startapp=play`) : window.location.origin
    const outcome = await shareScore(
      `I scored ${result.score.toLocaleString('en-US')} and ran ${result.distance.toLocaleString('en-US')} m in Chroma Rush. Can you beat me?`,
      url,
    )
    if (outcome === 'copied') pushToast('Link copied', 'neutral')
  }, [result, pushToast])

  const inRun = IN_RUN.includes(mode)
  const showRotate = portrait && !rotateDismissed && (mode === 'menu' || inRun)

  return (
    <main className="fixed inset-0 h-dvh w-screen overflow-hidden bg-night text-white">
      <canvas ref={canvasRef} className="absolute inset-0 block size-full" aria-label="Chroma Rush game view" />

      {mode === 'menu' && (
        <MainMenu
          stats={playerData?.stats}
          isTelegram={telegram.active}
          telegramName={telegram.name}
          guestName={guestName}
          onGuestNameChange={(name) => {
            setGuestName(name)
            setGuestNameState(name)
          }}
          onPlay={handlePlay}
          onLeaderboard={() => setPanel('leaderboard')}
          onSettings={() => setPanel('settings')}
          onHowTo={() => setPanel('tutorial')}
        />
      )}

      {inRun && hud && (
        <>
          <TouchControls
            phase={hud.phase}
            onJumpDown={() => engineRef.current?.jumpPress()}
            onJumpUp={() => engineRef.current?.jumpRelease()}
            onSwitch={() => engineRef.current?.switchPhase()}
          />
          <Hud hud={hud} onPause={handlePause} />
        </>
      )}

      {mode === 'countdown' && countdown >= 0 && <CountdownOverlay value={countdown} />}
      {mode === 'respawning' && <CountdownOverlay value={-1} label="Get ready" />}
      {mode === 'dying' && death && <DeathBanner cause={death.cause} livesLeft={death.livesLeft} />}
      <Toasts items={toasts} />

      {mode === 'paused' && !panel && (
        <PauseMenu onResume={handleResume} onSettings={() => setPanel('settings')} onQuit={() => engineRef.current?.quitToMenu()} />
      )}

      {mode === 'over' && result && !panel && (
        <GameOver
          result={result}
          submit={submit}
          onRetry={handlePlay}
          onMenu={() => engineRef.current?.quitToMenu()}
          onLeaderboard={() => setPanel('leaderboard')}
          onShare={handleShare}
        />
      )}

      {panel === 'leaderboard' && <LeaderboardPanel onClose={() => setPanel(null)} />}
      {panel === 'settings' && <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setPanel(null)} />}
      {panel === 'tutorial' && (
        <TutorialPanel onDone={closeTutorial} ctaLabel={startAfterTutorial.current ? 'Start running' : 'Got it'} />
      )}

      {showRotate && <RotateHint onDismiss={() => setRotateDismissed(true)} />}
    </main>
  )
}
