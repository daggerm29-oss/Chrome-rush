import {
  createRng,
  DOUBLE_JUMP_HEIGHT,
  doubleJumpAirTime,
  type Rng,
  SINGLE_JUMP_HEIGHT,
  singleJumpAirTime,
  speedAt,
} from './difficulty'
import type {
  CrystalSpec,
  ObstacleKind,
  ObstacleSpec,
  Phase,
  PlatformKind,
  PlatformSpec,
  PowerUpSpec,
  PowerUpType,
  SurfaceColor,
} from './types'

type Pattern =
  | 'runway'
  | 'gapChain'
  | 'stairs'
  | 'alternating'
  | 'moving'
  | 'collapse'
  | 'gauntlet'
  | 'gates'

interface Section {
  platforms: PlatformSpec[]
  obstacles: ObstacleSpec[]
  crystals: CrystalSpec[]
  powerUps: PowerUpSpec[]
}

export interface GeneratorListener {
  onPlatformAdded: (p: PlatformSpec) => void
  onPlatformRemoved: (p: PlatformSpec) => void
  onObstacleAdded: (o: ObstacleSpec) => void
  onObstacleRemoved: (o: ObstacleSpec) => void
  onCrystalAdded: (c: CrystalSpec) => void
  onCrystalRemoved: (c: CrystalSpec) => void
  onPowerUpAdded: (p: PowerUpSpec) => void
  onPowerUpRemoved: (p: PowerUpSpec) => void
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const opposite = (p: Phase): Phase => (p === 'solar' ? 'ion' : 'solar')

export class WorldGenerator {
  platforms: PlatformSpec[] = []
  obstacles: ObstacleSpec[] = []
  crystals: CrystalSpec[] = []
  powerUps: PowerUpSpec[] = []

  private rng: Rng = createRng(1)
  private nextId = 1
  private cursorZ = 0
  private cursorY = 0
  private lastColor: Phase = 'solar'
  private demo = false
  private surgeUntilZ = -1
  private nextPowerUpZ = 350
  private rejectedSections = 0

  constructor(private listener: GeneratorListener) {}

  get rejected() {
    return this.rejectedSections
  }

  reset(seed: number, demo = false) {
    for (const p of this.platforms) this.listener.onPlatformRemoved(p)
    for (const o of this.obstacles) this.listener.onObstacleRemoved(o)
    for (const c of this.crystals) this.listener.onCrystalRemoved(c)
    for (const p of this.powerUps) this.listener.onPowerUpRemoved(p)
    this.platforms = []
    this.obstacles = []
    this.crystals = []
    this.powerUps = []
    this.rng = createRng(seed)
    this.nextId = 1
    this.cursorZ = -30
    this.cursorY = 0
    this.lastColor = 'solar'
    this.demo = demo
    this.surgeUntilZ = -1
    this.nextPowerUpZ = 350 + this.rng.range(0, 150)
    this.rejectedSections = 0
    // Generous starting runway.
    this.commit({
      platforms: [this.makePlatform(this.cursorZ, demo ? 400 : 95, 0, 'neutral', 'static', 3.4)],
      obstacles: [],
      crystals: [],
      powerUps: [],
    })
    if (!demo) {
      const starter = this.platforms[0]
      for (let z = 30; z < starter.z1 - 10; z += 2.4) {
        if (Math.floor(z / 10) % 2 === 0) this.addCrystal(z, starter.y + 1, false, this.crystalsBuffer)
      }
      this.flushCrystals()
    }
  }

  activateSurge(untilZ: number) {
    this.surgeUntilZ = untilZ
  }

