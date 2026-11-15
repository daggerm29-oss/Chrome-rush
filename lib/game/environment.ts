import * as THREE from 'three'
import { createRng, type Rng } from './difficulty'
import type { Quality } from './types'

export const BIOME_LENGTH = 650
const BLEND_LENGTH = 140

interface PartDef {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  position?: [number, number, number]
  scale?: [number, number, number]
}

interface PropDef {
  parts: PartDef[]
  capacity: number
  weight: number
  spin?: number
  place: (rng: Rng) => { x: number; y: number; scale: number; sx?: number; sy?: number; rotY: number; tilt?: number }
}

interface BiomeDef {
  name: string
  skyTop: THREE.Color
  skyHorizon: THREE.Color
  skyBottom: THREE.Color
  fog: THREE.Color
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  sun: THREE.Color
  particle: THREE.Color
  fogNear: number
  fogFar: number
  props: PropDef[]
}

interface ActiveProp {
  biome: number
  prop: number
  index: number
  z: number
  matrix: THREE.Matrix4
  spin: number
  rot: number
  base: { x: number; y: number; scale: number; sx: number; sy: number; tilt: number }
}

const c = (hex: string) => new THREE.Color(hex)

function side(rng: Rng, min: number, max: number) {
  return (rng.chance(0.5) ? -1 : 1) * rng.range(min, max)
}

function std(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, flatShading: true, ...opts })
}

function glow(color: string, intensity = 1.6, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    flatShading: true,
    ...opts,
  })
}

