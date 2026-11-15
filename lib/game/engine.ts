import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { AudioEngine } from './audio'
import { difficultyAt, PHYSICS, speedAt } from './difficulty'
import { EnvironmentManager } from './environment'
import { WorldGenerator } from './generator'
import { isMatchGate, obstacleClearance, obstacleHit } from './hazards'
import { ParticleSystem } from './particles'
import { PHASE_COLORS, PlayerModel } from './player-model'
import { isSolid, PLATFORM_THICKNESS, platformColor, platformTop } from './surfaces'
import type {
  ActivePowerUp,
  CrystalSpec,
  DeathCause,
  EngineEvents,
  EngineMode,
  HudState,
  ObstacleSpec,
  Phase,
  PlatformSpec,
  PowerUpType,
  Quality,
} from './types'
import { POWERUP_COLORS, WorldView } from './world-view'

export type QualitySetting = Quality | 'auto'

export const MAX_LIVES = 3

const POWERUP_DURATION: Record<PowerUpType, number> = {
  magnet: 10,
  shield: 0,
  multiplier: 10,
  slowmo: 6,
  surge: 8,
}

const POWERUP_LABEL: Record<PowerUpType, string> = {
  magnet: 'Crystal Magnet',
  shield: 'Phase Shield',
  multiplier: 'Score x2',
  slowmo: 'Time Warp',
  surge: 'Crystal Surge',
}