  ensureAhead(targetZ: number, difficultyAtZ: (z: number) => number) {
    let guard = 0
    while (this.cursorZ < targetZ && guard++ < 40) {
      const d = difficultyAtZ(this.cursorZ)
      if (this.demo) {
        const len = this.rng.range(60, 120)
        const gap = this.rng.range(3, 5)
        this.commit({
          platforms: [this.makePlatform(this.cursorZ + gap, len, this.cursorY, 'neutral', 'static', 3.2)],
          obstacles: [],
          crystals: [],
          powerUps: [],
        })
        continue
      }
      const section = this.buildSection(d)
      if (this.validate(section, d)) {
        this.commit(section)
      } else {
        this.rejectedSections++
        this.commit(this.buildSafeRunway(d))
      }
    }
  }

  cullBehind(z: number) {
    while (this.platforms.length && this.platforms[0].z1 < z) {
      this.listener.onPlatformRemoved(this.platforms.shift()!)
    }
    while (this.obstacles.length && this.obstacles[0].z < z) {
      this.listener.onObstacleRemoved(this.obstacles.shift()!)
    }
    while (this.crystals.length && this.crystals[0].z < z) {
      this.listener.onCrystalRemoved(this.crystals.shift()!)
    }
    while (this.powerUps.length && this.powerUps[0].z < z) {
      this.listener.onPowerUpRemoved(this.powerUps.shift()!)
    }
  }

  // ---------- section building ----------

  private crystalsBuffer: CrystalSpec[] = []

  private flushCrystals() {
    const list = this.crystalsBuffer.sort((a, b) => a.z - b.z)
    for (const c of list) {
      this.crystals.push(c)
      this.listener.onCrystalAdded(c)
    }
    this.crystals.sort((a, b) => a.z - b.z)
    this.crystalsBuffer = []
  }

  private makePlatform(
    z0: number,
    length: number,
    y: number,
    color: SurfaceColor,
    kind: PlatformKind,
    width: number,
    extra: Partial<PlatformSpec> = {},
  ): PlatformSpec {
    return {
      id: this.nextId++,
      z0,
      z1: z0 + length,
      y,
      width,
      color,
      kind,
      period: 2,
      phaseOffset: 0,
      amplitude: 0,
      touchedAt: -1,
      dropOffset: 0,
      dropVelocity: 0,
      hasFrame: this.rng.chance(0.28),
      ...extra,
    }
  }

  private pickColor(d: number): SurfaceColor {
    const coloredChance = 0.18 + 0.62 * d
    if (!this.rng.chance(coloredChance)) return 'neutral'
    const switchChance = 0.35 + 0.5 * d
    const c = this.rng.chance(switchChance) ? opposite(this.lastColor) : this.lastColor
    this.lastColor = c
    return c
  }

  private widthFor(d: number) {
    return lerp(3.4, 1.6, Math.min(1, d * 1.1)) * this.rng.range(0.9, 1.1)
  }

  private choosePattern(d: number): Pattern {
    return this.rng.weighted<Pattern>([
      ['runway', lerp(3, 1, d)],
      ['gapChain', lerp(2.5, 3, d)],
      ['stairs', d > 0.05 ? 1.4 : 0.4],
      ['gates', d > 0.08 ? 1.2 : 0],
      ['moving', d > 0.15 ? lerp(0.6, 1.6, d) : 0],
      ['alternating', d > 0.2 ? lerp(0.6, 1.8, d) : 0],
      ['collapse', d > 0.25 ? lerp(0.5, 1.4, d) : 0],
      ['gauntlet', d > 0.35 ? lerp(0.6, 2, d) : 0],
    ])
  }

  private gapRange(d: number, speed: number, dy: number, allowDouble: boolean) {
    const single = speed * singleJumpAirTime(Math.max(0, dy)) * 0.62
    const dbl = speed * doubleJumpAirTime(Math.max(0, dy)) * 0.6
    const max = allowDouble ? lerp(single, dbl, Math.min(1, d * 1.4)) : single
    return { min: Math.min(2.2 + d * 2, max * 0.7), max: Math.max(2.2, max) }
  }

