import * as THREE from 'three'

const vertex = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uPixelRatio;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixelRatio * (220.0 / max(-mv.z, 0.1));
  vAlpha = aAlpha;
  vColor = aColor;
}
`

const fragment = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5 || vAlpha <= 0.001) discard;
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * (1.0 + a), a * vAlpha);
}
`

export interface EmitOptions {
  x: number
  y: number
  z: number
  vx?: number
  vy?: number
  vz?: number
  spread?: number
  color: THREE.Color
  life?: number
  size?: number
  gravity?: number
  drag?: number
}

/** Fixed-capacity ring-buffer particle system: no allocations during play. */
export class ParticleSystem {
  readonly points: THREE.Points
  private capacity: number
  private positions: Float32Array
  private colors: Float32Array
  private sizes: Float32Array
  private alphas: Float32Array
  private velocities: Float32Array
  private life: Float32Array
  private maxLife: Float32Array
  private baseSize: Float32Array
  private gravity: Float32Array
  private drag: Float32Array
  private cursor = 0
  private material: THREE.ShaderMaterial
  private geometry: THREE.BufferGeometry
  budget = 1

  constructor(capacity = 1800) {
    this.capacity = capacity
    this.positions = new Float32Array(capacity * 3)
    this.colors = new Float32Array(capacity * 3)
    this.sizes = new Float32Array(capacity)
    this.alphas = new Float32Array(capacity)
    this.velocities = new Float32Array(capacity * 3)
    this.life = new Float32Array(capacity)
    this.maxLife = new Float32Array(capacity)
    this.baseSize = new Float32Array(capacity)
    this.gravity = new Float32Array(capacity)
    this.drag = new Float32Array(capacity)
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage))
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage))
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage))
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage))
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPixelRatio: { value: 1 } },
    })
    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
  }

  setPixelRatio(pr: number) {
    this.material.uniforms.uPixelRatio.value = pr
  }

  emit(o: EmitOptions) {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % this.capacity
    const s = o.spread ?? 0
    this.positions[i * 3] = o.x
    this.positions[i * 3 + 1] = o.y
    this.positions[i * 3 + 2] = o.z
    this.velocities[i * 3] = (o.vx ?? 0) + (Math.random() - 0.5) * s
    this.velocities[i * 3 + 1] = (o.vy ?? 0) + (Math.random() - 0.5) * s
    this.velocities[i * 3 + 2] = (o.vz ?? 0) + (Math.random() - 0.5) * s
    this.colors[i * 3] = o.color.r
    this.colors[i * 3 + 1] = o.color.g
    this.colors[i * 3 + 2] = o.color.b
    const life = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6)
    this.life[i] = life
    this.maxLife[i] = life
    this.baseSize[i] = (o.size ?? 0.25) * (0.7 + Math.random() * 0.6)
    this.gravity[i] = o.gravity ?? 0
    this.drag[i] = o.drag ?? 1.5
  }

  burst(count: number, o: EmitOptions) {
    const n = Math.max(1, Math.round(count * this.budget))
    for (let k = 0; k < n; k++) this.emit(o)
  }

  update(dt: number) {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) {
        if (this.alphas[i] !== 0) this.alphas[i] = 0
        continue
      }
      this.life[i] -= dt
      const k = i * 3
      const damp = Math.max(0, 1 - this.drag[i] * dt)
      this.velocities[k] *= damp
      this.velocities[k + 1] = this.velocities[k + 1] * damp - this.gravity[i] * dt
      this.velocities[k + 2] *= damp
      this.positions[k] += this.velocities[k] * dt
      this.positions[k + 1] += this.velocities[k + 1] * dt
      this.positions[k + 2] += this.velocities[k + 2] * dt
      const t = Math.max(0, this.life[i] / this.maxLife[i])
      this.alphas[i] = t
      this.sizes[i] = this.baseSize[i] * (0.4 + 0.6 * t)
    }
    const g = this.geometry.attributes
    g.position.needsUpdate = true
    g.aColor.needsUpdate = true
    g.aSize.needsUpdate = true
    g.aAlpha.needsUpdate = true
  }

  clear() {
    this.life.fill(0)
    this.alphas.fill(0)
  }
}