function buildBiomes(): BiomeDef[] {
  const box = new THREE.BoxGeometry(1, 1, 1)
  const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 7)
  const cone = new THREE.ConeGeometry(0.5, 1, 6)
  const ico = new THREE.IcosahedronGeometry(0.5, 0)
  const dodeca = new THREE.DodecahedronGeometry(0.5, 0)
  const octa = new THREE.OctahedronGeometry(0.5, 0)
  const torus = new THREE.TorusGeometry(0.5, 0.12, 6, 18)
  const gear = new THREE.TorusGeometry(0.5, 0.2, 4, 12)
  const sphere = new THREE.SphereGeometry(0.5, 10, 8)

  return [
    {
      name: 'Neon Canopy',
      skyTop: c('#061226'),
      skyHorizon: c('#1b5f7a'),
      skyBottom: c('#0a1f2e'),
      fog: c('#15465a'),
      hemiSky: c('#7fd8ff'),
      hemiGround: c('#1a3a2a'),
      sun: c('#bfefff'),
      particle: c('#7cf7d4'),
      fogNear: 40,
      fogFar: 300,
      props: [
        {
          capacity: 60,
          weight: 4,
          parts: [
            { geometry: cyl, material: std('#1d2b33'), position: [0, 0.5, 0], scale: [0.12, 1, 0.12] },
            { geometry: ico, material: glow('#1fa3c9', 0.55), position: [0, 1.02, 0], scale: [0.7, 0.42, 0.7] },
            { geometry: ico, material: glow('#ffb347', 0.9), position: [0.15, 0.82, 0.1], scale: [0.35, 0.22, 0.35] },
          ],
          place: (r) => ({ x: side(r, 14, 90), y: r.range(-70, -40), scale: r.range(60, 110), rotY: r.range(0, 6.28) }),
        },
        {
          capacity: 50,
          weight: 2,
          parts: [
            { geometry: sphere, material: glow('#43f0c8', 2.2), scale: [1, 1, 1] },
            { geometry: cone, material: glow('#2bb0ff', 1.2), position: [0, -0.9, 0], scale: [0.3, 1.2, 0.3] },
          ],
          place: (r) => ({ x: side(r, 9, 40), y: r.range(-12, 10), scale: r.range(0.8, 2.2), rotY: 0 }),
        },
        {
          capacity: 10,
          weight: 0.4,
          parts: [
            { geometry: cyl, material: std('#132029'), position: [0, 0.5, 0], scale: [0.08, 1, 0.08] },
            { geometry: torus, material: glow('#ffb020', 2.5), position: [0, 0.92, 0], scale: [0.5, 0.5, 0.5] },
          ],
          spin: 0.2,
          place: (r) => ({ x: side(r, 160, 240), y: -120, scale: r.range(220, 300), rotY: 0 }),
        },
      ],
    },
    {
      name: 'Crystal Desert',
      skyTop: c('#3a1d4f'),
      skyHorizon: c('#f0a35e'),
      skyBottom: c('#c97a4a'),
      fog: c('#d8925f'),
      hemiSky: c('#ffd7a8'),
      hemiGround: c('#8a4a2a'),
      sun: c('#ffe2b0'),
      particle: c('#ffe0a0'),
      fogNear: 50,
      fogFar: 330,
      props: [
        {
          capacity: 60,
          weight: 4,
          parts: [{ geometry: octa, material: glow('#ffc46b', 0.8, { metalness: 0.4, roughness: 0.2 }), scale: [0.4, 1, 0.4] }],
          place: (r) => ({ x: side(r, 14, 80), y: r.range(-40, -10), scale: r.range(14, 40), rotY: r.range(0, 6.28), tilt: r.range(-0.3, 0.3) }),
        },
        {
          capacity: 40,
          weight: 2.5,
          parts: [{ geometry: dodeca, material: std('#a0583a') }],
          spin: 0.15,
          place: (r) => ({ x: side(r, 10, 60), y: r.range(-6, 18), scale: r.range(2, 8), rotY: r.range(0, 6.28) }),
        },
        {
          capacity: 30,
          weight: 2,
          parts: [{ geometry: sphere, material: std('#d49660', { roughness: 1 }), scale: [1, 0.18, 1] }],
          place: (r) => ({ x: side(r, 30, 140), y: r.range(-34, -26), scale: r.range(50, 110), rotY: 0 }),
        },
        {
          capacity: 8,
          weight: 0.35,
          parts: [
            { geometry: box, material: std('#5b2f3c'), position: [0, 0.5, 0], scale: [0.25, 1, 0.25] },
            { geometry: octa, material: glow('#5ee7ff', 2.4), position: [0, 1.15, 0], scale: [0.3, 0.4, 0.3] },
          ],
          place: (r) => ({ x: side(r, 150, 220), y: -60, scale: r.range(160, 230), rotY: r.range(0, 6.28) }),
        },
      ],
    },
    {
      name: 'Forge Core',
      skyTop: c('#0d0d14'),
      skyHorizon: c('#5a3b2a'),
      skyBottom: c('#1b1210'),
      fog: c('#3a2a22'),
      hemiSky: c('#ffb27a'),
      hemiGround: c('#20160f'),
      sun: c('#ffcf9a'),
      particle: c('#ff9a3c'),
      fogNear: 35,
      fogFar: 280,
      props: [
        {
          capacity: 50,
          weight: 4,
          parts: [
            { geometry: box, material: std('#23232b', { metalness: 0.6, roughness: 0.5 }), position: [0, 0.5, 0] },
            { geometry: box, material: glow('#ff8a1f', 2), position: [0, 0.75, 0.51], scale: [0.7, 0.04, 0.02] },
            { geometry: box, material: glow('#22d3ee', 1.5), position: [0, 0.45, 0.51], scale: [0.5, 0.03, 0.02] },
          ],
          place: (r) => ({ x: side(r, 14, 70), y: r.range(-60, -30), scale: r.range(10, 18), sy: r.range(3, 7), rotY: r.range(-0.3, 0.3) }),
        },
        {
          capacity: 30,
          weight: 2.5,
          parts: [{ geometry: gear, material: std('#3a3a44', { metalness: 0.8, roughness: 0.35 }) }],
          spin: 0.8,
          place: (r) => ({ x: side(r, 12, 45), y: r.range(-8, 14), scale: r.range(6, 16), rotY: Math.PI / 2 }),
        },
        {
          capacity: 30,
          weight: 2,
          parts: [{ geometry: cyl, material: glow('#ff6a1f', 1.1, { metalness: 0.5 }) }],
          place: (r) => ({ x: side(r, 10, 40), y: r.range(-14, 6), scale: r.range(0.8, 1.6), sy: r.range(30, 70), rotY: 0, tilt: Math.PI / 2 }),
        },
      ],
    },
    {
      name: 'Skyfall Kingdom',
      skyTop: c('#2f5f9e'),
      skyHorizon: c('#9cc7ef'),
      skyBottom: c('#5f86b5'),
      fog: c('#8fb6df'),
      hemiSky: c('#e8f4ff'),
      hemiGround: c('#3f5f80'),
      sun: c('#ffffff'),
      particle: c('#ffffff'),
      fogNear: 50,
      fogFar: 340,
      props: [
        {
          capacity: 40,
          weight: 3,
          parts: [
            { geometry: cone, material: std('#5a4a5e'), position: [0, -0.5, 0], scale: [1, 1, 1] },
            { geometry: cyl, material: std('#7fc27a'), position: [0, 0.02, 0], scale: [1, 0.08, 1] },
            { geometry: cyl, material: std('#e9e4f2'), position: [0.15, 0.4, 0], scale: [0.12, 0.7, 0.12] },
            { geometry: cone, material: glow('#ffb020', 1.2), position: [0.15, 0.85, 0], scale: [0.18, 0.25, 0.18] },
          ],
          place: (r) => ({ x: side(r, 16, 90), y: r.range(-25, 15), scale: r.range(10, 26), rotY: r.range(0, 6.28) }),
        },
        {
          capacity: 50,
          weight: 3,
          parts: [
            { geometry: sphere, material: std('#ffffff', { roughness: 1, transparent: true, opacity: 0.85 }), scale: [1, 0.55, 1] },
            { geometry: sphere, material: std('#f2f6ff', { roughness: 1, transparent: true, opacity: 0.85 }), position: [0.6, 0.1, 0.2], scale: [0.7, 0.45, 0.7] },
          ],
          place: (r) => ({ x: side(r, 10, 100), y: r.range(-30, 0), scale: r.range(8, 22), rotY: r.range(0, 6.28) }),
        },
        {
          capacity: 30,
          weight: 1.5,
          parts: [{ geometry: box, material: std('#0f1014', { roughness: 0.3, metalness: 0.4 }) }],
          spin: 0.05,
          place: (r) => ({ x: side(r, 8, 30), y: r.range(4, 16), scale: r.range(3, 7), sy: 0.5, rotY: r.range(0, 1) }),
        },
      ],
    },
    {
      name: 'Abyssal Neon',
      skyTop: c('#010208'),
      skyHorizon: c('#0b2236'),
      skyBottom: c('#02060c'),
      fog: c('#061826'),
      hemiSky: c('#4fd1ff'),
      hemiGround: c('#140a20'),
      sun: c('#9fe8ff'),
      particle: c('#22d3ee'),
      fogNear: 30,
      fogFar: 260,
      props: [
        {
          capacity: 40,
          weight: 3,
          parts: [{ geometry: torus, material: glow('#22d3ee', 2.4) }],
          spin: 0.4,
          place: (r) => ({ x: side(r, 12, 60), y: r.range(-10, 20), scale: r.range(6, 18), rotY: r.range(0, 6.28), tilt: r.range(-0.6, 0.6) }),
        },
        {
          capacity: 40,
          weight: 3,
          parts: [
            { geometry: box, material: std('#080b14', { metalness: 0.7, roughness: 0.25 }), position: [0, 0.5, 0] },
            { geometry: box, material: glow('#ffb020', 2.2), position: [0, 0.6, 0.51], scale: [0.08, 0.8, 0.02] },
          ],
          place: (r) => ({ x: side(r, 14, 70), y: r.range(-70, -40), scale: r.range(6, 12), sy: r.range(5, 10), rotY: r.range(0, 6.28) }),
        },
        {
          capacity: 50,
          weight: 2,
          parts: [
            { geometry: sphere, material: glow('#ff4fd8', 1.8, { transparent: true, opacity: 0.85 }), scale: [1, 0.7, 1] },
            { geometry: cone, material: glow('#7a5cff', 1.2, { transparent: true, opacity: 0.6 }), position: [0, -0.9, 0], scale: [0.6, 1.4, 0.6] },
          ],
          place: (r) => ({ x: side(r, 8, 40), y: r.range(-10, 14), scale: r.range(1, 3), rotY: 0 }),
        },
      ],
    },
  ]
}

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`

const skyFragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSun;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.6)) : mix(uHorizon, uBottom, pow(clamp(-h, 0.0, 1.0), 0.5));
  float s = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
  col += uSun * (pow(s, 64.0) * 0.9 + pow(s, 6.0) * 0.18);
  gl_FragColor = vec4(col, 1.0);
}
`

