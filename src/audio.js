/* Synthesized SFX locked to the match clock. No audio files. */
(function () {
  'use strict'

  const NOTES = [98.0, 123.47, 146.83, 130.81]
  let ctx = null
  let master = null
  let noiseBuf = null

  const Audio = {
    muted: false,
    unlocked: false,

    unlock() {
      const c = context()
      if (!c) return
      if (c.state === 'suspended') c.resume()
      this.unlocked = true
    },

    toggle() {
      this.muted = !this.muted
      if (master) master.gain.value = this.muted ? 0 : 0.8
      return this.muted
    },

    playAll(events) {
      if (!this.unlocked || this.muted || !events) return
      const c = context()
      if (!c) return
      const t = c.currentTime
      for (let i = 0; i < events.length; i++) play(c, t, events[i])
    },
  }

  function context() {
    if (ctx) return ctx
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.8
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -12
    comp.knee.value = 18
    comp.ratio.value = 3.2
    comp.attack.value = 0.003
    comp.release.value = 0.18
    master.connect(comp)
    comp.connect(ctx.destination)
    return ctx
  }

  function envGain(c, t, attack, hold, release, peak) {
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release)
    return g
  }

  function tone(c, t, dest, type, freq, freq2, dur, peak) {
    const o = c.createOscillator()
    const g = envGain(c, t, 0.008, dur * 0.35, dur * 0.65, peak)
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (freq2) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq2), t + dur)
    o.connect(g)
    g.connect(dest)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  function noise(c, t, dest, dur, peak, band) {
    if (!noiseBuf) {
      const len = c.sampleRate
      noiseBuf = c.createBuffer(1, len, c.sampleRate)
      const data = noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    const src = c.createBufferSource()
    src.buffer = noiseBuf
    src.loop = true
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = band
    filter.Q.value = 0.7
    const g = envGain(c, t, 0.004, dur * 0.2, dur * 0.8, peak)
    src.connect(filter)
    filter.connect(g)
    g.connect(dest)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  function play(c, t, ev) {
    const dest = master
    if (ev.type === 'beat') {
      tone(c, t, dest, 'sine', 168, 52, 0.16, 0.55)
      tone(c, t, dest, 'triangle', NOTES[(ev.index || 0) % 4], null, 0.22, 0.07)
      return
    }
    if (ev.type === 'swing') {
      noise(c, t, dest, ev.attack === 'heavy' ? 0.12 : 0.06, ev.onBeat ? 0.18 : 0.1, ev.attack === 'heavy' ? 500 : 900)
      if (ev.onBeat) tone(c, t, dest, 'square', 660, 880, 0.06, 0.05)
      return
    }
    if (ev.type === 'hit') {
      if (ev.onBeat) {
        noise(c, t, dest, 0.18, ev.attack === 'heavy' ? 0.45 : 0.32, 320)
        tone(c, t, dest, 'square', ev.attack === 'heavy' ? 220 : 360, 70, 0.22, 0.22)
        tone(c, t, dest, 'sawtooth', ev.attack === 'heavy' ? 440 : 620, 140, 0.16, 0.08)
      } else {
        noise(c, t, dest, 0.06, 0.16, 700)
        tone(c, t, dest, 'triangle', 240, 120, 0.07, 0.08)
      }
      return
    }
    if (ev.type === 'ko') {
      noise(c, t, dest, 0.4, 0.5, 180)
      tone(c, t, dest, 'sine', 140, 36, 0.45, 0.4)
      tone(c, t, dest, 'square', 90, 40, 0.35, 0.12)
      return
    }
    if (ev.type === 'dodge') {
      noise(c, t, dest, 0.12, 0.14, 1200)
      return
    }
    if (ev.type === 'clash') {
      tone(c, t, dest, 'square', 180, 90, 0.12, 0.18)
      noise(c, t, dest, 0.1, 0.2, 400)
      return
    }
    if (ev.type === 'bounce') {
      tone(c, t, dest, 'sine', 220, 140, 0.08, 0.1)
      return
    }
    if (ev.type === 'land') {
      noise(c, t, dest, 0.05, ev.heavy ? 0.12 : 0.05, 200)
      return
    }
    if (ev.type === 'count') {
      tone(c, t, dest, 'square', 520, 520, 0.08, 0.08)
      return
    }
    if (ev.type === 'go') {
      tone(c, t, dest, 'square', 660, 880, 0.14, 0.12)
      return
    }
  }

  globalThis.BeatAudio = Audio
})()
