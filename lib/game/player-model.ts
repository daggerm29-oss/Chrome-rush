import * as THREE from 'three'
import type { Phase } from './types'

export const PHASE_COLORS: Record<Phase, THREE.Color> = {
  solar: new THREE.Color('#ffb020'),
  ion: new THREE.Color('#22d3ee'),
}

export interface AnimState {
  grounded: boolean
  vy: number
  speed: number
  spin: number
  landing: number
  switchPulse: number
  invulnerable: boolean
  time: number
}

/** Procedural chameleon-inspired runner with an energy core and phase-reactive materials. */
export class PlayerModel {
  readonly root = new THREE.Group()
  private body = new THREE.Group()
  private head = new THREE.Group()
  private tail = new THREE.Group()
  private legs: THREE.Group[] = []
  private skin: THREE.MeshStandardMaterial
  private belly: THREE.MeshStandardMaterial
  private core: THREE.MeshStandardMaterial
  private crest: THREE.MeshStandardMaterial
  private pulseRing: THREE.Mesh
  private pulseMat: THREE.MeshBasicMaterial
  private targetColor = new THREE.Color()
  private runCycle = 0
  private tilt = 0
  readonly light: THREE.PointLight

  constructor() {
    this.skin = new THREE.MeshStandardMaterial({ color: '#ffb020', roughness: 0.35, metalness: 0.15, flatShading: true, emissive: '#ffb020', emissiveIntensity: 0.18 })
    this.belly = new THREE.MeshStandardMaterial({ color: '#f5f1e8', roughness: 0.6, flatShading: true })
    this.core = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffb020', emissiveIntensity: 3.2 })
    this.crest = new THREE.MeshStandardMaterial({ color: '#1a1a22', roughness: 0.4, metalness: 0.4, flatShading: true })
    const eyeWhite = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 })
    const pupil = new THREE.MeshStandardMaterial({ color: '#0b0b12', roughness: 0.1 })

    this.root.add(this.body)
    this.body.position.y = 0.62

    // Torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 4, 10), this.skin)
    torso.rotation.x = Math.PI / 2
    torso.castShadow = true
    this.body.add(torso)
    const bellyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 8), this.belly)
    bellyMesh.rotation.x = Math.PI / 2
    bellyMesh.position.set(0, -0.09, 0.02)
    bellyMesh.scale.set(0.9, 1, 0.8)
    this.body.add(bellyMesh)

    // Energy core on the back
    const coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), this.core)
    coreMesh.position.set(0, 0.24, -0.05)
    this.body.add(coreMesh)

    // Dorsal crest spikes
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), this.crest)
      spike.position.set(0, 0.27, -0.28 + i * 0.16 + (i > 1 ? 0.12 : 0))
      spike.rotation.x = -0.4
      if (i !== 2) this.body.add(spike)
    }

    // Head
    this.head.position.set(0, 0.18, 0.48)
    this.body.add(this.head)
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), this.skin)
    skull.scale.set(1, 0.9, 1.15)
    skull.castShadow = true
    this.head.add(skull)
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.32, 8), this.skin)
    snout.rotation.x = Math.PI / 2
    snout.position.set(0, -0.04, 0.3)
    this.head.add(snout)
    const casque = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), this.crest)
    casque.position.set(0, 0.2, -0.1)
    casque.rotation.x = -0.9
    this.head.add(casque)
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), eyeWhite)
      eye.position.set(sx * 0.19, 0.06, 0.1)
      this.head.add(eye)
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), pupil)
      p.position.set(sx * 0.255, 0.07, 0.15)
      this.head.add(p)
    }

    // Curled tail
    this.tail.position.set(0, 0, -0.5)
    this.body.add(this.tail)
    const tailMesh = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.065, 6, 14, Math.PI * 1.55), this.skin)
    tailMesh.rotation.set(0, Math.PI / 2, Math.PI * 0.75)
    tailMesh.position.set(0, -0.08, -0.12)
    this.tail.add(tailMesh)
    const tailBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.25, 6), this.skin)
    tailBase.rotation.x = Math.PI / 2
    tailBase.position.set(0, 0.03, 0.02)
    this.tail.add(tailBase)

    // Legs (front-left, front-right, back-left, back-right)
    const legPositions: [number, number][] = [
      [-0.24, 0.25],
      [0.24, 0.25],
      [-0.24, -0.25],
      [0.24, -0.25],
    ]
    for (const [x, z] of legPositions) {
      const hip = new THREE.Group()
      hip.position.set(x, -0.1, z)
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.22, 3, 6), this.skin)
      thigh.position.y = -0.16
      thigh.castShadow = true
      hip.add(thigh)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.2), this.crest)
      foot.position.set(0, -0.33, 0.05)
      hip.add(foot)
      this.body.add(hip)
      this.legs.push(hip)
    }

    this.pulseMat = new THREE.MeshBasicMaterial({ color: '#ffb020', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    this.pulseRing = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 6, 32), this.pulseMat)
    this.pulseRing.position.y = 0.65
    this.root.add(this.pulseRing)

    this.light = new THREE.PointLight('#ffb020', 6, 9, 1.6)
    this.light.position.set(0, 1.2, 0.4)
    this.root.add(this.light)

    this.setPhase('solar', true)
  }

  setPhase(phase: Phase, instant = false) {
    this.targetColor.copy(PHASE_COLORS[phase])
    if (instant) this.applyColor(1)
  }

  private applyColor(t: number) {
    this.skin.color.lerp(this.targetColor, t)
    this.skin.emissive.lerp(this.targetColor, t)
    this.core.emissive.lerp(this.targetColor, t)
    this.light.color.lerp(this.targetColor, t)
    this.pulseMat.color.copy(this.targetColor)
  }

  update(dt: number, s: AnimState) {
    this.applyColor(Math.min(1, dt * 28))

    if (s.grounded) {
      this.runCycle += dt * s.speed * 1.05
      const swing = Math.sin(this.runCycle)
      this.legs[0].rotation.x = swing * 0.9
      this.legs[3].rotation.x = swing * 0.9
      this.legs[1].rotation.x = -swing * 0.9
      this.legs[2].rotation.x = -swing * 0.9
      this.body.position.y = 0.62 + Math.abs(Math.cos(this.runCycle)) * 0.08 - s.landing * 0.18
      this.tilt = THREE.MathUtils.lerp(this.tilt, 0.08, dt * 12)
      this.body.rotation.x = this.tilt
      this.body.rotation.z = Math.sin(this.runCycle) * 0.05
      this.tail.rotation.y = Math.sin(this.runCycle * 0.5) * 0.3
      this.head.rotation.x = Math.sin(this.runCycle * 2) * 0.04
    } else {
      const tuck = THREE.MathUtils.clamp(s.vy / 14, -1, 1)
      for (let i = 0; i < 4; i++) {
        const target = i < 2 ? -0.9 + tuck * 0.4 : 0.8 - tuck * 0.3
        this.legs[i].rotation.x = THREE.MathUtils.lerp(this.legs[i].rotation.x, target, dt * 14)
      }
      this.tilt = THREE.MathUtils.lerp(this.tilt, -tuck * 0.35, dt * 10)
      this.body.rotation.x = this.tilt + s.spin * Math.PI * 2
      this.body.position.y = 0.62
      this.tail.rotation.y = Math.sin(s.time * 8) * 0.4
    }

    const pulse = s.switchPulse
    this.pulseMat.opacity = pulse * 0.9
    const ringScale = 0.6 + (1 - pulse) * 1.8
    this.pulseRing.scale.setScalar(ringScale)
    this.pulseRing.rotation.x = Math.PI / 2
    this.core.emissiveIntensity = 3 + pulse * 6
    this.light.intensity = 5 + pulse * 14

    this.root.visible = !s.invulnerable || Math.floor(s.time * 14) % 2 === 0
  }
}