  private buildSection(d: number): Section {
    const pattern = this.choosePattern(d)
    switch (pattern) {
      case 'runway':
        return this.buildRunway(d, false)
      case 'gauntlet':
        return this.buildRunway(d, true)
      case 'gates':
        return this.buildGates(d)
      case 'gapChain':
        return this.buildGapChain(d, 0)
      case 'stairs':
        return this.buildGapChain(d, this.rng.chance(0.5) ? 1 : -1)
      case 'moving':
        return this.buildMoving(d)
      case 'alternating':
        return this.buildAlternating(d)
      case 'collapse':
        return this.buildCollapse(d)
    }
  }

  private startSection(): Section {
    return { platforms: [], obstacles: [], crystals: [], powerUps: [] }
  }

  private nextGap(d: number, speed: number, dy = 0, allowDouble = true) {
    const { min, max } = this.gapRange(d, speed, dy, allowDouble)
    return this.rng.range(min, max)
  }

  private clampY(y: number) {
    return Math.max(-6, Math.min(8, y))
  }

  private buildSafeRunway(d: number): Section {
    const s = this.startSection()
    const speed = speedAt(d)
    const gap = this.rng.range(2, 3.5)
    const p = this.makePlatform(this.cursorZ + gap, speed * 2.2 + 10, this.cursorY, 'neutral', 'static', 3)
    s.platforms.push(p)
    this.crystalLine(p, s)
    return s
  }

  private buildRunway(d: number, gauntlet: boolean): Section {
    const s = this.startSection()
    const speed = speedAt(d)
    const dy = this.rng.range(-1.2, 0.8)
    const gap = this.nextGap(d, speed, dy, false)
    const len = gauntlet ? this.rng.range(speed * 5, speed * 7) : this.rng.range(lerp(38, 22, d), lerp(60, 34, d))
    const p = this.makePlatform(
      this.cursorZ + gap,
      len,
      this.clampY(this.cursorY + dy),
      this.pickColor(d),
      'static',
      this.widthFor(d),
    )
    s.platforms.push(p)
    this.populateObstacles(p, d, speed, s, gauntlet ? 1.8 : 1)
    this.crystalArc(this.cursorZ, this.cursorY, p, speed, s)
    this.crystalLine(p, s)
    this.maybePowerUp(p, s)
    return s
  }

  private buildGates(d: number): Section {
    const s = this.startSection()
    const speed = speedAt(d)
    const gap = this.nextGap(d, speed, 0, false)
    const len = speed * this.rng.range(3.5, 5)
    const p = this.makePlatform(this.cursorZ + gap, len, this.cursorY, 'neutral', 'static', this.widthFor(d))
    s.platforms.push(p)
    const count = this.rng.int(1, 1 + Math.round(d * 3))
    const before = speed * 0.7 + 3
    const span = len - before - speed * 0.5
    let color: Phase = this.rng.chance(0.5) ? 'solar' : 'ion'
    const spacing = Math.max(speed * 0.75 + 2, span / count)
    for (let i = 0; i < count; i++) {
      const z = p.z0 + before + i * spacing
      if (z > p.z1 - speed * 0.4) break
      s.obstacles.push(this.makeObstacle('colorGate', z, p.y, color))
      color = this.rng.chance(0.5 + d * 0.4) ? opposite(color) : color
    }
    this.crystalArc(this.cursorZ, this.cursorY, p, speed, s)
    this.crystalLine(p, s)
    return s
  }