const STEP = 1 / 120

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export class GameEngine {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private composer: EffectComposer | null = null
  private bloom: UnrealBloomPass | null = null
  private env: EnvironmentManager
  private world: WorldView
  private gen: WorldGenerator
  private model = new PlayerModel()
  private particles: ParticleSystem
  readonly audio = new AudioEngine()

  mode: EngineMode = 'menu'
  private modeBeforePause: EngineMode = 'playing'
  private raf = 0
  private last = 0
  private disposed = false

  // Run state
  private seed = 1
  private runId = ''
  private t = 0
  private activeTime = 0
  private speed: number = PHYSICS.minSpeed
  private p = {
    z: 0,
    y: 0,
    vy: 0,
    grounded: true,
    jumps: 0,
    coyote: 0,
    buffer: 0,
    holding: false,
    phase: 'solar' as Phase,
    spin: 0,
    spinning: false,
    landing: 0,
    switchPulse: 0,
    lastGroundY: 0,
    lastSwitchAt: -10,
    airborneFromZ: 0,
  }
  private lives = MAX_LIVES
  private score = 0
  private crystals = 0
  private combo = 0
  private comboTimer = 0
  private maxCombo = 0
  private powerUps = new Map<PowerUpType, ActivePowerUp>()
  private shield = false
  private invuln = 0
  private deathTimer = 0
  private deathZ = 0
  private respawnTimer = 0
  private countdown = 0
  private lastCountdownValue = -1
  private hudTimer = 0
  private shake = 0
  private camPos = new THREE.Vector3(8, 4, -8)
  private camLook = new THREE.Vector3()
  private camY = 0
  private portrait = false
  private tmpColor = new THREE.Color()
  private dustColor = new THREE.Color('#d8dde6')

  // Quality
  private qualitySetting: QualitySetting = 'auto'
  private quality: Quality = 'high'
  private frameTimes: number[] = []
  private qualityCooldown = 0
  private resizeObserver: ResizeObserver | null = null

  constructor(
    private canvas: HTMLCanvasElement,
    private events: EngineEvents,
    quality: QualitySetting,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false })
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 1200)
    this.env = new EnvironmentManager(this.scene)
    this.world = new WorldView(this.scene)
    this.particles = new ParticleSystem(1800)
    this.scene.add(this.particles.points)
    this.scene.add(this.model.root)
    this.env.sun.target = this.model.root

    this.gen = new WorldGenerator({
      onPlatformAdded: (p) => this.world.addPlatform(p),
      onPlatformRemoved: (p) => this.world.removePlatform(p),
      onObstacleAdded: (o) => this.world.addObstacle(o),
      onObstacleRemoved: (o) => this.world.removeObstacle(o),
      onCrystalAdded: (c) => this.world.addCrystal(c),
      onCrystalRemoved: (c) => this.world.removeCrystal(c),
      onPowerUpAdded: (p) => this.world.addPowerUp(p),
      onPowerUpRemoved: (p) => this.world.removePowerUp(p),
    })

    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    this.qualitySetting = quality
    this.applyQuality(quality === 'auto' ? (isMobile ? 'medium' : 'high') : quality)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    if (canvas.parentElement) this.resizeObserver.observe(canvas.parentElement)
    this.resize()

    this.enterMenu()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  // ---------- public API ----------

  setQuality(q: QualitySetting) {
    this.qualitySetting = q
    if (q !== 'auto') this.applyQuality(q)
  }

  setVolumes(music: number, sfx: number) {
    this.audio.setVolumes(music, sfx)
  }

  unlockAudio() {
    this.audio.unlock()
    this.audio.startMusic()
  }

  enterMenu() {
    this.setMode('menu')
    this.seed = Math.floor(Math.random() * 1e9)
    this.gen.reset(this.seed, true)
    this.env.reset(this.seed)
    this.particles.clear()
    this.resetPlayer()
    this.t = 0
    this.speed = 9
    this.audio.intensity = 0
    this.model.setPhase('solar', true)
  }

  startRun(seed = Math.floor(Math.random() * 2 ** 31)) {
    this.seed = seed
    this.runId = uuid()
    this.gen.reset(seed, false)
    this.env.reset(seed)
    this.particles.clear()
    this.resetPlayer()
    this.t = 0
    this.activeTime = 0
    this.lives = MAX_LIVES
    this.score = 0
    this.crystals = 0
    this.combo = 0
    this.comboTimer = 0
    this.maxCombo = 0
    this.powerUps.clear()
    this.shield = false
    this.invuln = 0
    this.speed = speedAt(0)
    this.countdown = 3
    this.lastCountdownValue = -1
    this.model.setPhase('solar', true)
    this.gen.ensureAhead(300, () => 0)
    this.setMode('countdown')
    this.emitHud()
  }

  pause() {
    if (this.mode === 'paused' || this.mode === 'menu' || this.mode === 'over') return
    this.modeBeforePause = this.mode
    this.setMode('paused')
    this.audio.suspend()
  }

  resume() {
    if (this.mode !== 'paused') return
    this.audio.resume()
    this.setMode(this.modeBeforePause === 'playing' ? 'countdown' : this.modeBeforePause)
    if (this.mode === 'countdown') {
      this.countdown = 1.5
      this.lastCountdownValue = -1
    }
    this.last = performance.now()
  }

  quitToMenu() {
    this.audio.resume()
    this.enterMenu()
  }

  jumpPress() {
    if (this.mode !== 'playing') return
    const p = this.p
    if (p.grounded || p.coyote > 0) {
      this.doJump(PHYSICS.jumpVelocity, false)
    } else if (p.jumps < 2) {
      this.doJump(PHYSICS.doubleJumpVelocity, true)
    } else {
      p.buffer = PHYSICS.jumpBuffer
    }
  }

  jumpRelease() {
    const p = this.p
    if (p.holding && p.vy > 0 && p.jumps === 1) p.vy *= PHYSICS.jumpCutFactor
    p.holding = false
  }

  switchPhase() {
    if (this.mode !== 'playing' && this.mode !== 'respawning' && this.mode !== 'countdown') return
    const p = this.p
    p.phase = p.phase === 'solar' ? 'ion' : 'solar'
    p.switchPulse = 1
    p.lastSwitchAt = this.t
    this.model.setPhase(p.phase)
    this.audio.play('switch')
    this.events.onHaptic('light')
    const c = PHASE_COLORS[p.phase]
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      this.particles.emit({ x: 0, y: p.y + 0.65, z: p.z, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, vz: this.speed * 0.6, color: c, life: 0.35, size: 0.22, drag: 4 })
    }
    this.emitHud()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver?.disconnect()
    this.audio.dispose()
    this.world.clearAll()
    this.composer?.dispose()
    this.renderer.dispose()
  }

  // ---------- internals ----------

  private setMode(m: EngineMode) {
    this.mode = m
    this.events.onModeChange(m)
  }

  private applyQuality(q: Quality) {
    this.quality = q
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    const pr = q === 'high' ? Math.min(dpr, 2) : q === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, 1)
    this.renderer.setPixelRatio(pr)
    const shadows = q !== 'low'
    this.renderer.shadowMap.enabled = shadows
    this.env.sun.castShadow = shadows
    this.env.sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024)
    this.env.sun.shadow.map?.dispose()
    this.env.sun.shadow.map = null
    this.world.shadows = shadows
    this.env.setQuality(q, pr)
    this.particles.setPixelRatio(pr)
    this.particles.budget = q === 'low' ? 0.4 : q === 'medium' ? 0.7 : 1

    this.composer?.dispose()
    this.composer = null
    this.bloom = null
    if (q !== 'low') {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
      const target = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
        type: THREE.HalfFloatType,
        samples: q === 'high' ? 4 : 0,
      })
      this.composer = new EffectComposer(this.renderer, target)
      this.composer.addPass(new RenderPass(this.scene, this.camera))
      const res = new THREE.Vector2(size.x / (q === 'high' ? 2 : 3), size.y / (q === 'high' ? 2 : 3))
      this.bloom = new UnrealBloomPass(res, 0.75, 0.55, 0.78)
      this.composer.addPass(this.bloom)
      this.composer.addPass(new OutputPass())
    }
    this.resize()
  }

  private resize() {
    const parent = this.canvas.parentElement
    if (!parent) return
    const w = Math.max(1, parent.clientWidth)
    const h = Math.max(1, parent.clientHeight)
    this.renderer.setSize(w, h, false)
    this.composer?.setPixelRatio(this.renderer.getPixelRatio())
    this.composer?.setSize(w, h)
    this.camera.aspect = w / h
    this.portrait = h > w
    this.camera.updateProjectionMatrix()
  }

  private resetPlayer() {
    const p = this.p
    p.z = 0
    p.y = 0
    p.vy = 0
    p.grounded = true
    p.jumps = 0
    p.coyote = 0
    p.buffer = 0
    p.holding = false
    p.phase = 'solar'
    p.spin = 0
    p.spinning = false
    p.landing = 0
    p.switchPulse = 0
    p.lastGroundY = 0
    p.lastSwitchAt = -10
    this.camY = 0
    this.model.root.visible = true
  }

  private doJump(v: number, isDouble: boolean) {
    const p = this.p
    p.vy = v
    p.grounded = false
    p.coyote = 0
    p.buffer = 0
    p.holding = !isDouble
    p.airborneFromZ = p.z
    if (isDouble) {
      p.jumps = 2
      p.spinning = true
      p.spin = 0
      this.audio.play('doubleJump')
      this.events.onHaptic('light')
      const c = PHASE_COLORS[p.phase]
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2
        this.particles.emit({ x: Math.cos(a) * 0.3, y: p.y + 0.2, z: p.z + Math.sin(a) * 0.3, vx: Math.cos(a) * 4, vy: -2, vz: Math.sin(a) * 4 + this.speed * 0.5, color: c, life: 0.4, size: 0.2, drag: 3 })
      }
    } else {
      p.jumps = 1
      this.audio.play('jump')
      this.particles.burst(8, { x: 0, y: p.y + 0.05, z: p.z, vy: 1.5, vz: -2, spread: 3, color: this.dustColor, life: 0.4, size: 0.2, drag: 3 })
    }
  }

  private platformAt(z: number): PlatformSpec | null {
    for (const pl of this.gen.platforms) {
      if (pl.z0 > z) return null
      if (z <= pl.z1) return pl
    }
    return null
  }

  private comboMultiplier() {
    return Math.min(5, 1 + Math.floor(this.combo / 5) * 0.5)
  }

  private totalMultiplier() {
    return this.comboMultiplier() * (this.powerUps.has('multiplier') ? 2 : 1)
  }

  private addCombo(points: number) {
    this.combo++
    this.maxCombo = Math.max(this.maxCombo, this.combo)
    this.comboTimer = 4
    this.score += points * this.totalMultiplier()
    if (this.combo > 0 && this.combo % 10 === 0) {
      this.events.onToast(`Combo x${this.comboMultiplier().toFixed(1)}`, 'neutral')
    }
  }

  private step(dt: number) {
    const p = this.p
    const d = difficultyAt(this.activeTime)
    this.speed = speedAt(d)
    this.activeTime += dt
    this.t += dt
    this.audio.intensity = Math.min(1, d * 1.4)

    for (const [type, pu] of this.powerUps) {
      pu.remaining -= dt
      if (pu.remaining <= 0) this.powerUps.delete(type)
    }
    if (this.invuln > 0) this.invuln -= dt
    if (p.coyote > 0) p.coyote -= dt
    if (p.buffer > 0) p.buffer -= dt
    if (this.comboTimer > 0) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0) this.combo = 0
    }

    const prevZ = p.z
    const prevY = p.y
    p.z += this.speed * dt

    if (!p.grounded) {
      p.vy -= PHYSICS.gravity * dt
      p.y += p.vy * dt
      if (p.spinning) {
        p.spin += dt / 0.42
        if (p.spin >= 1) {
          p.spin = 0
          p.spinning = false
        }
      }
    }

    // Front-face collisions with the next platform.
    const hd = PHYSICS.playerHalfDepth
    for (const q of this.gen.platforms) {
      if (q.z0 > p.z + hd) break
      if (q.z0 <= prevZ + hd || !isSolid(q)) continue
      const top = platformTop(q, this.t)
      if (p.y < top - 0.35 && p.y + PHYSICS.playerHeight > top - PLATFORM_THICKNESS) {
        if (this.invuln > 0) {
          p.y = top
          this.land(q, top)
        } else {
          this.die('wall')
          return
        }
      }
    }

    const plat = this.platformAt(p.z)
    if (p.grounded) {
      if (!plat || !isSolid(plat)) {
        p.grounded = false
        p.coyote = PHYSICS.coyoteTime
        p.jumps = 1
        p.airborneFromZ = p.z
      } else {
        const top = platformTop(plat, this.t)
        if (top < p.y - 0.45) {
          p.grounded = false
          p.coyote = PHYSICS.coyoteTime
          p.jumps = 1
          p.airborneFromZ = p.z
        } else {
          p.y = top
          p.lastGroundY = top
        }
      }
    } else if (p.vy <= 0 && plat && isSolid(plat)) {
      const top = platformTop(plat, this.t)
      if (prevY >= top - 0.3 && p.y <= top) this.land(plat, top)
    }

    if (p.grounded && plat) {
      const surface = platformColor(plat, this.t)
      if (surface !== 'neutral' && surface !== p.phase) {
        if (!this.colorFail(surface)) return
      }
      if (plat.kind === 'collapsing' && plat.touchedAt < 0) plat.touchedAt = this.t
    }

    for (const q of this.gen.platforms) {
      if (q.kind !== 'collapsing' || q.touchedAt < 0) continue
      if (this.t - q.touchedAt > 0.5) {
        q.dropVelocity += 32 * dt
        q.dropOffset -= q.dropVelocity * dt
      }
    }

    // Obstacles
    for (const o of this.gen.obstacles) {
      if (o.z > p.z + 3) break
      if (o.z < p.z - 3) continue
      if (obstacleHit(o, p.z, p.y, this.speed, this.t, p.phase)) {
        if (!this.hazardHit(o)) return
      }
      if (!o.passed && o.z < p.z - 0.4) {
        o.passed = true
        if (o.kind === 'autoGate') {
          if (p.phase !== o.color) {
            p.phase = o.color
            p.switchPulse = 1
            p.lastSwitchAt = this.t
            this.model.setPhase(o.color)
            this.events.onToast('Auto-switch', o.color)
          }
          this.audio.play('switch')
        } else if (isMatchGate(o.kind)) {
          this.addCombo(15)
          this.audio.play('gate')
        } else {
          const clearance = obstacleClearance(o, p.z, p.y, this.speed, this.t)
          if (clearance < 0.55 && this.invuln <= 0) {
            this.addCombo(30)
            this.audio.play('nearMiss')
            this.events.onToast('Near miss', 'neutral')
          }
        }
      }
    }

    this.collectCrystals()
    this.collectPowerUps()

    if (p.y < p.lastGroundY - 16) {
      this.die('fall')
      return
    }

    this.score += (p.z - prevZ) * this.totalMultiplier()

    this.gen.ensureAhead(p.z + 300, (z) => difficultyAt(this.activeTime + (z - p.z) / this.speed))
    this.gen.cullBehind(p.z - 40)
  }

  private land(plat: PlatformSpec, top: number) {
    const p = this.p
    const airDistance = p.z - p.airborneFromZ
    p.y = top
    p.vy = 0
    p.grounded = true
    p.jumps = 0
    p.spinning = false
    p.spin = 0
    p.landing = 1
    p.lastGroundY = top
    this.audio.play('land')
    this.particles.burst(10, { x: 0, y: top + 0.05, z: p.z, vy: 2, vz: this.speed * 0.3, spread: 4, color: this.dustColor, life: 0.45, size: 0.22, drag: 4 })
    const surface = platformColor(plat, this.t)
    if (airDistance > 4 && p.z - plat.z0 < 1.8) {
      this.addCombo(10)
      this.events.onToast('Perfect landing', 'neutral')
    } else if (surface !== 'neutral' && surface === p.phase && this.t - p.lastSwitchAt < 0.3) {
      this.addCombo(20)
      this.events.onToast('Perfect switch', p.phase)
    }
    if (p.buffer > 0) this.doJump(PHYSICS.jumpVelocity, false)
  }

  /** Returns true if the run continues. */
  private colorFail(surface: Phase) {
    if (this.invuln > 0) return true
    if (this.shield) {
      this.consumeShield()
      this.p.phase = surface
      this.model.setPhase(surface)
      return true
    }
    this.die('color')
    return false
  }

  private hazardHit(o: ObstacleSpec) {
    if (this.invuln > 0) return true
    if (this.shield) {
      this.consumeShield()
      return true
    }
    this.die(isMatchGate(o.kind) ? 'gate' : 'hazard')
    return false
  }

  private consumeShield() {
    this.shield = false
    this.invuln = 1.2
    this.audio.play('shield')
    this.events.onHaptic('medium')
    this.events.onToast('Shield absorbed the hit', 'neutral')
    const c = POWERUP_COLORS.shield
    this.particles.burst(40, { x: 0, y: this.p.y + 0.6, z: this.p.z, spread: 12, vz: this.speed * 0.5, color: c, life: 0.6, size: 0.3, drag: 3 })
    this.emitHud()
  }

  private collectCrystals() {
    const p = this.p
    const cy = p.y + 0.6
    for (const c of this.gen.crystals) {
      if (c.collected) continue
      const dz = c.z - p.z
      if (dz > 2) break
      if (dz < -2) continue
      const dy = c.y - cy
      if (dz * dz + dy * dy + c.x * c.x < (c.bonus ? 1.3 : 1.0)) {
        c.collected = true
        this.world.hideCrystal(c)
        this.crystals += c.bonus ? 5 : 1
        const value = (c.bonus ? 150 : 20) * (this.powerUps.has('surge') ? 1.5 : 1)
        this.addCombo(value)
        this.audio.play(c.bonus ? 'bonus' : 'crystal')
        const col = c.bonus ? POWERUP_COLORS.surge : POWERUP_COLORS.multiplier
        this.particles.burst(c.bonus ? 24 : 8, { x: c.x, y: c.y, z: c.z, vz: this.speed * 0.7, spread: 5, color: col, life: 0.4, size: 0.2, drag: 3 })
      }
    }
  }

  private collectPowerUps() {
    const p = this.p
    for (const pu of this.gen.powerUps) {
      if (pu.collected) continue
      const dz = pu.z - p.z
      if (dz > 2) break
      if (Math.abs(dz) < 1.1 && Math.abs(pu.y - (p.y + 0.6)) < 1.6) {
        pu.collected = true
        this.world.hidePowerUp(pu)
        this.activatePowerUp(pu.type)
      }
    }
  }

  private activatePowerUp(type: PowerUpType) {
    if (type === 'shield') this.shield = true
    else this.powerUps.set(type, { type, remaining: POWERUP_DURATION[type], duration: POWERUP_DURATION[type] })
    if (type === 'surge') this.gen.activateSurge(this.p.z + this.speed * POWERUP_DURATION.surge + 120)
    this.audio.play('powerup')
    this.events.onHaptic('success')
    this.events.onToast(POWERUP_LABEL[type], 'neutral')
    this.particles.burst(30, { x: 0, y: this.p.y + 0.6, z: this.p.z, spread: 10, vz: this.speed * 0.6, color: POWERUP_COLORS[type], life: 0.6, size: 0.28, drag: 3 })
    this.emitHud()
  }

  private die(cause: DeathCause) {
    const p = this.p
    this.lives--
    this.deathZ = p.z
    this.deathTimer = 1.15
    this.combo = 0
    this.comboTimer = 0
    this.powerUps.clear()
    this.shake = 0.7
    this.setMode('dying')
    this.audio.play('death')
    this.events.onHaptic('error')
    this.events.onDeath({ cause, livesLeft: this.lives })
    this.model.root.visible = false
    const c = PHASE_COLORS[p.phase]
    this.particles.burst(70, { x: 0, y: p.y + 0.6, z: p.z, spread: 16, vy: 3, vz: this.speed * 0.3, color: c, life: 0.9, size: 0.32, gravity: 12, drag: 1.2 })
    this.particles.burst(30, { x: 0, y: p.y + 0.6, z: p.z, spread: 10, color: this.world.hazardColor, life: 0.6, size: 0.25, drag: 2 })
    this.emitHud()
  }

  private beginRespawn() {
    const p = this.p
    const list = this.gen.platforms
    let idx = list.findIndex((q) => q.z1 > this.deathZ + 1)
    if (idx < 0) idx = 0
    for (let i = Math.max(0, idx - 1); i < Math.min(list.length, idx + 8); i++) {
      const q = list[i]
      if (q.kind === 'collapsing') {
        q.touchedAt = -1
        q.dropOffset = 0
        q.dropVelocity = 0
      }
    }
    let q = list[idx]
    let z = Math.max(q.z0 + 0.8, Math.min(this.deathZ, q.z1))
    if (q.z1 - z < this.speed * 0.6 && list[idx + 1]) {
      q = list[idx + 1]
      z = q.z0 + 0.8
    }
    for (const o of this.gen.obstacles) {
      if (o.z > z - 1 && o.z < z + 2.5) o.passed = true
    }
    p.z = z
    p.y = platformTop(q, this.t)
    p.lastGroundY = p.y
    p.vy = 0
    p.grounded = true
    p.jumps = 0
    p.coyote = 0
    p.buffer = 0
    p.spin = 0
    p.spinning = false
    const surface = platformColor(q, this.t)
    if (surface !== 'neutral' && surface !== p.phase) {
      p.phase = surface
      this.model.setPhase(surface, true)
    }
    this.model.root.visible = true
    this.respawnTimer = 1.3
    this.setMode('respawning')
    this.audio.play('respawn')
    this.particles.burst(40, { x: 0, y: p.y + 0.6, z: p.z, spread: 6, vy: 4, color: PHASE_COLORS[p.phase], life: 0.8, size: 0.25, drag: 2 })
    this.emitHud()
  }

  private gameOver() {
    this.setMode('over')
    this.audio.intensity = 0
    this.emitHud()
    this.events.onGameOver({
      runId: this.runId,
      score: Math.floor(this.score),
      distance: Math.floor(this.p.z),
      crystals: this.crystals,
      durationMs: Math.floor(this.activeTime * 1000),
      seed: this.seed,
      livesUsed: MAX_LIVES - this.lives,
      maxCombo: this.maxCombo,
    })
  }

  private emitHud() {
    const hud: HudState = {
      distance: Math.max(0, Math.floor(this.p.z)),
      score: Math.floor(this.score),
      crystals: this.crystals,
      phase: this.p.phase,
      combo: this.combo,
      multiplier: this.totalMultiplier(),
      lives: this.lives,
      maxLives: MAX_LIVES,
      powerUps: [...this.powerUps.values()].map((p) => ({ ...p })),
      shield: this.shield,
      biome: this.env.currentBiomeName,
      speed: this.speed,
      invulnerable: this.invuln > 0,
    }
    this.events.onHud(hud)
  }

  private menuStep(dt: number) {
    this.t += dt
    const p = this.p
    p.z += this.speed * dt
    const plat = this.platformAt(p.z)
    if (p.grounded && !plat) {
      // Autopilot hop over demo gaps.
      p.vy = PHYSICS.jumpVelocity * 0.85
      p.grounded = false
    }
    if (!p.grounded) {
      p.vy -= PHYSICS.gravity * dt
      p.y += p.vy * dt
      const top = plat ? platformTop(plat, this.t) : -Infinity
      if (p.vy <= 0 && p.y <= top) {
        p.y = top
        p.vy = 0
        p.grounded = true
      }
      if (p.y < -10) {
        p.y = 0
        p.vy = 0
        p.grounded = true
      }
    }
    const ahead = this.platformAt(p.z + 2.5)
    if (p.grounded && !ahead) {
      p.vy = PHYSICS.jumpVelocity * 0.85
      p.grounded = false
    }
    if (Math.floor(this.t / 2.5) !== Math.floor((this.t - dt) / 2.5)) {
      p.phase = p.phase === 'solar' ? 'ion' : 'solar'
      p.switchPulse = 1
      this.model.setPhase(p.phase)
    }
    this.gen.ensureAhead(p.z + 300, () => 0)
    this.gen.cullBehind(p.z - 40)
  }

  private updateCamera(dt: number) {
    const p = this.p
    const menu = this.mode === 'menu'
    const targetY = p.grounded ? p.y : p.lastGroundY * 0.55 + p.y * 0.45
    this.camY += (targetY - this.camY) * Math.min(1, dt * 4)

    let ox: number
    let oy: number
    let oz: number
    let lookAhead: number
    if (menu) {
      const a = this.t * 0.18
      ox = 7 + Math.sin(a) * 2.5
      oy = 2.4 + Math.sin(a * 0.7) * 0.6
      oz = -3 + Math.cos(a) * 3
      lookAhead = 3
    } else if (this.portrait) {
      ox = 5.5
      oy = 4.6
      oz = -9.5
      lookAhead = 11
    } else {
      ox = 8.5
      oy = 3.4
      oz = -6.5
      lookAhead = 8.5
    }
    const target = new THREE.Vector3(ox, this.camY + oy, p.z + oz)
    this.camPos.lerp(target, Math.min(1, dt * (menu ? 2 : 6)))
    this.camPos.z = p.z + oz
    this.camLook.set(0, this.camY + 0.9, p.z + lookAhead)

    this.camera.position.copy(this.camPos)
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.8)
      const s = this.shake * this.shake * 0.6
      this.camera.position.x += (Math.random() - 0.5) * s
      this.camera.position.y += (Math.random() - 0.5) * s
    }
    this.camera.lookAt(this.camLook)
    const baseFov = this.portrait ? 72 : 55
    const fov = baseFov + (menu ? 0 : (this.speed - PHYSICS.minSpeed) * 0.55)
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3)
      this.camera.updateProjectionMatrix()
    }
  }

  private adaptQuality(dt: number) {
    if (this.qualitySetting !== 'auto') return
    this.frameTimes.push(dt)
    if (this.frameTimes.length < 120) return
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    this.frameTimes = []
    if (this.qualityCooldown > 0) {
      this.qualityCooldown--
      return
    }
    const fps = 1 / avg
    if (fps < 40 && this.quality !== 'low') {
      this.applyQuality(this.quality === 'high' ? 'medium' : 'low')
      this.qualityCooldown = 3
    }
  }

  private frame = (now: number) => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.frame)
    const rawDt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    if (document.hidden) return

    const timeScale = this.powerUps.has('slowmo') ? 0.62 : 1
    const dt = rawDt * timeScale
    const p = this.p

    switch (this.mode) {
      case 'menu':
        this.menuStep(dt)
        break
      case 'countdown': {
        this.countdown -= rawDt
        const value = Math.ceil(this.countdown)
        if (value !== this.lastCountdownValue) {
          this.lastCountdownValue = value
          this.events.onCountdown(Math.max(0, value))
          this.audio.play(value > 0 ? 'countdown' : 'go')
        }
        if (this.countdown <= 0) {
          this.setMode('playing')
          this.events.onCountdown(-1)
        }
        break
      }
      case 'playing': {
        let remaining = dt
        while (remaining > 1e-6 && this.mode === 'playing') {
          const h = Math.min(STEP, remaining)
          this.step(h)
          remaining -= h
        }
        this.hudTimer -= rawDt
        if (this.hudTimer <= 0) {
          this.hudTimer = 0.1
          this.emitHud()
        }
        if (this.mode === 'playing') {
          const c = PHASE_COLORS[p.phase]
          const trail = this.quality === 'low' ? 1 : 2
          for (let i = 0; i < trail; i++) {
            this.particles.emit({ x: (Math.random() - 0.5) * 0.3, y: p.y + 0.55 + Math.random() * 0.3, z: p.z - 0.6, vz: -1.5, spread: 0.6, color: c, life: 0.32, size: 0.2, drag: 2 })
          }
          if (this.powerUps.has('magnet') || this.shield) {
            const col = this.shield ? POWERUP_COLORS.shield : POWERUP_COLORS.magnet
            const a = this.t * 10
            this.particles.emit({ x: Math.cos(a) * 0.9, y: p.y + 0.6 + Math.sin(a) * 0.9, z: p.z, vz: this.speed * 0.8, color: col, life: 0.25, size: 0.18 })
          }
        }
        break
      }
      case 'dying':
        this.deathTimer -= rawDt
        if (this.deathTimer <= 0) {
          if (this.lives > 0) this.beginRespawn()
          else this.gameOver()
        }
        break
      case 'respawning':
        this.respawnTimer -= rawDt
        if (this.respawnTimer <= 0) {
          this.invuln = 2.2
          this.setMode('playing')
          this.emitHud()
        }
        break
      case 'paused':
      case 'over':
        break
    }

    p.switchPulse = Math.max(0, p.switchPulse - rawDt * 3.5)
    p.landing = Math.max(0, p.landing - rawDt * 6)
    const moving = this.mode === 'playing' || this.mode === 'menu'
    this.model.root.position.set(0, p.y, p.z)
    this.model.update(rawDt, {
      grounded: p.grounded,
      vy: p.vy,
      speed: moving ? this.speed : 0,
      spin: p.spin,
      landing: p.landing,
      switchPulse: p.switchPulse,
      invulnerable: (this.invuln > 0 && this.mode === 'playing') || this.mode === 'respawning',
      time: now / 1000,
    })
    if (this.mode === 'dying' || this.mode === 'over') this.model.root.visible = false

    this.world.update(this.t, p.z, this.speed, this.magnetPull)
    if (this.mode !== 'paused') this.particles.update(rawDt)
    this.updateCamera(rawDt)
    this.env.update(p.z, this.camera.position, now / 1000, rawDt)
    this.env.sun.position.set(12, p.y + 24, p.z - 8)

    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)

    this.adaptQuality(rawDt)
  }

  private magnetPull = (c: CrystalSpec) => {
    if (this.mode !== 'playing' || !this.powerUps.has('magnet') || c.collected) return
    const p = this.p
    const dz = p.z - c.z
    const dy = p.y + 0.6 - c.y
    const dist = Math.hypot(dz, dy, c.x)
    if (dist > 9 || dist < 0.01) return
    const k = Math.min(1, 0.18 + (9 - dist) * 0.02)
    c.z += dz * k
    c.y += dy * k
    c.x -= c.x * k
  }

  get currentTint() {
    return this.tmpColor
  }
}
