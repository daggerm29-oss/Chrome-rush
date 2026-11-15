import * as THREE from 'three'
import {
  BLOCK_HEIGHT,
  droneCenter,
  FALLING_BLOCK_HEIGHT,
  fallingBlockBottom,
  fallingBlockWarning,
  flipGateLocked,
  gateColor,
  isGate,
  pistonBottom,
  ROLLER_HEIGHT,
  SPIKE_FIELD_HEIGHT,
  TOWER_HEIGHT,
} from './hazards'
import { PHASE_COLORS } from './player-model'
import { alternatingProgress, PLATFORM_THICKNESS, platformColor, platformTop } from './surfaces'
import type {
  CrystalSpec,
  ObstacleKind,
  ObstacleSpec,
  Phase,
  PlatformSpec,
  PowerUpSpec,
  PowerUpType,
  SurfaceColor,
} from './types'

const NEUTRAL = new THREE.Color('#16171f')
const NEUTRAL_EDGE = new THREE.Color('#5b6475')
const HAZARD = new THREE.Color('#ff2d55')

export const POWERUP_COLORS: Record<PowerUpType, THREE.Color> = {
  magnet: new THREE.Color('#a78bfa'),
  shield: new THREE.Color('#4ade80'),
  multiplier: new THREE.Color('#ff4fd8'),
  slowmo: new THREE.Color('#e0f2fe'),
  surge: new THREE.Color('#facc15'),
}

interface PlatformView {
  group: THREE.Group
  body: THREE.Mesh
  bodyMat: THREE.MeshStandardMaterial
  edgeMat: THREE.MeshStandardMaterial
  edges: THREE.Mesh[]
  under: THREE.Mesh
}

interface ObstacleView {
  kind: ObstacleKind
  group: THREE.Group
  animated?: THREE.Object3D
  extra?: THREE.Object3D
  mat?: THREE.MeshStandardMaterial
}

const unitBox = new THREE.BoxGeometry(1, 1, 1)

export class WorldView {
  private platformPool: PlatformView[] = []
  private platformViews = new Map<number, PlatformView>()
  private framePool: THREE.Group[] = []
  private frameViews = new Map<number, THREE.Group>()
  private obstaclePools = new Map<ObstacleKind, ObstacleView[]>()
  private obstacleViews = new Map<number, { spec: ObstacleSpec; view: ObstacleView }>()
  private crystalMesh: THREE.InstancedMesh
  private bonusMesh: THREE.InstancedMesh
  private crystalFree: number[] = []
  private bonusFree: number[] = []
  private crystals = new Map<number, CrystalSpec>()
  private powerUpPool: THREE.Group[] = []
  private powerUpViews = new Map<number, { spec: PowerUpSpec; group: THREE.Group }>()
  private platforms = new Map<number, PlatformSpec>()
  private frameMat = new THREE.MeshStandardMaterial({ color: '#0d0e12', roughness: 0.3, metalness: 0.35, flatShading: true })
  private metalMat = new THREE.MeshStandardMaterial({ color: '#2a2d36', roughness: 0.35, metalness: 0.8, flatShading: true })
  private hazardMat = new THREE.MeshStandardMaterial({ color: '#ff2d55', emissive: '#ff2d55', emissiveIntensity: 2.4 })
  private laserMat = new THREE.MeshBasicMaterial({ color: '#ff3b6b', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
  private tmpM = new THREE.Matrix4()
  private tmpQ = new THREE.Quaternion()
  private tmpE = new THREE.Euler()
  private tmpV = new THREE.Vector3()
  private tmpS = new THREE.Vector3()
  private tmpC = new THREE.Color()
  shadows = true

  constructor(private scene: THREE.Scene) {
    const crystalGeo = new THREE.OctahedronGeometry(0.28, 0)
    const crystalMat = new THREE.MeshStandardMaterial({ color: '#ffd1f4', emissive: '#ff4fd8', emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.3, flatShading: true })
    this.crystalMesh = new THREE.InstancedMesh(crystalGeo, crystalMat, 360)
    this.bonusMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshStandardMaterial({ color: '#fff4c2', emissive: '#ffb020', emissiveIntensity: 3, flatShading: true }), 40)
    for (const [mesh, free] of [
      [this.crystalMesh, this.crystalFree],
      [this.bonusMesh, this.bonusFree],
    ] as const) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      const zero = new THREE.Matrix4().makeScale(0, 0, 0)
      for (let i = 0; i < mesh.count; i++) {
        mesh.setMatrixAt(i, zero)
        free.push(mesh.count - 1 - i)
      }
      scene.add(mesh)
    }
  }