  private buildGapChain(d: number, stairDir: number): Section {
    const s = this.startSection()
    const speed = speedAt(d)
    const n = this.rng.int(2, 3 + Math.round(d * 3))
    let z = this.cursorZ
    let y = this.cursorY
    for (let i = 0; i < n; i++) {
      const dy =
        stairDir === 0
          ? this.rng.range(-1.4, lerp(0.6, 1.6, d))
          : stairDir * this.rng.range(0.7, lerp(1.2, 2.2, d))
      const ny = this.clampY(y + dy)
      const realDy = ny - y
      const gap = this.nextGap(d, speed, realDy, true)
      const len = this.rng.range(speed * 0.55 + 3.5, lerp(speed * 1.6 + 6, speed * 0.9 + 4, d))
      const p = this.makePlatform(z + gap, len, ny, this.pickColor(d), 'static', this.widthFor(d))
      s.platforms.push(p)
      this.crystalArc(z, y, p, speed, s)
      if (len > speed * 1.6 + 6 && this.rng.chance(0.4 + d * 0.4)) this.populateObstacles(p, d, speed, s, 0.6)
      if (this.rng.chance(0.15)) this.bonusCrystal(z, gap, y, s)
      z = p.z1
      y = ny
    }
    return s
  }

  private buildMoving(d: number): Section {
    const s = this.startSection()
    const speed = speedAt(d)
    const n = this.rng.int(1, 2 + Math.round(d * 2))
    let z = this.cursorZ
    let y = this.cursorY
    for (let i = 0; i < n; i++) {
      const amplitude = this.rng.range(0.6, lerp(1.1, 1.8, d))
      const baseY = this.clampY(y + this.rng.range(-0.8, 0.4))
      const worstDy = baseY + amplitude - y
      const gap = this.nextGap(d, speed, worstDy, true)
      const len = this.rng.range(speed * 0.6 + 4, speed * 0.9 + 6)
      const p = this.makePlatform(z + gap, len, baseY, this.pickColor(d), 'moving', this.widthFor(d), {
        amplitude,
        period: this.rng.range(lerp(3, 1.8, d), lerp(4, 2.4, d)),
        phaseOffset: this.rng.range(0, Math.PI * 2),
        hasFrame: false,
      })
      s.platforms.push(p)
      this.crystalArc(z, y, p, speed, s)
      z = p.z1
      y = baseY
    }
    // Static landing after moving section.
    const gap = this.nextGap(d, speed, 0.6, true) * 0.8
    const land = this.makePlatform(z + gap, speed * 1.2 + 8, y, 'neutral', 'static', this.widthFor(d))
    s.platforms.push(land)
    return s
  }

  private buildAlternating(d: number): Section {
    const s = this.startSection()
    const speed = speedAt(d)
    const gap = this.nextGap(d, speed, 0, false)
    const len = this.rng.range(speed * 1.4, speed * lerp(2, 3, d))
    const period = this.rng.range(lerp(2.2, 0.95, d), lerp(2.6, 1.3, d))
    const p = this.makePlatform(this.cursorZ + gap, len, this.cursorY, 'solar', 'alternating', this.widthFor(d), {
      period,
      phaseOffset: this.rng.range(0, period * 2),
      hasFrame: true,
    })
    s.platforms.push(p)
    this.crystalArc(this.cursorZ, this.cursorY, p, speed, s)
    this.crystalLine(p, s)
    return s
  }

  private buildCollapse(d: number): Section {
    const s = this.startSection()
    const speed = speedAt(d)
    const n = this.rng.int(3, 4 + Math.round(d * 4))
    let z = this.cursorZ
    let y = this.cursorY
    for (let i = 0; i < n; i++) {
      const gap = i === 0 ? this.nextGap(d, speed, 0, false) : this.rng.range(1.2, 2.4 + d * 1.5)
      const len = this.rng.range(speed * 0.35 + 1.5, speed * 0.45 + 2)
      const ny = this.clampY(y + this.rng.range(-0.4, 0.3))
      const p = this.makePlatform(z + gap, len, ny, i % 3 === 2 ? this.pickColor(d) : 'neutral', 'collapsing', this.widthFor(d) * 0.9, {
        hasFrame: false,
      })
      s.platforms.push(p)
      if (i % 2 === 0) this.addCrystal(p.z0 + len / 2, ny + 1, false, s.crystals)
      z = p.z1
      y = ny
    }
    const land = this.makePlatform(z + this.rng.range(2, 3.5), speed * 1.2 + 6, y, 'neutral', 'static', this.widthFor(d))
    s.platforms.push(land)
    return s
  }