const particleVertex = /* glsl */ `
uniform float uCamZ;
uniform float uTime;
uniform float uPixelRatio;
attribute float aSeed;
varying float vAlpha;
void main() {
  vec3 p = position;
  p.y += sin(uTime * 0.6 + aSeed * 6.28) * 1.5;
  p.x += cos(uTime * 0.4 + aSeed * 3.1) * 1.0;
  p.z = mod(p.z - uCamZ, 220.0) + uCamZ - 30.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (2.0 + aSeed * 3.0) * uPixelRatio * (60.0 / -mv.z);
  vAlpha = 0.35 + 0.5 * aSeed;
}
`

const particleFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  gl_FragColor = vec4(uColor, (1.0 - d * 2.0) * vAlpha);
}
`

export class EnvironmentManager {
  readonly biomes: BiomeDef[]
  readonly hemi: THREE.HemisphereLight
  readonly sun: THREE.DirectionalLight
  private sky: THREE.Mesh
  private skyMat: THREE.ShaderMaterial
  private particles: THREE.Points
  private particleMat: THREE.ShaderMaterial
  private meshes: THREE.InstancedMesh[][][] = []
  private freeSlots: number[][][] = []
  private active: ActiveProp[] = []
  private propCursor = 0
  private rng: Rng = createRng(7)
  private density = 1
  private tmpColor = new THREE.Color()
  private tmpColor2 = new THREE.Color()
  private tmpMatrix = new THREE.Matrix4()
  private tmpQuat = new THREE.Quaternion()
  private tmpEuler = new THREE.Euler()
  private tmpPos = new THREE.Vector3()
  private tmpScale = new THREE.Vector3()
  private hueShift = 0
  currentBiomeName = 'Neon Canopy'

  constructor(private scene: THREE.Scene) {
    this.biomes = buildBiomes()

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uBottom: { value: new THREE.Color() },
        uSun: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0.4, 0.35, 1) },
      },
    })
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 24, 16), this.skyMat)
    this.sky.frustumCulled = false
    this.sky.renderOrder = -10
    scene.add(this.sky)

    scene.fog = new THREE.Fog(0x000000, 40, 300)

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 1.1)
    scene.add(this.hemi)

    this.sun = new THREE.DirectionalLight(0xffffff, 1.6)
    this.sun.position.set(12, 24, -8)
    this.sun.shadow.camera.left = -18
    this.sun.shadow.camera.right = 18
    this.sun.shadow.camera.top = 18
    this.sun.shadow.camera.bottom = -18
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 80
    this.sun.shadow.bias = -0.0008
    scene.add(this.sun)
    scene.add(this.sun.target)

    // Ambient floating particles, wrapped around the camera in the vertex shader.
    const count = 700
    const pos = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const r = createRng(99)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = r.range(-70, 70)
      pos[i * 3 + 1] = r.range(-20, 35)
      pos[i * 3 + 2] = r.range(0, 220)
      seeds[i] = r.next()
    }
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    pg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    this.particleMat = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uCamZ: { value: 0 },
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uColor: { value: new THREE.Color('#ffffff') },
      },
    })
    this.particles = new THREE.Points(pg, this.particleMat)
    this.particles.frustumCulled = false
    scene.add(this.particles)

    // Instanced background props, one InstancedMesh per prop part.
    this.biomes.forEach((biome, bi) => {
      this.meshes[bi] = []
      this.freeSlots[bi] = []
      biome.props.forEach((prop, pi) => {
        this.meshes[bi][pi] = prop.parts.map((part) => {
          const mesh = new THREE.InstancedMesh(part.geometry, part.material, prop.capacity)
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
          mesh.frustumCulled = false
          const zero = new THREE.Matrix4().makeScale(0, 0, 0)
          for (let i = 0; i < prop.capacity; i++) mesh.setMatrixAt(i, zero)
          mesh.count = prop.capacity
          scene.add(mesh)
          return mesh
        })
        this.freeSlots[bi][pi] = Array.from({ length: prop.capacity }, (_, i) => prop.capacity - 1 - i)
      })
    })
  }

  setQuality(q: Quality, pixelRatio: number) {
    this.density = q === 'low' ? 0.45 : q === 'medium' ? 0.75 : 1
    this.particles.visible = q !== 'low'
    this.particleMat.uniforms.uPixelRatio.value = pixelRatio
  }

  reset(seed: number) {
    this.rng = createRng(seed ^ 0x5bd1e995)
    for (const a of this.active) this.releaseProp(a)
    this.active = []
    this.propCursor = -60
  }

  biomeIndexAt(z: number) {
    const seg = Math.floor(Math.max(0, z) / BIOME_LENGTH)
    return seg % this.biomes.length
  }

  private blendAt(z: number) {
    const zc = Math.max(0, z)
    const seg = Math.floor(zc / BIOME_LENGTH)
    const local = zc - seg * BIOME_LENGTH
    const a = seg % this.biomes.length
    const b = (seg + 1) % this.biomes.length
    const t = THREE.MathUtils.smoothstep(local, BIOME_LENGTH - BLEND_LENGTH, BIOME_LENGTH)
    const cycle = Math.floor(seg / this.biomes.length)
    return { a, b, t, cycle }
  }

  private mixColor(out: THREE.Color, key: keyof Pick<BiomeDef, 'skyTop' | 'skyHorizon' | 'skyBottom' | 'fog' | 'hemiSky' | 'hemiGround' | 'sun' | 'particle'>, a: number, b: number, t: number) {
    out.copy(this.biomes[a][key]).lerp(this.tmpColor2.copy(this.biomes[b][key]), t)
    if (this.hueShift) out.offsetHSL(this.hueShift, 0, 0)
    return out
  }

  update(playerZ: number, cameraPos: THREE.Vector3, time: number, dt: number) {
    const { a, b, t, cycle } = this.blendAt(playerZ)
    this.hueShift = ((cycle * 0.061) % 0.25) * (cycle % 2 === 0 ? 1 : -1)
    this.currentBiomeName = this.biomes[t > 0.5 ? b : a].name
    const u = this.skyMat.uniforms
    this.mixColor(u.uTop.value, 'skyTop', a, b, t)
    this.mixColor(u.uHorizon.value, 'skyHorizon', a, b, t)
    this.mixColor(u.uBottom.value, 'skyBottom', a, b, t)
    this.mixColor(u.uSun.value, 'sun', a, b, t)
    const fog = this.scene.fog as THREE.Fog
    this.mixColor(fog.color, 'fog', a, b, t)
    fog.near = THREE.MathUtils.lerp(this.biomes[a].fogNear, this.biomes[b].fogNear, t)
    fog.far = THREE.MathUtils.lerp(this.biomes[a].fogFar, this.biomes[b].fogFar, t)
    this.mixColor(this.hemi.color, 'hemiSky', a, b, t)
    this.mixColor(this.hemi.groundColor, 'hemiGround', a, b, t)
    this.mixColor(this.sun.color, 'sun', a, b, t)
    this.mixColor(this.particleMat.uniforms.uColor.value, 'particle', a, b, t)
    this.particleMat.uniforms.uCamZ.value = cameraPos.z
    this.particleMat.uniforms.uTime.value = time
    this.sky.position.copy(cameraPos)

    // Recycle props behind, spawn props ahead.
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]
      if (p.z < playerZ - 80) {
        this.releaseProp(p)
        this.active.splice(i, 1)
      }
    }
    const horizon = playerZ + 330
    let guard = 0
    while (this.propCursor < horizon && guard++ < 200) {
      this.spawnProp(this.propCursor)
      this.propCursor += this.rng.range(3, 8) / this.density
    }

    // Animate spinning props.
    for (const p of this.active) {
      if (!p.spin) continue
      p.rot += p.spin * dt
      this.composeProp(p)
      this.writeProp(p)
    }
  }

  private spawnProp(z: number) {
    const bi = this.biomeIndexAt(z + this.rng.range(-BLEND_LENGTH / 2, BLEND_LENGTH / 2))
    const biome = this.biomes[bi]
    const pi = this.rng.weighted(biome.props.map((p, i) => [i, p.weight] as const))
    const slots = this.freeSlots[bi][pi]
    if (!slots.length) return
    const index = slots.pop()!
    const def = biome.props[pi]
    const placed = def.place(this.rng)
    const p: ActiveProp = {
      biome: bi,
      prop: pi,
      index,
      z,
      matrix: new THREE.Matrix4(),
      spin: def.spin ? def.spin * this.rng.range(0.6, 1.4) * (this.rng.chance(0.5) ? 1 : -1) : 0,
      rot: placed.rotY,
      base: {
        x: placed.x,
        y: placed.y,
        scale: placed.scale,
        sx: placed.sx ?? 1,
        sy: placed.sy ?? 1,
        tilt: placed.tilt ?? 0,
      },
    }
    this.composeProp(p)
    this.writeProp(p)
    this.active.push(p)
  }

  private composeProp(p: ActiveProp) {
    const { x, y, scale, sx, sy, tilt } = p.base
    this.tmpPos.set(x, y, p.z)
    this.tmpEuler.set(tilt, p.rot, 0)
    this.tmpQuat.setFromEuler(this.tmpEuler)
    this.tmpScale.set(scale * sx, scale * sy, scale * sx)
    p.matrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale)
  }

  private writeProp(p: ActiveProp) {
    const def = this.biomes[p.biome].props[p.prop]
    const meshes = this.meshes[p.biome][p.prop]
    def.parts.forEach((part, i) => {
      const local = this.tmpMatrix.compose(
        this.tmpPos.set(...(part.position ?? [0, 0, 0])),
        this.tmpQuat.identity(),
        this.tmpScale.set(...(part.scale ?? [1, 1, 1])),
      )
      const m = local.premultiply(p.matrix)
      meshes[i].setMatrixAt(p.index, m)
      meshes[i].instanceMatrix.needsUpdate = true
    })
  }

  private releaseProp(p: ActiveProp) {
    const zero = this.tmpMatrix.makeScale(0, 0, 0)
    for (const mesh of this.meshes[p.biome][p.prop]) {
      mesh.setMatrixAt(p.index, zero)
      mesh.instanceMatrix.needsUpdate = true
    }
    this.freeSlots[p.biome][p.prop].push(p.index)
  }

  get fogColor() {
    return (this.scene.fog as THREE.Fog).color
  }

  tint(out: THREE.Color) {
    return out.copy(this.tmpColor.copy(this.hemi.color))
  }
}
