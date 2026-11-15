type Sfx =
  | 'jump'
  | 'doubleJump'
  | 'land'
  | 'switch'
  | 'crystal'
  | 'bonus'
  | 'powerup'
  | 'nearMiss'
  | 'hit'
  | 'death'
  | 'respawn'
  | 'countdown'
  | 'go'
  | 'button'
  | 'gate'
  | 'shield'

const SCALE = [0, 3, 5, 7, 10, 12, 15, 17]
const PROGRESSION = [57, 53, 48, 55]

/** Fully synthesized audio: no asset downloads, works in Telegram WebViews after first gesture. */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private musicBus!: GainNode
  private sfxBus!: GainNode
  private noise!: AudioBuffer
  private musicTimer: number | null = null
  private nextNoteTime = 0
  private step = 0
  private musicVolume = 0.6
  private sfxVolume = 0.8
  intensity = 0
  private musicOn = false

  unlock() {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.9
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.ratio.value = 4
      this.master.connect(comp).connect(this.ctx.destination)
      this.musicBus = this.ctx.createGain()
      this.sfxBus = this.ctx.createGain()
      this.musicBus.connect(this.master)
      this.sfxBus.connect(this.master)
      this.applyVolumes()
      const len = this.ctx.sampleRate
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = music
    this.sfxVolume = sfx
    this.applyVolumes()
  }

  private applyVolumes() {
    if (!this.ctx) return
    this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.42, this.ctx.currentTime, 0.05)
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume * 0.7, this.ctx.currentTime, 0.02)
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return
    this.musicOn = true
    this.nextNoteTime = this.ctx.currentTime + 0.05
    this.step = 0
    this.musicTimer = window.setInterval(() => this.schedule(), 25)
  }

  stopMusic() {
    this.musicOn = false
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer)
    this.musicTimer = null
  }

  private schedule() {
    if (!this.ctx) return
    const bpm = 112 + this.intensity * 34
    const sixteenth = 60 / bpm / 4
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextNoteTime, sixteenth)
      this.nextNoteTime += sixteenth
      this.step = (this.step + 1) % 128
    }
  }

  private playStep(step: number, t: number, len: number) {
    const bar = Math.floor(step / 16) % PROGRESSION.length
    const root = PROGRESSION[bar]
    const s = step % 16
    if (s % 4 === 0) this.kick(t)
    if (s % 4 === 2) this.hat(t, 0.05)
    if (this.intensity > 0.25 && s % 2 === 1) this.hat(t, 0.025)
    if (s === 4 || s === 12) this.snare(t)
    if (s % 2 === 0) this.tone(t, this.midi(root - 24 + (s === 6 || s === 14 ? 12 : 0)), len * 1.8, 'sawtooth', 0.12, 420 + this.intensity * 900)
    const arpOn = this.intensity > 0.08
    if (arpOn) {
      const note = root + SCALE[(s * 3 + bar) % SCALE.length]
      this.tone(t, this.midi(note), len * 0.9, 'square', 0.035 + this.intensity * 0.03, 1800 + this.intensity * 2500)
    }
    if (s === 0) this.pad(t, root, len * 16)
  }

  private midi(n: number) {
    return 440 * Math.pow(2, (n - 69) / 12)
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  private tone(t: number, freq: number, dur: number, type: OscillatorType, vol: number, cutoff: number, bus = this.musicBus) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = cutoff
    const g = ctx.createGain()
    this.env(g, t, vol, 0.005, dur)
    o.connect(f).connect(g).connect(bus)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private pad(t: number, root: number, dur: number) {
    for (const n of [0, 7, 12]) {
      this.tone(t, this.midi(root + n), dur, 'triangle', 0.03, 1200)
    }
  }

  private kick(t: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
    const g = ctx.createGain()
    this.env(g, t, 0.5, 0.002, 0.22)
    o.connect(g).connect(this.musicBus)
    o.start(t)
    o.stop(t + 0.3)
  }

  private noiseHit(t: number, vol: number, dur: number, type: BiquadFilterType, freq: number, bus = this.musicBus) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = ctx.createGain()
    this.env(g, t, vol, 0.002, dur)
    src.connect(f).connect(g).connect(bus)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.05)
  }

  private hat(t: number, vol: number) {
    this.noiseHit(t, vol, 0.04, 'highpass', 8000)
  }

  private snare(t: number) {
    this.noiseHit(t, 0.12, 0.14, 'bandpass', 1800)
  }

  play(name: Sfx) {
    if (!this.ctx || this.ctx.state !== 'running') return
    const t = this.ctx.currentTime
    const bus = this.sfxBus
    switch (name) {
      case 'jump':
        this.sweep(t, 320, 640, 0.12, 'square', 0.12)
        break
      case 'doubleJump':
        this.sweep(t, 480, 1100, 0.16, 'square', 0.12)
        this.sweep(t + 0.03, 700, 1500, 0.12, 'sine', 0.08)
        break
      case 'land':
        this.noiseHit(t, 0.12, 0.08, 'lowpass', 600, bus)
        break
      case 'switch':
        this.sweep(t, 900, 300, 0.1, 'sawtooth', 0.07)
        this.noiseHit(t, 0.06, 0.1, 'bandpass', 3000, bus)
        break
      case 'crystal':
        this.tone(t, 1318 + Math.random() * 120, 0.12, 'sine', 0.14, 6000, bus)
        this.tone(t + 0.04, 1975, 0.1, 'sine', 0.08, 6000, bus)
        break
      case 'bonus':
        ;[0, 4, 7, 12].forEach((n, i) => this.tone(t + i * 0.05, this.midi(84 + n), 0.15, 'triangle', 0.13, 6000, bus))
        break
      case 'powerup':
        ;[0, 5, 9, 12, 17].forEach((n, i) => this.tone(t + i * 0.06, this.midi(72 + n), 0.2, 'square', 0.07, 4000, bus))
        break
      case 'nearMiss':
        this.sweep(t, 1500, 2400, 0.08, 'sine', 0.08)
        break
      case 'gate':
        this.tone(t, 880, 0.1, 'triangle', 0.08, 5000, bus)
        break
      case 'shield':
        this.sweep(t, 200, 900, 0.3, 'sawtooth', 0.12)
        break
      case 'hit':
      case 'death':
        this.noiseHit(t, 0.4, 0.5, 'lowpass', 1400, bus)
        this.sweep(t, 400, 60, 0.5, 'sawtooth', 0.2)
        break
      case 'respawn':
        this.sweep(t, 200, 1200, 0.4, 'triangle', 0.14)
        break
      case 'countdown':
        this.tone(t, 660, 0.12, 'square', 0.1, 3000, bus)
        break
      case 'go':
        this.tone(t, 1320, 0.25, 'square', 0.12, 4000, bus)
        break
      case 'button':
        this.tone(t, 990, 0.05, 'triangle', 0.08, 5000, bus)
        break
    }
  }

  private sweep(t: number, from: number, to: number, dur: number, type: OscillatorType, vol: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(from, t)
    o.frequency.exponentialRampToValueAtTime(to, t + dur)
    const g = ctx.createGain()
    this.env(g, t, vol, 0.005, dur)
    o.connect(g).connect(this.sfxBus)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  dispose() {
    this.stopMusic()
    void this.ctx?.close()
    this.ctx = null
  }
}