  // ---------- obstacles & collectibles ----------

  private makeObstacle(kind: ObstacleKind, z: number, y: number, color: Phase = 'solar'): ObstacleSpec {
    return {
      id: this.nextId++,
      kind,
      z,
      y,
      color,
      variant: 'low',
      passed: false,
      big: false,
    }
  }

  private populateObstacles(p: PlatformSpec, d: number, speed: number, s: Section, densityScale: number) {
    const before = speed * 0.8 + 3
    const after = speed * 0.65 + 2
    const spacing = speed * lerp(1.6, 1.15, d) + 3
    const usable = p.z1 - after - (p.z0 + before)
    if (usable <= 0) return
    const density = (0.5 + 3.2 * d) * densityScale
    const target = Math.min(Math.floor(usable / spacing) + 1, Math.round((usable / 100) * density * 3 + (d > 0.05 ? 1 : 0)))
    let z = p.z0 + before + this.rng.range(0, spacing * 0.3)
    let placed = 0
    while (z < p.z1 - after && placed < target) {
      const kind = this.rng.weighted<ObstacleKind>([
        ['spikes', 3],
        ['saw', d > 0.12 ? 2 : 0.5],
        ['lowLaser', d > 0.06 ? 2 : 0],
        ['highBarrier', d > 0.18 ? 1.6 : 0],
        ['piston', d > 0.3 ? 1.4 : 0],
        ['drone', d > 0.25 ? 1.6 : 0],
        ['colorGate', d > 0.12 ? 1.4 : 0],
      ])
      const o = this.makeObstacle(kind, z, p.y, this.rng.chance(0.5) ? 'solar' : 'ion')
      if (kind === 'drone') o.variant = this.rng.chance(0.5) ? 'low' : 'high'
      if (kind === 'saw' || kind === 'spikes') o.big = d > 0.5 && this.rng.chance(0.35)
      if (kind === 'colorGate' && p.color !== 'neutral') o.color = this.rng.chance(0.6) ? opposite(p.color) : p.color
      s.obstacles.push(o)
      placed++
      z += spacing * this.rng.range(1, 1.4)
    }
  }

  private addCrystal(z: number, y: number, bonus: boolean, list: CrystalSpec[]) {
    list.push({ id: this.nextId++, z, y, x: 0, bonus, collected: false, slot: -1 })
  }

  private crystalLine(p: PlatformSpec, s: Section) {
    const surge = p.z0 < this.surgeUntilZ
    if (!surge && !this.rng.chance(0.55)) return
    const len = p.z1 - p.z0
    const start = p.z0 + this.rng.range(2, Math.max(2.5, len * 0.3))
    const count = surge ? Math.floor(len / 2.2) : this.rng.int(4, 9)
    const wave = this.rng.chance(0.35)
    for (let i = 0; i < count; i++) {
      const z = start + i * 2.2
      if (z > p.z1 - 2) break
      if (s.obstacles.some((o) => Math.abs(o.z - z) < 2.5)) continue
      const y = p.y + 1 + (wave ? Math.sin(i * 0.7) * 0.6 + 0.6 : 0)
      this.addCrystal(z, y, false, s.crystals)
    }
  }

  private crystalArc(fromZ: number, fromY: number, to: PlatformSpec, speed: number, s: Section) {
    if (!this.rng.chance(0.55) && to.z0 >= this.surgeUntilZ) return
    const gap = to.z0 - fromZ
    if (gap < 2.5) return
    const g = 42
    const j = 13.5
    const steps = Math.max(3, Math.floor(gap / 2))
    const tTotal = gap / speed
    for (let i = 1; i < steps; i++) {
      const t = (i / steps) * tTotal
      const y = fromY + 1 + Math.max(0, j * t - 0.5 * g * t * t)
      this.addCrystal(fromZ + (i / steps) * gap, y, false, s.crystals)
    }
  }

