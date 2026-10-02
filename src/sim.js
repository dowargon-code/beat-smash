/* Beat Smash combat simulation. No DOM. The beat clock never freezes. */
(function () {
  'use strict'

  const W = 1280
  const H = 720
  const STEP = 1 / 60
  const BPM = 120
  const BEAT = 60 / BPM
  const WINDOW_EARLY = 0.1
  const WINDOW_LATE = 0.08
  const ROUND_TIME = 50
  const GRAVITY = 2200
  const MAX_FALL = 1400
  const JUMP_V = -980
  const ARENA = { x: 64, y: 118, w: 1152, h: 488 }
  const FLOOR = ARENA.y + ARENA.h - 28

  const CAST = [
    { name: 'ドン', romaji: 'DON', color: '#FF3B5C', dark: '#7A1028', accent: '#FFD5DE', ink: '#3a0612' },
    { name: 'パチ', romaji: 'PACHI', color: '#2EE6A6', dark: '#0B6A4E', accent: '#D7FFF2', ink: '#04281c' },
    { name: 'シャリ', romaji: 'SHARI', color: '#FFC233', dark: '#8A5A00', accent: '#FFF3CC', ink: '#3a2500' },
    { name: 'カン', romaji: 'KAN', color: '#B08CFF', dark: '#4A2C96', accent: '#EFE6FF', ink: '#1c0e3a' },
  ]

  const ATTACKS = {
    light: {
      startup: 0.055,
      active: 0.09,
      recovery: 0.16,
      damageOff: 5,
      damageOn: 11,
      kbOff: 360,
      kbOn: 760,
      liftOff: 280,
      liftOn: 860,
      stunOff: 0.18,
      stunOn: 0.32,
      hitstopOff: 0.045,
      hitstopOn: 0.12,
      range: 74,
      height: 48,
      shakeOff: 3,
      shakeOn: 9,
    },
    heavy: {
      startup: 0.17,
      active: 0.11,
      recovery: 0.32,
      damageOff: 8,
      damageOn: 18,
      kbOff: 520,
      kbOn: 1180,
      liftOff: 460,
      liftOn: 1280,
      stunOff: 0.26,
      stunOn: 0.5,
      hitstopOff: 0.07,
      hitstopOn: 0.2,
      range: 112,
      height: 56,
      shakeOff: 6,
      shakeOn: 15,
    },
  }

  function beatPhase(t) {
    const m = t % BEAT
    return m < 0 ? m + BEAT : m
  }

  function beatOffset(t) {
    const phase = beatPhase(t)
    const until = phase === 0 ? 0 : BEAT - phase
    if (until < phase) return -until
    return phase === BEAT ? 0 : phase
  }

  function timeUntilBeat(t) {
    const phase = beatPhase(t)
    return phase === 0 ? 0 : BEAT - phase
  }

  function onBeat(t) {
    const o = beatOffset(t)
    return o >= -WINDOW_EARLY && o <= WINDOW_LATE
  }

  function beatPulse(t) {
    return Math.exp(-beatPhase(t) * 8)
  }

  function emptyIntent() {
    return { x: 0, y: 0, jump: false, releaseJump: false, light: false, heavy: false, dodge: false }
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v
  }

  function spawnXs(count) {
    const fracs = { 2: [0.3, 0.7], 3: [0.22, 0.5, 0.78], 4: [0.16, 0.38, 0.62, 0.84] }
    const list = fracs[count] || fracs[2]
    return list.map((f) => ARENA.x + ARENA.w * f)
  }

  function makePlayer(i, x, cpu, greed, padSlot) {
    const c = CAST[i]
    return {
      index: i,
      name: c.name,
      romaji: c.romaji,
      color: c.color,
      dark: c.dark,
      accent: c.accent,
      ink: c.ink,
      cpu: !!cpu,
      padSlot: padSlot == null ? -1 : padSlot,
      greed: greed == null ? 0.28 + i * 0.08 : greed,
      x,
      y: FLOOR,
      vx: 0,
      vy: 0,
      w: 58,
      h: 58,
      facing: x < W / 2 ? 1 : -1,
      hp: 120,
      maxHp: 120,
      alive: true,
      state: 'idle',
      stateT: 0,
      onGround: true,
      iframes: 0,
      // dodgeCd: 0.25,
      // 2026/10/01 変更 ---＞
      dodgeCd: 0,
      // <--- 2026/10/01 変更
      coyote: 0.1,
      jumpBuffer: 0,
      attack: null,
      attackOnBeat: false,
      didHit: false,
      hitTargets: [],
      lunged: false,
      hitstun: 0,
      angle: 0,
      spinV: 0,
      glow: 0,
      flash: 0,
      squash: 0,
      deadT: 0,
      buffer: null,
      intent: emptyIntent(),
      lastIntent: emptyIntent(),
      thinkT: Math.random() * 0.35,
      barkT: 0,
      damageDealt: 0,
      onBeatHits: 0,
      offBeatHits: 0,
      kos: 0,
      trail: [],
      blink: Math.random() * 4,
    }
  }

  function createMatch(options) {
    const opts = options || {}
    const count = opts.count || 2
    const xs = spawnXs(count)
    const players = []
    for (let i = 0; i < count; i++) {
      const cpu = !!(opts.cpus && opts.cpus[i])
      const pad = opts.padSlots ? opts.padSlots[i] : -1
      players.push(makePlayer(i, xs[i], cpu, opts.greed, pad))
    }
    const skip = !!opts.skipCountdown
    return {
      state: skip ? 'fight' : 'countdown',
      count,
      players,
      clock: 0,
      countdown: skip ? 0 : 3,
      countShown: 4,
      timer: ROUND_TIME,
      finale: null,
      finaleTime: opts.finaleTime || 1.15,
      winner: null,
      paused: false,
      hitstop: 0,
      banner: null,
      confetti: false,
      events: [],
      fx: {
        particles: [],
        texts: [],
        rings: [],
        flash: 0,
        shake: 0,
        shakeX: 0,
        shakeY: 0,
        shakeVX: 0,
        shakeVY: 0,
        zoom: 1,
        zoomX: W / 2,
        zoomY: H / 2,
        lastBeat: -1,
      },
    }
  }

  function bodyBox(p) {
    return { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h }
  }

  function hitBox(p) {
    if (!p.alive || p.state !== 'attack' || !p.attack) return null
    const a = ATTACKS[p.attack]
    if (p.stateT < a.startup || p.stateT >= a.startup + a.active) return null
    const w = a.range
    const h = a.height
    const x = p.facing === 1 ? p.x + p.w * 0.22 : p.x - p.w * 0.22 - w
    const y = p.y - p.h + (p.h - h) * 0.42
    return { x, y, w, h }
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  }

  function floater(match, x, y, text, color, size) {
    match.fx.texts.push({
      x,
      y,
      vy: -70,
      text,
      life: 0.75,
      max: 0.75,
      color,
      size,
    })
    if (match.fx.texts.length > 24) match.fx.texts.splice(0, match.fx.texts.length - 24)
  }

  function burst(match, x, y, color, n, speed, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.35 + Math.random() * 0.85)
      match.fx.particles.push({
        type: 'spark',
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life,
        max: life,
        color,
        size: 3 + Math.random() * 4,
        g: 900,
      })
    }
    trimParticles(match)
  }

  function streaks(match, x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.5 + Math.random())
      match.fx.particles.push({
        type: 'streak',
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.22,
        max: 0.22,
        color,
        size: 2,
        g: 0,
        len: 18 + Math.random() * 20,
      })
    }
    trimParticles(match)
  }

  function ring(match, x, y, color, grow, life, width) {
    match.fx.rings.push({ x, y, r: 8, grow, life, max: life, color, width })
  }

  function trimParticles(match) {
    const list = match.fx.particles
    if (list.length > 320) list.splice(0, list.length - 320)
  }

  function bark(match, p, text, color, size) {
    if (p.barkT > 0) return
    p.barkT = 0.34
    floater(match, p.x, p.y - p.h - 8, text, color, size)
  }

  function emitBeat(match) {
    const idx = Math.floor(match.clock / BEAT + 1e-6)
    while (match.fx.lastBeat < idx) {
      match.fx.lastBeat++
      match.events.push({ type: 'beat', index: match.fx.lastBeat })
      match.fx.flash = Math.max(match.fx.flash, 0.05)
    }
  }

  function updateFx(match, dt) {
    const fx = match.fx
    fx.shakeX = fx.shakeVX
    fx.shakeY = fx.shakeVY
    const decay = Math.exp(-9 * dt)
    fx.shakeVX *= decay
    fx.shakeVY *= decay
    fx.shake *= decay
    fx.zoom += (1 - fx.zoom) * Math.min(1, dt * 7)
    fx.flash = Math.max(0, fx.flash - dt * 2.4)
    if (match.banner) {
      match.banner.life -= dt
      if (match.banner.life <= 0) match.banner = null
    }
    const parts = fx.particles
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      p.life -= dt
      p.vy += (p.g || 0) * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
    }
    fx.particles = parts.filter((p) => p.life > 0)
    const rings = fx.rings
    for (let i = 0; i < rings.length; i++) {
      rings[i].life -= dt
      rings[i].r += rings[i].grow * dt
    }
    fx.rings = rings.filter((r) => r.life > 0)
    const texts = fx.texts
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i]
      t.life -= dt
      t.y += t.vy * dt
    }
    fx.texts = texts.filter((t) => t.life > 0)
  }

  function addShake(match, amount, dir) {
    match.fx.shake = Math.max(match.fx.shake, amount)
    match.fx.shakeVX = (dir || 1) * amount
    match.fx.shakeVY = -amount * 0.55
  }

  function thinkCpu(match, p, dt) {
    p.thinkT -= dt
    const held = p.lastIntent || emptyIntent()
    if (p.thinkT > 0) {
      return {
        x: held.x,
        y: 0,
        jump: false,
        releaseJump: false,
        light: false,
        heavy: false,
        dodge: false,
      }
    }
    p.thinkT = 0.1 + Math.random() * 0.04
    const intent = emptyIntent()
    const foes = []
    for (let i = 0; i < match.players.length; i++) {
      const f = match.players[i]
      if (f !== p && f.alive) foes.push(f)
    }
    if (!foes.length) {
      p.lastIntent = intent
      return intent
    }
    let foe = foes[0]
    let best = Infinity
    for (let i = 0; i < foes.length; i++) {
      const d = Math.abs(foes[i].x - p.x) + Math.abs(foes[i].y - p.y) * 0.4
      if (d < best) {
        best = d
        foe = foes[i]
      }
    }
    const dx = foe.x - p.x
    const adx = Math.abs(dx)
    const dir = Math.sign(dx) || p.facing
    const off = beatOffset(match.clock)
    const now = onBeat(match.clock)
    const soon = off < 0 && off >= -0.12
    const busy = p.state === 'attack' || p.state === 'dodge' || p.state === 'hitstun'
    const dy = Math.abs(foe.y - p.y)
    const inLight = adx < 108 && dy < 90
    const inHeavy = adx < 150 && dy < 110

    if (adx > 96) intent.x = dir
    else if (adx < 34) intent.x = -dir
    else intent.x = 0

    if (foe.y < p.y - 90 && adx < 180 && Math.random() < 0.35) intent.jump = true

    const threatening =
      foe.state === 'attack' &&
      adx < 136 &&
      (Math.sign(p.x - foe.x) === foe.facing || adx < 40)
    if (threatening && p.dodgeCd <= 0 && !busy && Math.random() < 0.42) {
      intent.dodge = true
      intent.x = Math.sign(p.x - foe.x) || -foe.facing
      p.lastIntent = intent
      return intent
    }

    if (!busy && (inLight || inHeavy)) {
      const punish = foe.state === 'hitstun' && inLight
      if (punish && Math.random() < 0.55) {
        intent.light = true
      } else if (now && Math.random() < 0.8) {
        if (inHeavy && Math.random() < 0.42) intent.heavy = true
        else if (inLight) intent.light = true
        else if (Math.random() < 0.4) intent.heavy = true
      } else if ((soon && Math.random() < p.greed) || Math.random() < p.greed * 0.15) {
        if (inLight) intent.light = true
      }
    }

    p.lastIntent = intent
    return intent
  }

  function startAttack(match, p, kind, timed) {
    p.state = 'attack'
    p.attack = kind
    p.stateT = 0
    p.attackOnBeat = !!timed
    p.didHit = false
    p.hitTargets = []
    p.lunged = false
    if (timed) p.glow = 0.32
    match.events.push({ type: 'swing', attack: kind, onBeat: !!timed })
    if (kind === 'heavy') burst(match, p.x, p.y, p.accent, 4, 80, 0.2)
  }

  function startDodge(match, p, dirx) {
    const dir = dirx || p.facing || 1
    p.state = 'dodge'
    p.stateT = 0
    p.facing = dir < 0 ? -1 : 1
    p.vx = p.facing * 940
    p.vy = p.onGround ? 0 : Math.min(p.vy * 0.25, -40)
    p.iframes = 0.15
    p.dodgeCd = 0.82
    match.events.push({ type: 'dodge' })
  }

  function physics(match, p, dt, it) {
    let g = GRAVITY
    if (p.state === 'dodge') g *= 0.28
    if (it && it.y > 0 && p.vy > 0 && p.state !== 'dodge') g += 1900
    p.vy += g * dt
    if (p.vy > MAX_FALL) p.vy = MAX_FALL
    p.x += p.vx * dt
    p.y += p.vy * dt

    const left = ARENA.x + p.w / 2 + 12
    const right = ARENA.x + ARENA.w - p.w / 2 - 12
    if (p.x < left) {
      const speed = -p.vx
      p.x = left
      if (speed > 80 && p.state === 'hitstun') {
        p.vx = speed * 0.7
        p.spinV *= -0.6
        if (speed > 500) {
          addShake(match, 7, 1)
          burst(match, p.x, p.y - p.h / 2, '#fff6d0', 8, 220, 0.28)
          bark(match, p, 'バキン!', '#fff1a8', 28)
          match.events.push({ type: 'bounce' })
        }
      } else if (p.vx < 0) p.vx = 0
    } else if (p.x > right) {
      const speed = p.vx
      p.x = right
      if (speed > 80 && p.state === 'hitstun') {
        p.vx = -speed * 0.7
        p.spinV *= -0.6
        if (speed > 500) {
          addShake(match, 7, -1)
          burst(match, p.x, p.y - p.h / 2, '#fff6d0', 8, 220, 0.28)
          bark(match, p, 'バキン!', '#fff1a8', 28)
          match.events.push({ type: 'bounce' })
        }
      } else if (p.vx > 0) p.vx = 0
    }

    if (p.y - p.h < ARENA.y + 8 && p.vy < 0) {
      p.y = ARENA.y + 8 + p.h
      const speed = -p.vy
      p.vy = speed * 0.42
      if (p.state === 'hitstun' && speed > 500) {
        bark(match, p, 'ドン!', '#ffffff', 26)
        burst(match, p.x, p.y - p.h, '#ffe14a', 6, 160, 0.22)
      }
    }

    const wasGround = p.onGround
    if (p.y >= FLOOR && p.vy >= 0) {
      const impact = p.vy
      if (p.state === 'hitstun' && impact > 820) {
        p.y = FLOOR
        p.vy = -impact * 0.3
        p.onGround = false
        p.squash = 0.45
        bark(match, p, 'ボヨン', '#ffffff', 32)
        burst(match, p.x, FLOOR, p.color, 7, 180, 0.25)
        match.events.push({ type: 'bounce' })
        addShake(match, 6, Math.sign(p.vx) || 1)
      } else {
        p.y = FLOOR
        p.vy = 0
        p.onGround = true
        if (!wasGround && impact > 160) {
          p.squash = Math.min(0.42, impact / 2000)
          match.events.push({ type: 'land', heavy: impact > 520 })
          burst(match, p.x, FLOOR - 4, '#c9b6e2', 4, 90, 0.18)
        }
      }
    } else {
      p.onGround = false
    }

    if (p.onGround) p.coyote = 0.1
    else p.coyote -= dt

    p.angle += p.spinV * dt
    if (p.onGround && p.state !== 'hitstun') {
      p.spinV *= Math.exp(-12 * dt)
      p.angle *= Math.exp(-14 * dt)
    } else {
      p.spinV *= Math.exp(-0.4 * dt)
    }

    if (p.onGround && p.state === 'hitstun') p.vx *= Math.exp(-1.6 * dt)
  }

  function clampArena(p) {
    const left = ARENA.x + p.w / 2 + 12
    const right = ARENA.x + ARENA.w - p.w / 2 - 12
    if (p.x < left) p.x = left
    if (p.x > right) p.x = right
    if (p.y > FLOOR) p.y = FLOOR
  }

  function applyFighter(match, p, dt) {
    if (!p.alive && p.deadT > 1.15) {
      p.vx = 0
      p.vy = 0
      return
    }
    if (!p.alive) p.deadT += dt

    p.dodgeCd = Math.max(0, p.dodgeCd - dt)
    p.iframes = Math.max(0, p.iframes - dt)
    p.glow = Math.max(0, p.glow - dt)
    p.flash = Math.max(0, p.flash - dt)
    p.squash = Math.max(0, p.squash - dt * 2.4)
    p.barkT = Math.max(0, p.barkT - dt)
    p.blink += dt
    if (p.jumpBuffer > 0) p.jumpBuffer -= dt
    if (p.buffer && match.clock - p.buffer.t > 0.26) p.buffer = null

    const it = p.intent || emptyIntent()
    if (p.alive) {
      if (it.dodge) p.buffer = { kind: 'dodge', t: match.clock, x: it.x }
      else if (it.heavy) p.buffer = { kind: 'heavy', t: match.clock, onBeat: onBeat(match.clock) }
      else if (it.light) p.buffer = { kind: 'light', t: match.clock, onBeat: onBeat(match.clock) }
      if (it.jump) p.jumpBuffer = 0.12
    }

    if (p.state === 'attack') {
      p.stateT += dt
      const a = ATTACKS[p.attack]
      if (!p.lunged && p.stateT >= a.startup) {
        p.vx = p.facing * (p.attack === 'heavy' ? 260 : 110)
        p.lunged = true
      }
      if (p.stateT >= a.startup + a.active + a.recovery) {
        p.state = p.onGround ? 'idle' : 'air'
        p.attack = null
        p.lunged = false
      }
    } else if (p.state === 'dodge') {
      p.stateT += dt
      if (p.stateT >= 0.2) {
        p.state = p.onGround ? 'idle' : 'air'
        p.vx *= 0.45
      }
    } else if (p.state === 'hitstun') {
      p.stateT += dt
      p.hitstun -= dt
      if (p.hitstun <= 0) {
        p.hitstun = 0
        p.state = p.onGround ? 'idle' : 'air'
        p.iframes = Math.max(p.iframes, 0.1)
      }
    }

    if (!p.alive) {
      physics(match, p, dt, it)
      pushTrail(p, dt)
      return
    }

    const busy = p.state === 'attack' || p.state === 'dodge' || p.state === 'hitstun'
    // if (!busy && p.buffer) {
    //   const b = p.buffer
    //   p.buffer = null
    //   if (b.kind === 'dodge') {
    //     if (p.dodgeCd <= 0) startDodge(match, p, b.x || it.x || p.facing)
    //   } else {
    //     startAttack(match, p, b.kind, b.onBeat)
    //   }
    // }
    // 2026/10/01 変更 ---＞
    if (!busy && p.buffer) {
      const b = p.buffer
      const dodgeWaiting = b.kind === 'dodge' && p.dodgeCd > 0
      if (!dodgeWaiting) {
        p.buffer = null
        if (b.kind === 'dodge') startDodge(match, p, b.x || it.x || p.facing)
        else startAttack(match, p, b.kind, b.onBeat)
      }
    }
    // <--- 2026/10/01 変更

    const acting = p.state === 'attack' || p.state === 'dodge' || p.state === 'hitstun'
    if (!acting && p.jumpBuffer > 0 && (p.onGround || p.coyote > 0)) {
      p.vy = JUMP_V
      p.onGround = false
      p.coyote = 0
      p.jumpBuffer = 0
      p.state = 'air'
    }

    if (!acting && p.state !== 'attack' && p.state !== 'dodge' && p.state !== 'hitstun') {
      const accel = p.onGround ? 5400 : 3000
      const max = p.onGround ? 450 : 400
      if (it.x) {
        p.vx += it.x * accel * dt
        p.facing = it.x < 0 ? -1 : 1
      } else if (p.onGround) {
        p.vx *= Math.exp(-14 * dt)
      }
      p.vx = clamp(p.vx, -max, max)
      if (!p.onGround) p.state = 'air'
      else if (Math.abs(p.vx) > 40 && it.x) p.state = 'walk'
      else p.state = 'idle'
    } else if (p.state === 'attack') {
      p.vx *= Math.exp(-7 * dt)
    }

    if (it.releaseJump && p.vy < 0) p.vy *= 0.55
    physics(match, p, dt, it)
    pushTrail(p, dt)
  }

  function pushTrail(p, dt) {
    if (p.state === 'dodge' || Math.hypot(p.vx, p.vy) > 780) {
      p.trail.push({ x: p.x, y: p.y, angle: p.angle, life: 0.16 })
    }
    for (let i = 0; i < p.trail.length; i++) p.trail[i].life -= dt
    if (p.trail.length > 5) p.trail.splice(0, p.trail.length - 5)
    p.trail = p.trail.filter((tr) => tr.life > 0)
  }

  function separate(players) {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i]
        const b = players[j]
        if (!a.alive || !b.alive) continue
        if (a.state === 'hitstun' || b.state === 'hitstun') continue
        if (a.state === 'dodge' || b.state === 'dodge') continue
        const dx = b.x - a.x
        const overlapX = (a.w + b.w) / 2 + 2 - Math.abs(dx)
        const ay = a.y - a.h / 2
        const by = b.y - b.h / 2
        const overlapY = (a.h + b.h) / 2 - Math.abs(by - ay)
        if (overlapX > 0 && overlapY > 0) {
          const push = overlapX / 2
          const s = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx)
          if (a.state !== 'attack') a.x -= s * push
          if (b.state !== 'attack') b.x += s * push
        }
      }
    }
    for (let i = 0; i < players.length; i++) clampArena(players[i])
  }

  function applyHit(match, p, q) {
    const a = ATTACKS[p.attack]
    const on = !!p.attackOnBeat
    const dmg = on ? a.damageOn : a.damageOff
    q.hp = Math.max(0, q.hp - dmg)
    p.damageDealt += dmg
    if (on) p.onBeatHits++
    else p.offBeatHits++
    const dir = Math.sign(q.x - p.x) || p.facing
    const rage = 1 + (1 - q.hp / q.maxHp) * 0.55
    q.vx = clamp(dir * (on ? a.kbOn : a.kbOff) * rage, -1550, 1550)
    q.vy = Math.max(-(on ? a.liftOn : a.liftOff) * (0.82 + rage * 0.18), -1550)
    q.state = 'hitstun'
    q.hitstun = (on ? a.stunOn : a.stunOff) * (0.92 + rage * 0.12)
    q.stateT = 0
    q.attack = null
    q.onGround = false
    q.spinV = dir * (on ? 16 : 6.5)
    q.flash = on ? 0.16 : 0.08
    q.buffer = null
    const stop = on ? a.hitstopOn : a.hitstopOff
    match.hitstop = Math.max(match.hitstop, stop)
    addShake(match, on ? a.shakeOn : a.shakeOff, dir)
    const hx = (p.x + q.x) / 2
    const hy = q.y - q.h * 0.55
    if (on) {
      match.fx.zoom = p.attack === 'heavy' ? 1.075 : 1.045
      match.fx.zoomX = hx
      match.fx.zoomY = hy
      match.fx.flash = p.attack === 'heavy' ? 0.5 : 0.3
      const word = p.attack === 'heavy' ? 'ドカン!' : 'ジャスト!'
      floater(match, q.x, q.y - q.h - 28, word + ' ' + dmg, '#ffe14a', p.attack === 'heavy' ? 44 : 36)
      burst(match, hx, hy, '#ffe14a', p.attack === 'heavy' ? 22 : 14, p.attack === 'heavy' ? 520 : 380, 0.4)
      streaks(match, hx, hy, '#fff6c8', p.attack === 'heavy' ? 10 : 6, 640)
      ring(match, hx, hy, '#ffe14a', p.attack === 'heavy' ? 720 : 520, 0.28, 6)
      ring(match, hx, hy, '#ffffff', 420, 0.18, 3)
    } else {
      floater(match, q.x, q.y - q.h - 16, String(dmg), '#ffffff', 22)
      burst(match, hx, hy, '#ffffff', 6, 180, 0.22)
    }
    match.events.push({ type: 'hit', onBeat: on, attack: p.attack })

    if (q.hp <= 0) {
      q.alive = false
      q.state = 'dead'
      q.deadT = 0
      q.iframes = 99
      q.vy = Math.min(q.vy, -560)
      q.spinV = dir * 22
      p.kos++
      match.hitstop = Math.max(match.hitstop, 0.28)
      addShake(match, 18, dir)
      match.fx.flash = 0.72
      match.fx.zoom = 1.1
      match.fx.zoomX = q.x
      match.fx.zoomY = q.y - 40
      burst(match, q.x, q.y - q.h / 2, q.color, 28, 560, 0.55)
      streaks(match, q.x, q.y - q.h / 2, q.accent, 12, 700)
      ring(match, q.x, q.y - q.h / 2, q.color, 860, 0.4, 8)
      match.events.push({ type: 'ko' })
      match.banner = { text: 'ノックアウト!', life: 1.05, size: 78, color: '#ffe14a' }
    }
  }

  function resolveHits(match) {
    const living = []
    for (let i = 0; i < match.players.length; i++) {
      if (match.players[i].alive) living.push(match.players[i])
    }
    const active = []
    for (let i = 0; i < living.length; i++) {
      const box = hitBox(living[i])
      if (box) active.push({ p: living[i], box })
    }
    const clashed = new Set()
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        if (aabb(active[i].box, active[j].box)) {
          clashed.add(active[i].p.index)
          clashed.add(active[j].p.index)
        }
      }
    }
    if (clashed.size) {
      let cx = 0
      let cy = 0
      let n = 0
      for (let i = 0; i < living.length; i++) {
        const p = living[i]
        if (!clashed.has(p.index)) continue
        p.didHit = true
        p.hitTargets = p.hitTargets || []
        p.vx = -p.facing * 320
        p.vy = -220
        p.state = 'hitstun'
        p.hitstun = 0.18
        p.stateT = 0
        p.attack = null
        p.onGround = false
        cx += p.x
        cy += p.y - p.h / 2
        n++
      }
      match.hitstop = Math.max(match.hitstop, 0.09)
      addShake(match, 9, 1)
      floater(match, n ? cx / n : W / 2, n ? cy / n : H / 2, 'ガチッ!', '#ffffff', 46)
      burst(match, n ? cx / n : W / 2, n ? cy / n : H / 2, '#ffffff', 12, 300, 0.3)
      match.events.push({ type: 'clash' })
    }

    for (let i = 0; i < living.length; i++) {
      const p = living[i]
      if (clashed.has(p.index) || p.didHit) continue
      const box = hitBox(p)
      if (!box) continue
      for (let j = 0; j < living.length; j++) {
        const q = living[j]
        if (q === p || q.iframes > 0) continue
        if (p.hitTargets.indexOf(q.index) !== -1) continue
        if (!aabb(box, bodyBox(q))) continue
        applyHit(match, p, q)
        p.hitTargets.push(q.index)
      }
      if (p.hitTargets.length) p.didHit = true
    }
  }

  function conclude(match) {
    match.state = 'result'
    const alive = match.players.filter((p) => p.alive)
    if (alive.length === 1) match.winner = alive[0].index
    else if (alive.length > 1) {
      let max = -1
      for (let i = 0; i < alive.length; i++) if (alive[i].hp > max) max = alive[i].hp
      const top = alive.filter((p) => p.hp === max)
      match.winner = top.length === 1 ? top[0].index : null
    } else match.winner = null
    if (!match.confetti) {
      match.confetti = true
      const color = match.winner == null ? '#ffe14a' : match.players[match.winner].color
      burst(match, W / 2, H / 2 - 40, color, 36, 480, 0.8)
    }
  }

  function checkEnd(match, dt) {
    if (match.finale == null) {
      let alive = 0
      for (let i = 0; i < match.players.length; i++) if (match.players[i].alive) alive++
      if (alive <= 1 || match.timer <= 0) {
        match.finale = match.finaleTime
        if (alive <= 1) {
          if (!match.banner) match.banner = { text: 'ノックアウト!', life: 1.05, size: 78, color: '#ffe14a' }
        } else {
          match.banner = { text: 'タイムアップ!', life: 1.05, size: 72, color: '#ffffff' }
        }
      }
    } else {
      match.finale -= dt
      if (match.finale <= 0) conclude(match)
    }
  }

  function updateCountdown(match, dt) {
    match.countdown -= dt
    const shown = Math.ceil(match.countdown)
    if (shown > 0 && shown !== match.countShown) {
      match.countShown = shown
      match.events.push({ type: 'count', n: shown })
    }
    if (match.countdown <= 0) {
      match.state = 'fight'
      match.timer = ROUND_TIME
      match.banner = { text: 'GO!', life: 0.65, size: 120, color: '#ffffff' }
      match.events.push({ type: 'go' })
    }
  }

  function step(match, dt) {
    if (match.paused) return
    match.events.length = 0
    match.clock += dt
    emitBeat(match)

    if (match.state === 'countdown') {
      updateCountdown(match, dt)
      updateFx(match, dt)
      return
    }
    if (match.state === 'result') {
      updateFx(match, dt)
      return
    }

    const frozen = match.hitstop > 0 || match.finale != null
    if (match.hitstop > 0) match.hitstop -= dt

    if (!frozen) {
      for (let i = 0; i < match.players.length; i++) {
        const p = match.players[i]
        if (p.cpu) p.intent = thinkCpu(match, p, dt)
        applyFighter(match, p, dt)
      }
      resolveHits(match)
      separate(match.players)
      match.timer -= dt
      if (match.timer < 0) match.timer = 0
    } else {
      for (let i = 0; i < match.players.length; i++) {
        const p = match.players[i]
        const it = p.intent || emptyIntent()
        if (!p.alive) continue
        if (it.dodge) p.buffer = { kind: 'dodge', t: match.clock, x: it.x }
        else if (it.heavy) p.buffer = { kind: 'heavy', t: match.clock, onBeat: onBeat(match.clock) }
        else if (it.light) p.buffer = { kind: 'light', t: match.clock, onBeat: onBeat(match.clock) }
        if (it.jump) p.jumpBuffer = 0.12
      }
    }

    checkEnd(match, dt)
    updateFx(match, dt)
    // 2026/10/01 変更 ---＞
    for (let i = 0; i < match.players.length; i++) {
      const pressed = match.players[i].intent
      if (!pressed) continue
      pressed.light = false
      pressed.heavy = false
      pressed.dodge = false
      pressed.jump = false
      pressed.releaseJump = false
    }
    // <--- 2026/10/01 変更
  }

  globalThis.BeatSim = {
    W,
    H,
    STEP,
    BPM,
    BEAT,
    WINDOW_EARLY,
    WINDOW_LATE,
    ROUND_TIME,
    ARENA,
    FLOOR,
    CAST,
    ATTACKS,
    beatPhase,
    beatOffset,
    timeUntilBeat,
    onBeat,
    beatPulse,
    emptyIntent,
    createMatch,
    step,
    bodyBox,
    hitBox,
  }
})()