  // ---------- platforms ----------

  private createPlatformView(): PlatformView {
    const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.15, flatShading: true })
    const edgeMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 2.2 })
    const group = new THREE.Group()
    const body = new THREE.Mesh(unitBox, bodyMat)
    body.castShadow = true
    body.receiveShadow = true
    group.add(body)
    const edges: THREE.Mesh[] = []
    for (let i = 0; i < 2; i++) {
      const e = new THREE.Mesh(unitBox, edgeMat)
      group.add(e)
      edges.push(e)
    }
    const front = new THREE.Mesh(unitBox, edgeMat)
    group.add(front)
    edges.push(front)
    const under = new THREE.Mesh(unitBox, edgeMat)
    group.add(under)
    return { group, body, bodyMat, edgeMat, edges, under }
  }

  private paintPlatform(v: PlatformView, color: SurfaceColor, intensity = 1) {
    if (color === 'neutral') {
      v.bodyMat.color.copy(NEUTRAL)
      v.bodyMat.emissive.setRGB(0, 0, 0)
      v.bodyMat.metalness = 0.35
      v.edgeMat.color.copy(NEUTRAL_EDGE)
      v.edgeMat.emissive.copy(NEUTRAL_EDGE).multiplyScalar(0.35)
    } else {
      const c = PHASE_COLORS[color]
      v.bodyMat.color.copy(c)
      v.bodyMat.emissive.copy(c).multiplyScalar(0.28 * intensity)
      v.bodyMat.metalness = 0.1
      v.edgeMat.color.copy(c)
      v.edgeMat.emissive.copy(c).multiplyScalar(intensity)
    }
  }

  /**
   * Multicolour tiles telegraph their flips: the rails always show the colour the tile is about to become,
   * and for the last stretch of each cycle the whole tile flashes between both colours, faster and faster.
   */
  private paintAlternating(v: PlatformView, current: Phase, p: PlatformSpec, prog: number, t: number) {
    const next: Phase = current === 'solar' ? 'ion' : 'solar'
    const warnSeconds = Math.min(p.period * 0.7, Math.max(0.55, p.period * 0.45))
    const warnStart = 1 - warnSeconds / p.period
    const warn = prog > warnStart ? (prog - warnStart) / (1 - warnStart) : 0
    const blink = warn > 0 ? 0.5 + 0.5 * Math.sin(t * (12 + warn * 30)) : 0
    const mix = warn > 0 ? blink * (0.45 + 0.55 * warn) : 0
    const cur = PHASE_COLORS[current]
    const nxt = PHASE_COLORS[next]
    v.bodyMat.color.copy(cur).lerp(nxt, mix)
    v.bodyMat.emissive.copy(v.bodyMat.color).multiplyScalar(0.28 + warn * 0.5)
    v.bodyMat.metalness = 0.1
    v.edgeMat.color.copy(nxt)
    v.edgeMat.emissive.copy(nxt).multiplyScalar(0.8 + warn * 1.8)
  }

  addPlatform(p: PlatformSpec) {
    const v = this.platformPool.pop() ?? this.createPlatformView()
    const len = p.z1 - p.z0
    const w = p.width
    const th = PLATFORM_THICKNESS
    v.body.scale.set(w, th, len)
    v.body.position.set(0, -th / 2, len / 2)
    v.body.castShadow = this.shadows
    v.edges[0].scale.set(0.08, 0.08, len)
    v.edges[0].position.set(-w / 2 + 0.04, 0.02, len / 2)
    v.edges[1].scale.set(0.08, 0.08, len)
    v.edges[1].position.set(w / 2 - 0.04, 0.02, len / 2)
    v.edges[2].scale.set(w, 0.08, 0.08)
    v.edges[2].position.set(0, 0.02, 0.04)
    v.under.visible = p.kind === 'moving' || p.kind === 'collapsing'
    v.under.scale.set(w * 0.6, 0.06, len * 0.9)
    v.under.position.set(0, -th - 0.03, len / 2)
    v.group.position.set(0, p.y, p.z0)
    v.group.rotation.set(0, 0, 0)
    this.paintPlatform(v, p.kind === 'collapsing' && p.color === 'neutral' ? 'neutral' : p.color)
    if (p.kind === 'collapsing') v.bodyMat.color.multiplyScalar(p.color === 'neutral' ? 1.6 : 0.85)
    this.scene.add(v.group)
    this.platformViews.set(p.id, v)
    this.platforms.set(p.id, p)
    if (p.hasFrame) this.addFrame(p)
  }

  removePlatform(p: PlatformSpec) {
    const v = this.platformViews.get(p.id)
    if (v) {
      this.scene.remove(v.group)
      this.platformPool.push(v)
      this.platformViews.delete(p.id)
    }
    const f = this.frameViews.get(p.id)
    if (f) {
      this.scene.remove(f)
      this.framePool.push(f)
      this.frameViews.delete(p.id)
    }
    this.platforms.delete(p.id)
  }

  private addFrame(p: PlatformSpec) {
    let f = this.framePool.pop()
    if (!f) {
      f = new THREE.Group()
      const left = new THREE.Mesh(unitBox, this.frameMat)
      const right = new THREE.Mesh(unitBox, this.frameMat)
      const top = new THREE.Mesh(unitBox, this.frameMat)
      const foot = new THREE.Mesh(unitBox, this.frameMat)
      for (const m of [left, right, top, foot]) {
        m.castShadow = true
        f.add(m)
      }
    }
    const [left, right, top, foot] = f.children as THREE.Mesh[]
    const h = 7.5 + ((p.id * 37) % 5)
    const span = p.width / 2 + 2.6 + ((p.id * 13) % 3)
    left.scale.set(1.4, h, 1.4)
    left.position.set(-span, h / 2 - 3, 0)
    right.scale.set(1.4, h * 0.75, 1.4)
    right.position.set(span, (h * 0.75) / 2 - 3 + h * 0.25, 0)
    top.scale.set(span * 2 + 1.4, 1.4, 1.4)
    top.position.set(0, h - 3, 0)
    foot.scale.set(span * 1.2, 1.4, 1.4)
    foot.position.set(-span * 0.4, -3, 0)
    f.position.set(0, p.y, (p.z0 + p.z1) / 2 + ((p.id * 7) % 5) - 2)
    f.rotation.set(0, (((p.id * 17) % 10) - 5) * 0.03, 0)
    this.scene.add(f)
    this.frameViews.set(p.id, f)
  }

  // ---------- obstacles ----------

  private createObstacleView(kind: ObstacleKind): ObstacleView {
    const group = new THREE.Group()
    const view: ObstacleView = { kind, group }
    switch (kind) {
      case 'spikes': {
        const geo = new THREE.ConeGeometry(0.28, 1, 4)
        for (let i = -2; i <= 2; i++) {
          const s = new THREE.Mesh(geo, this.metalMat)
          s.position.set(i * 0.5, 0.5, 0)
          s.castShadow = true
          group.add(s)
          const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), this.hazardMat)
          tip.position.set(i * 0.5, 0.86, 0)
          group.add(tip)
        }
        break
      }
      case 'saw': {
        const spin = new THREE.Group()
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 20), this.metalMat)
        disc.rotation.z = Math.PI / 2
        spin.add(disc)
        const teeth = new THREE.ConeGeometry(0.14, 0.32, 3)
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2
          const t = new THREE.Mesh(teeth, this.hazardMat)
          t.position.set(0, Math.cos(a) * 1.08, Math.sin(a) * 1.08)
          t.rotation.x = a
          spin.add(t)
        }
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 8), this.hazardMat)
        hub.rotation.z = Math.PI / 2
        spin.add(hub)
        group.add(spin)
        view.animated = spin
        break
      }
      case 'lowLaser': {
        for (const sx of [-1, 1]) {
          const post = new THREE.Mesh(unitBox, this.metalMat)
          post.scale.set(0.25, 1.2, 0.25)
          post.position.set(sx * 1.9, 0.6, 0)
          group.add(post)
        }
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.8, 6), this.laserMat)
        beam.rotation.z = Math.PI / 2
        beam.position.y = 0.6
        group.add(beam)
        const glowBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.8, 6), new THREE.MeshBasicMaterial({ color: '#ff2d55', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }))
        glowBeam.rotation.z = Math.PI / 2
        glowBeam.position.y = 0.6
        group.add(glowBeam)
        view.animated = glowBeam
        break
      }
      case 'highBarrier': {
        const slab = new THREE.Mesh(unitBox, this.frameMat)
        slab.scale.set(4.2, 3.2, 0.8)
        slab.position.y = 1.55 + 1.6
        slab.castShadow = true
        group.add(slab)
        const stripe = new THREE.Mesh(unitBox, this.hazardMat)
        stripe.scale.set(4.25, 0.12, 0.85)
        stripe.position.y = 1.6
        group.add(stripe)
        for (const sx of [-1.6, 1.6]) {
          const cable = new THREE.Mesh(unitBox, this.metalMat)
          cable.scale.set(0.06, 8, 0.06)
          cable.position.set(sx, 4.7 + 4, 0)
          group.add(cable)
        }
        break
      }
      case 'piston': {
        const housing = new THREE.Mesh(unitBox, this.frameMat)
        housing.scale.set(2.6, 1.6, 2)
        housing.position.y = 7
        group.add(housing)
        const head = new THREE.Group()
        const rod = new THREE.Mesh(unitBox, this.metalMat)
        rod.scale.set(0.45, 6, 0.45)
        rod.position.y = 3
        head.add(rod)
        const plate = new THREE.Mesh(unitBox, this.metalMat)
        plate.scale.set(2.4, 0.5, 1.5)
        plate.position.y = 0.25
        plate.castShadow = true
        head.add(plate)
        const glowEdge = new THREE.Mesh(unitBox, this.hazardMat)
        glowEdge.scale.set(2.45, 0.08, 1.55)
        glowEdge.position.y = 0.02
        head.add(glowEdge)
        group.add(head)
        view.animated = head
        break
      }
      case 'drone': {
        const body = new THREE.Group()
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 1), this.frameMat)
        body.add(core)
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), this.hazardMat)
        eye.position.z = -0.32
        body.add(eye)
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 24), this.hazardMat)
        ring.rotation.x = Math.PI / 2
        body.add(ring)
        view.extra = ring
        group.add(body)
        view.animated = body
        break
      }
      case 'block': {
        const body = new THREE.Mesh(unitBox, this.frameMat)
        body.scale.set(2.6, BLOCK_HEIGHT, 1)
        body.position.y = BLOCK_HEIGHT / 2
        body.castShadow = true
        group.add(body)
        for (const y of [BLOCK_HEIGHT, 0.5]) {
          const stripe = new THREE.Mesh(unitBox, this.hazardMat)
          stripe.scale.set(2.65, 0.1, 1.05)
          stripe.position.y = y
          group.add(stripe)
        }
        break
      }
      case 'tower': {
        const body = new THREE.Mesh(unitBox, this.frameMat)
        body.scale.set(2.2, TOWER_HEIGHT, 1)
        body.position.y = TOWER_HEIGHT / 2
        body.castShadow = true
        group.add(body)
        for (const y of [TOWER_HEIGHT, TOWER_HEIGHT * 0.66, TOWER_HEIGHT * 0.33]) {
          const stripe = new THREE.Mesh(unitBox, this.hazardMat)
          stripe.scale.set(2.25, 0.1, 1.05)
          stripe.position.y = y
          group.add(stripe)
        }
        break
      }
      case 'spikeField': {
        const plate = new THREE.Mesh(unitBox, this.frameMat)
        plate.scale.set(3.4, 0.1, 3.2)
        plate.position.y = 0.05
        group.add(plate)
        const geo = new THREE.ConeGeometry(0.26, SPIKE_FIELD_HEIGHT - 0.1, 4)
        for (let row = -1; row <= 1; row++) {
          for (let i = -2; i <= 2; i++) {
            const s = new THREE.Mesh(geo, this.hazardMat)
            s.position.set(i * 0.62 + (row % 2 === 0 ? 0 : 0.31), 0.1 + (SPIKE_FIELD_HEIGHT - 0.1) / 2, row * 1.1)
            group.add(s)
          }
        }
        break
      }
      case 'roller': {
        const spin = new THREE.Group()
        const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 2.6, 6), this.metalMat)
        hex.rotation.z = Math.PI / 2
        hex.castShadow = true
        spin.add(hex)
        for (const sx of [-1, 1]) {
          const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.12, 6), this.hazardMat)
          ring.rotation.z = Math.PI / 2
          ring.position.x = sx * 1.3
          spin.add(ring)
        }
        spin.position.y = ROLLER_HEIGHT / 2
        group.add(spin)
        view.animated = spin
        break
      }
      case 'fallingBlock': {
        const block = new THREE.Group()
        const body = new THREE.Mesh(unitBox, this.frameMat)
        body.scale.set(2.4, FALLING_BLOCK_HEIGHT, 1.2)
        body.castShadow = true
        block.add(body)
        for (const y of [-FALLING_BLOCK_HEIGHT / 2, FALLING_BLOCK_HEIGHT / 2]) {
          const stripe = new THREE.Mesh(unitBox, this.hazardMat)
          stripe.scale.set(2.45, 0.1, 1.25)
          stripe.position.y = y
          block.add(stripe)
        }
        group.add(block)
        view.animated = block
        const pad = new THREE.Mesh(
          new THREE.PlaneGeometry(2.4, 1.2),
          new THREE.MeshBasicMaterial({ color: '#ff2d55', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
        )
        pad.rotation.x = -Math.PI / 2
        pad.position.y = 0.05
        group.add(pad)
        view.extra = pad
        break
      }
      case 'autoGate': {
        const discMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.4, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
        view.mat = discMat
        const disc = new THREE.Mesh(new THREE.CircleGeometry(1.9, 28), discMat)
        disc.position.y = 2
        group.add(disc)
        const ringMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2.6 })
        const rings = new THREE.Group()
        for (let i = -1; i <= 1; i++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95 - Math.abs(i) * 0.12, 0.07, 6, 28), ringMat)
          ring.position.z = i * 0.5
          rings.add(ring)
        }
        rings.position.y = 2
        group.add(rings)
        view.extra = rings
        ;(view as ObstacleView & { edgeMat: THREE.MeshStandardMaterial }).edgeMat = ringMat
        break
      }
      case 'flipGate':
      case 'colorGate': {
        const mat = new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#ffb020', emissiveIntensity: 1.6, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
        view.mat = mat
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.6), mat)
        plane.position.y = 2.3
        group.add(plane)
        const edgeMat = new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#ffb020', emissiveIntensity: 2.4 })
        for (const sx of [-1, 1]) {
          const pillar = new THREE.Mesh(unitBox, this.frameMat)
          pillar.scale.set(0.4, 5, 0.4)
          pillar.position.set(sx * 2, 2.5, 0)
          group.add(pillar)
          const strip = new THREE.Mesh(unitBox, edgeMat)
          strip.scale.set(0.08, 4.6, 0.42)
          strip.position.set(sx * 1.78, 2.3, 0)
          group.add(strip)
        }
        const top = new THREE.Mesh(unitBox, edgeMat)
        top.scale.set(4.4, 0.18, 0.42)
        top.position.y = 4.9
        group.add(top)
        view.extra = top
        ;(view as ObstacleView & { edgeMat: THREE.MeshStandardMaterial }).edgeMat = edgeMat
        break
      }
    }
    return view
  }

  addObstacle(o: ObstacleSpec) {
    const pool = this.obstaclePools.get(o.kind) ?? []
    this.obstaclePools.set(o.kind, pool)
    const view = pool.pop() ?? this.createObstacleView(o.kind)
    view.group.position.set(0, o.y, o.z)
    const scale = o.big ? 1.5 : 1
    if (o.kind === 'spikes') view.group.scale.set(1, o.big ? 1.2 : 0.8, 1)
    else if (o.kind === 'saw') {
      view.group.scale.set(1, scale * 0.85, scale * 0.85)
      view.group.position.y = o.y + 0.2 * scale
    } else view.group.scale.set(1, 1, 1)
    if (isGate(o.kind) && view.mat) {
      const c = PHASE_COLORS[o.color]
      view.mat.color.copy(c)
      view.mat.emissive.copy(c)
      const edgeMat = (view as ObstacleView & { edgeMat: THREE.MeshStandardMaterial }).edgeMat
      edgeMat.color.copy(c)
      edgeMat.emissive.copy(c)
    }
    this.scene.add(view.group)
    this.obstacleViews.set(o.id, { spec: o, view })
  }

  removeObstacle(o: ObstacleSpec) {
    const entry = this.obstacleViews.get(o.id)
    if (!entry) return
    this.scene.remove(entry.view.group)
    this.obstaclePools.get(o.kind)?.push(entry.view)
    this.obstacleViews.delete(o.id)
  }

  // ---------- crystals ----------

  addCrystal(c: CrystalSpec) {
    const free = c.bonus ? this.bonusFree : this.crystalFree
    const slot = free.pop()
    if (slot === undefined) {
      c.collected = true
      return
    }
    c.slot = slot
    this.crystals.set(c.id, c)
  }

  removeCrystal(c: CrystalSpec) {
    if (c.slot < 0) return
    const mesh = c.bonus ? this.bonusMesh : this.crystalMesh
    mesh.setMatrixAt(c.slot, this.tmpM.makeScale(0, 0, 0))
    mesh.instanceMatrix.needsUpdate = true
    ;(c.bonus ? this.bonusFree : this.crystalFree).push(c.slot)
    c.slot = -1
    this.crystals.delete(c.id)
  }

  hideCrystal(c: CrystalSpec) {
    if (c.slot < 0) return
    const mesh = c.bonus ? this.bonusMesh : this.crystalMesh
    mesh.setMatrixAt(c.slot, this.tmpM.makeScale(0, 0, 0))
    mesh.instanceMatrix.needsUpdate = true
  }

  // ---------- power-ups ----------

  addPowerUp(p: PowerUpSpec) {
    let g = this.powerUpPool.pop()
    if (!g) {
      g = new THREE.Group()
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ emissiveIntensity: 2.6, flatShading: true }))
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 28), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }))
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.03, 6, 28), ring.material)
      g.add(core, ring, ring2)
    }
    const color = POWERUP_COLORS[p.type]
    const core = g.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
    core.material.color.copy(color)
    core.material.emissive.copy(color)
    ;((g.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.copy(color)
    g.position.set(0, p.y, p.z)
    g.visible = true
    this.scene.add(g)
    this.powerUpViews.set(p.id, { spec: p, group: g })
  }

  removePowerUp(p: PowerUpSpec) {
    const v = this.powerUpViews.get(p.id)
    if (!v) return
    this.scene.remove(v.group)
    this.powerUpPool.push(v.group)
    this.powerUpViews.delete(p.id)
  }

  hidePowerUp(p: PowerUpSpec) {
    const v = this.powerUpViews.get(p.id)
    if (v) v.group.visible = false
  }

  // ---------- per-frame ----------

  update(t: number, playerZ: number, speed: number, magnetPull: (c: CrystalSpec) => void) {
    for (const [id, v] of this.platformViews) {
      const p = this.platforms.get(id)
      if (!p) continue
      const top = platformTop(p, t)
      v.group.position.y = top
      if (p.kind === 'alternating') {
        this.paintAlternating(v, platformColor(p, t) as Phase, p, alternatingProgress(p, t), t)
      } else if (p.kind === 'collapsing' && p.touchedAt >= 0 && p.dropOffset === 0) {
        v.group.rotation.z = Math.sin(t * 60) * 0.02
      } else if (p.kind === 'collapsing' && p.dropOffset < 0) {
        v.group.rotation.x = p.dropOffset * 0.02
      }
    }

    for (const { spec: o, view } of this.obstacleViews.values()) {
      switch (o.kind) {
        case 'saw':
          if (view.animated) view.animated.rotation.x -= 0.25
          break
        case 'lowLaser':
          if (view.animated) {
            const s = 1 + Math.sin(t * 22 + o.id) * 0.3
            view.animated.scale.set(s, 1, s)
          }
          break
        case 'piston':
          if (view.animated) view.animated.position.y = pistonBottom(o, playerZ, speed, t)
          break
        case 'drone':
          if (view.animated) {
            view.animated.position.y = droneCenter(o, playerZ, speed, t)
            view.animated.rotation.y = t * 2
          }
          if (view.extra) view.extra.rotation.z = t * 6
          break
        case 'colorGate':
          if (view.mat) view.mat.opacity = 0.26 + Math.sin(t * 6 + o.id) * 0.08
          break
        case 'flipGate': {
          if (!view.mat) break
          const locked = flipGateLocked(o, playerZ, speed)
          const c = PHASE_COLORS[gateColor(o, playerZ, speed, t)]
          const edgeMat = (view as ObstacleView & { edgeMat: THREE.MeshStandardMaterial }).edgeMat
          view.mat.color.copy(c)
          view.mat.emissive.copy(c)
          view.mat.opacity = locked ? 0.42 : 0.12 + 0.2 * Math.abs(Math.sin(t * 14))
          edgeMat.color.copy(c)
          edgeMat.emissive.copy(c)
          edgeMat.emissiveIntensity = locked ? 2.8 : 0.9
          if (view.extra) view.extra.scale.set(1, locked ? 1 : 1 + Math.sin(t * 20) * 0.25, 1)
          break
        }
        case 'autoGate':
          if (view.extra) {
            const s = 1 + Math.sin(t * 5 + o.id) * 0.04
            view.extra.scale.set(s, s, 1)
          }
          break
        case 'roller':
          if (view.animated) view.animated.rotation.x = -t * 4
          break
        case 'fallingBlock': {
          if (view.animated) view.animated.position.y = fallingBlockBottom(o, playerZ, speed) + FALLING_BLOCK_HEIGHT / 2
          if (view.extra) {
            const warn = fallingBlockWarning(o, playerZ, speed)
            const mat = (view.extra as THREE.Mesh).material as THREE.MeshBasicMaterial
            mat.opacity = 0.18 + warn * 0.45 * (0.6 + 0.4 * Math.sin(t * (10 + warn * 25)))
          }
          break
        }
      }
    }

    const rotQ = this.tmpQ.setFromEuler(this.tmpE.set(0, t * 2.2, 0))
    let dirtyA = false
    let dirtyB = false
    for (const c of this.crystals.values()) {
      if (c.collected || c.slot < 0) continue
      if (c.z < playerZ - 20 || c.z > playerZ + 240) continue
      magnetPull(c)
      const bob = Math.sin(t * 3 + c.id) * 0.12
      const s = c.bonus ? 1 + Math.sin(t * 5) * 0.12 : 1
      this.tmpM.compose(this.tmpV.set(c.x, c.y + bob, c.z), rotQ, this.tmpS.set(s, s * 1.3, s))
      if (c.bonus) {
        this.bonusMesh.setMatrixAt(c.slot, this.tmpM)
        dirtyB = true
      } else {
        this.crystalMesh.setMatrixAt(c.slot, this.tmpM)
        dirtyA = true
      }
    }
    if (dirtyA) this.crystalMesh.instanceMatrix.needsUpdate = true
    if (dirtyB) this.bonusMesh.instanceMatrix.needsUpdate = true

    for (const { spec, group } of this.powerUpViews.values()) {
      if (spec.collected) continue
      group.position.y = spec.y + Math.sin(t * 2.5 + spec.id) * 0.18
      group.children[0].rotation.set(t, t * 1.3, 0)
      group.children[1].rotation.set(Math.PI / 2 + Math.sin(t) * 0.4, t * 1.5, 0)
      group.children[2].rotation.set(t * 0.8, Math.PI / 2, 0)
    }
  }

  colorFor(color: SurfaceColor, out = this.tmpC) {
    return color === 'neutral' ? out.copy(NEUTRAL_EDGE) : out.copy(PHASE_COLORS[color])
  }

  get hazardColor() {
    return HAZARD
  }

  clearAll() {
    for (const p of [...this.platforms.values()]) this.removePlatform(p)
    for (const { spec } of [...this.obstacleViews.values()]) this.removeObstacle(spec)
    for (const c of [...this.crystals.values()]) this.removeCrystal(c)
    for (const { spec } of [...this.powerUpViews.values()]) this.removePowerUp(spec)
  }
}