  private bonusCrystal(fromZ: number, gap: number, y: number, s: Section) {
    this.addCrystal(fromZ + gap * 0.5, y + DOUBLE_JUMP_HEIGHT * 0.85, true, s.crystals)
  }

  private maybePowerUp(p: PlatformSpec, s: Section) {
    if (p.z0 < this.nextPowerUpZ) return
    if (p.z1 - p.z0 < 20) return
    const z = p.z0 + (p.z1 - p.z0) * 0.35
    if (s.obstacles.some((o) => Math.abs(o.z - z) < 6)) return
    const type = this.rng.weighted<PowerUpType>([
      ['magnet', 3],
      ['shield', 2.5],
      ['multiplier', 2],
      ['slowmo', 1.5],
      ['surge', 1.5],
    ])
    s.powerUps.push({ id: this.nextId++, z, y: p.y + 1.3, type, collected: false })
    this.nextPowerUpZ = p.z1 + this.rng.range(450, 800)
  }

  // ---------- validation ----------

  /** Rejects any section containing a jump or obstacle sequence that cannot be cleared at the expected speed. */
  private validate(s: Section, d: number) {
    const speed = speedAt(d)
    let prevZ = this.cursorZ
    let prevY = this.cursorY
    for (const p of s.platforms) {
      const gap = p.z0 - prevZ
      const topWorst = p.y + (p.kind === 'moving' ? p.amplitude : 0)
      const dy = topWorst - prevY
      if (dy > DOUBLE_JUMP_HEIGHT * 0.72) return false
      if (gap < 0) return false
      if (gap > 0.5) {
        const reach = speed * doubleJumpAirTime(Math.max(0, dy)) * 0.78
        if (gap + 1 > reach) return false
      }
      const minLanding = p.kind === 'collapsing' ? speed * 0.3 : speed * 0.45 + 3
      if (p.z1 - p.z0 < minLanding) return false
      if (p.kind === 'alternating' && p.period < 0.9) return false
      prevZ = p.z1
      prevY = p.y
    }
    const sorted = [...s.obstacles].sort((a, b) => a.z - b.z)
    for (let i = 1; i < sorted.length; i++) {
      const minGap = sorted[i - 1].kind === 'colorGate' && sorted[i].kind === 'colorGate' ? speed * 0.7 : speed * 0.95
      if (sorted[i].z - sorted[i - 1].z < minGap) return false
    }
    for (const o of sorted) {
      const host = s.platforms.find((p) => o.z >= p.z0 && o.z <= p.z1)
      if (!host || host.kind !== 'static') return false
      if (o.z - host.z0 < speed * 0.6 + 2) return false
      if (host.z1 - o.z < speed * 0.4 + 1) return false
      if ((o.kind === 'spikes' || o.kind === 'saw') && (o.big ? 1.7 : 1.1) > SINGLE_JUMP_HEIGHT * 0.85) return false
    }
    return true
  }

  private commit(s: Section) {
    for (const p of s.platforms) {
      this.platforms.push(p)
      this.listener.onPlatformAdded(p)
      this.cursorZ = p.z1
      this.cursorY = p.y
    }
    for (const o of s.obstacles.sort((a, b) => a.z - b.z)) {
      this.obstacles.push(o)
      this.listener.onObstacleAdded(o)
    }
    this.obstacles.sort((a, b) => a.z - b.z)
    this.crystalsBuffer.push(...s.crystals)
    this.flushCrystals()
    for (const pu of s.powerUps) {
      this.powerUps.push(pu)
      this.listener.onPowerUpAdded(pu)
    }
    this.powerUps.sort((a, b) => a.z - b.z)
  }
}
