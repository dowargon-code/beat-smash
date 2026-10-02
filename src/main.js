/* Input, loop, and screens. */
(function () {
  'use strict'

  const Sim = globalThis.BeatSim
  const Audio = globalThis.BeatAudio
  const Render = globalThis.BeatRender

  const KEYS = [
    {
      left: ['KeyA'],
      right: ['KeyD'],
      up: ['KeyW'],
      down: ['KeyS'],
      light: ['KeyJ'],
      heavy: ['KeyK'],
      dodge: ['KeyL'],
    },
    {
      left: ['ArrowLeft'],
      right: ['ArrowRight'],
      up: ['ArrowUp'],
      down: ['ArrowDown'],
      light: ['KeyI', 'Numpad1'],
      heavy: ['KeyO', 'Numpad2'],
      dodge: ['KeyP', 'Numpad3'],
    },
  ]

  const BLOCK = {
    Space: 1,
    ArrowUp: 1,
    ArrowDown: 1,
    ArrowLeft: 1,
    ArrowRight: 1,
    KeyW: 1,
    KeyA: 1,
    KeyS: 1,
    KeyD: 1,
  }

  const keyDown = new Set()
  const keyPrev = new Set()
  // 2026/10/01 変更 ---＞
  const uiEdge = new Set()
  // <--- 2026/10/01 変更
  const padPrev = [{}, {}, {}, {}]

  let screen = 'menu'
  let menuIndex = 1
  let match = null
  let matchPlan = null
  let attract = null
  let ui = []
  let mouse = null
  let debug = false
  let acc = 0
  let last = 0

  function makeAttract() {
    return Sim.createMatch({
      count: 2,
      cpus: [true, true],
      skipCountdown: true,
      greed: 0.7,
      finaleTime: 0.4,
    })
  }

  function connectedPads() {
    const list = []
    if (!navigator.getGamepads) return list
    const pads = navigator.getGamepads()
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) list.push(pads[i])
    }
    return list
  }

  function planRoster(index, padCount) {
    if (index === 0) {
      return {
        count: 2,
        cpus: [false, true],
        padSlots: [padCount > 0 ? 0 : -1, -1],
      }
    }
    const count = index + 1
    const cpus = []
    const padSlots = [-1, -1, -1, -1]
    for (let i = 0; i < count; i++) cpus.push(false)
    if (padCount >= count) {
      for (let i = 0; i < count; i++) padSlots[i] = i
    } else {
      let cursor = 0
      for (let i = 2; i < count; i++) {
        if (cursor < padCount) padSlots[i] = cursor++
      }
      for (let i = 0; i < Math.min(2, count); i++) {
        if (cursor < padCount) padSlots[i] = cursor++
      }
      for (let i = 2; i < count; i++) if (padSlots[i] < 0) cpus[i] = true
    }
    return { count, cpus, padSlots }
  }

  function notesFor(padCount) {
    return [
      'あなた vs CPU',
      'P1 + P2',
      padCount >= 1 ? 'P3 パッド' : 'P3 はCPU',
      padCount >= 2 ? 'P3 P4 パッド' : padCount === 1 ? 'P4 はCPU' : 'CPUが埋める',
    ]
  }

  function startMatch() {
    const pads = connectedPads()
    matchPlan = planRoster(menuIndex, pads.length)
    match = Sim.createMatch(matchPlan)
    screen = 'play'
    acc = 0
  }

  function replay() {
    match = Sim.createMatch(matchPlan)
  }

  function held(codes) {
    for (let i = 0; i < codes.length; i++) if (keyDown.has(codes[i])) return true
    return false
  }

  // function pressed(codes) {
  //   for (let i = 0; i < codes.length; i++) {
  //     if (keyDown.has(codes[i]) && !keyPrev.has(codes[i])) return true
  //   }
  //   return false
  // }
  // 2026/10/01 変更 ---＞
  function pressed(codes) {
    for (let i = 0; i < codes.length; i++) {
      if (uiEdge.has(codes[i])) return true
      if (keyDown.has(codes[i]) && !keyPrev.has(codes[i])) return true
    }
    return false
  }
  // <--- 2026/10/01 変更

  function anyEdge(codes) {
    return pressed(codes)
  }

  function readPad(slot) {
    const list = connectedPads()
    const gp = list[slot]
    if (!gp) return null
    const dead = 0.4
    let x = 0
    let y = 0
    if (gp.axes[0] < -dead) x = -1
    else if (gp.axes[0] > dead) x = 1
    if (gp.axes[1] < -dead) y = -1
    else if (gp.axes[1] > dead) y = 1
    const b = gp.buttons
    if (b[14] && b[14].pressed) x = -1
    if (b[15] && b[15].pressed) x = 1
    if (b[12] && b[12].pressed) y = -1
    if (b[13] && b[13].pressed) y = 1
    const now = {
      light: !!(b[0] && b[0].pressed),
      heavy: !!(b[1] && b[1].pressed),
      dodge: !!((b[2] && b[2].pressed) || (b[5] && b[5].pressed)),
      up: y < 0,
      down: y > 0,
      x,
      y,
    }
    const prev = padPrev[slot] || {}
    const out = {
      x: now.x,
      y: now.y,
      jump: now.up && !prev.up,
      releaseJump: !now.up && !!prev.up,
      light: now.light && !prev.light,
      heavy: now.heavy && !prev.heavy,
      dodge: now.dodge && !prev.dodge,
    }
    padPrev[slot] = now
    return out
  }

  function readHuman(player, useEdges) {
    const map = KEYS[player.index] || null
    const intent = Sim.emptyIntent()
    if (map) {
      if (held(map.left)) intent.x = -1
      else if (held(map.right)) intent.x = 1
      if (held(map.up)) intent.y = -1
      else if (held(map.down)) intent.y = 1
      if (useEdges) {
        intent.jump = pressed(map.up)
        intent.releaseJump = !held(map.up) && keyWas(map.up)
        intent.light = pressed(map.light)
        intent.heavy = pressed(map.heavy)
        intent.dodge = pressed(map.dodge)
      }
    }
    if (player.padSlot >= 0) {
      const pad = readPad(player.padSlot)
      if (pad) {
        if (pad.x) intent.x = pad.x
        if (pad.y) intent.y = pad.y
        if (useEdges) {
          intent.jump = intent.jump || pad.jump
          intent.releaseJump = intent.releaseJump || pad.releaseJump
          intent.light = intent.light || pad.light
          intent.heavy = intent.heavy || pad.heavy
          intent.dodge = intent.dodge || pad.dodge
        }
      }
    }
    return intent
  }

  function keyWas(codes) {
    for (let i = 0; i < codes.length; i++) if (keyPrev.has(codes[i])) return true
    return false
  }

  function applyIntents(target, useEdges) {
    if (!target) return
    for (let i = 0; i < target.players.length; i++) {
      const p = target.players[i]
      if (p.cpu) continue
      p.intent = readHuman(p, useEdges)
    }
  }

  function uiAction(id) {
    Audio.unlock()
    if (id === 'mute') {
      Audio.toggle()
      return
    }
    if (id.indexOf('mode-') === 0) {
      menuIndex = Number(id.slice(5))
      return
    }
    if (id === 'start') {
      startMatch()
      return
    }
    if (id === 'replay') {
      replay()
      return
    }
    if (id === 'back') {
      screen = 'menu'
      attract = makeAttract()
      return
    }
    if (id === 'resume' && match) match.paused = false
  }

  function menuEdges() {
    if (anyEdge(['ArrowLeft', 'KeyA'])) menuIndex = (menuIndex + 3) % 4
    if (anyEdge(['ArrowRight', 'KeyD'])) menuIndex = (menuIndex + 1) % 4
    if (anyEdge(['Digit1'])) menuIndex = 0
    if (anyEdge(['Digit2'])) menuIndex = 1
    if (anyEdge(['Digit3'])) menuIndex = 2
    if (anyEdge(['Digit4'])) menuIndex = 4 - 1
    if (anyEdge(['Enter', 'Space'])) startMatch()
  }

  function tick(dt, useEdges) {
    // if (useEdges && anyEdge(['KeyM'])) Audio.toggle()
    // 2026/10/01 変更 ---＞
    if (useEdges && anyEdge(['KeyM'])) Audio.toggle()
    if (useEdges && anyEdge(['F1'])) debug = !debug
    // <--- 2026/10/01 変更
    if (screen === 'menu') {
      if (!attract || attract.state === 'result') attract = makeAttract()
      if (useEdges) menuEdges()
      Sim.step(attract, dt)
      Audio.playAll(attract.events)
      return
    }
    if (!match) return
    if (match.state !== 'result' && useEdges && anyEdge(['Escape'])) {
      match.paused = !match.paused
    }
    if (match.state === 'result' && useEdges && anyEdge(['Enter', 'Space', 'KeyR'])) {
      replay()
      return
    }
    if (match.paused && useEdges && anyEdge(['Enter', 'Space'])) {
      match.paused = false
    }
    if (screen === 'play' && useEdges && anyEdge(['Escape']) && match.state === 'result') {
      screen = 'menu'
      attract = makeAttract()
      return
    }
    applyIntents(match, useEdges && !match.paused)
    Sim.step(match, dt)
    Audio.playAll(match.events)
  }

  function frame(now) {
    if (!last) last = now
    let dt = Math.min(0.05, (now - last) / 1000)
    last = now
    acc += dt
    let steps = 0
    let first = true
    while (acc >= Sim.STEP && steps < 5) {
      tick(Sim.STEP, first)
      first = false
      acc -= Sim.STEP
      steps++
    }
    if (steps === 5) acc = 0
    keyPrev.clear()
    keyDown.forEach((k) => keyPrev.add(k))
    // 2026/10/01 変更 ---＞
    if (steps > 0) uiEdge.clear()
    // <--- 2026/10/01 変更

    const pads = connectedPads()
    const view = {
      screen,
      match,
      attract,
      menuIndex,
      muted: Audio.muted,
      unlocked: Audio.unlocked,
      debug,
      mouse,
      notes: notesFor(pads.length),
    }
    ui = Render.draw(ctx, view)
    let pointer = false
    if (mouse) {
      for (let i = 0; i < ui.length; i++) if (hit(ui[i], mouse)) pointer = true
    }
    canvas.style.cursor = pointer ? 'pointer' : 'default'
    requestAnimationFrame(frame)
  }

  function hit(b, p) {
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h
  }

  function toGame(e) {
    const r = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * Sim.W,
      y: ((e.clientY - r.top) / r.height) * Sim.H,
    }
  }

  let canvas
  let ctx

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const maxW = window.innerWidth * 0.98
    const maxH = (window.innerHeight - 36) * 0.98
    const scale = Math.min(maxW / Sim.W, maxH / Sim.H)
    const cssW = Math.max(320, Math.floor(Sim.W * scale))
    const cssH = Math.max(180, Math.floor(Sim.H * scale))
    canvas.style.width = cssW + 'px'
    canvas.style.height = cssH + 'px'
    canvas.width = Math.floor(cssW * dpr)
    canvas.height = Math.floor(cssH * dpr)
    ctx.setTransform(canvas.width / Sim.W, 0, 0, canvas.height / Sim.H, 0, 0)
  }

  function boot() {
    canvas = document.getElementById('game')
    ctx = canvas.getContext('2d')
    attract = makeAttract()
    fit()
    window.addEventListener('resize', fit)
    // window.addEventListener('keydown', (e) => {
    //   keyDown.add(e.code)
    //   if (BLOCK[e.code] || e.code === 'Space') e.preventDefault()
    //   Audio.unlock()
    // })
    // 2026/10/01 変更 ---＞
    window.addEventListener('keydown', (e) => {
      keyDown.add(e.code)
      if (!e.repeat) uiEdge.add(e.code)
      if (BLOCK[e.code] || e.code === 'Space') e.preventDefault()
      Audio.unlock()
    })
    // <--- 2026/10/01 変更
    window.addEventListener('keyup', (e) => {
      keyDown.delete(e.code)
    })
    window.addEventListener('blur', () => {
      keyDown.clear()
      // 2026/10/01 変更 ---＞
      uiEdge.clear()
      // <--- 2026/10/01 変更
    })
    window.addEventListener('gamepadconnected', () => {})
    canvas.addEventListener('mousemove', (e) => {
      mouse = toGame(e)
    })
    canvas.addEventListener('mouseleave', () => {
      mouse = null
    })
    canvas.addEventListener('mousedown', () => {
      Audio.unlock()
    })
    canvas.addEventListener('click', (e) => {
      Audio.unlock()
      const p = toGame(e)
      for (let i = 0; i < ui.length; i++) {
        if (hit(ui[i], p)) {
          uiAction(ui[i].id)
          break
        }
      }
    })
    // window.addEventListener('keydown', (e) => {
    //   if (e.code === 'KeyM' && screen === 'menu') Audio.toggle()
    //   if (e.code === 'F1') {
    //     debug = !debug
    //     e.preventDefault()
    //   }
    //   if (e.code === 'Escape' && screen === 'play' && match && match.state === 'result') {
    //     screen = 'menu'
    //     attract = makeAttract()
    //   }
    // })
    // 2026/10/01 変更 ---＞
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1') e.preventDefault()
    })
    // <--- 2026/10/01 変更
    requestAnimationFrame(frame)
  }

  // 2026/10/01 変更 ---＞
  globalThis.__beatView = function () {
    const m = screen === 'menu' ? attract : match
    if (!m) return { screen: screen }
    return {
      screen: screen,
      menuIndex: menuIndex,
      state: m.state,
      timer: Math.round(m.timer * 10) / 10,
      countdown: Math.round((m.countdown || 0) * 10) / 10,
      winner: m.winner,
      banner: m.banner ? m.banner.text : null,
      players: m.players.map(function (p) {
        return {
          name: p.name,
          hp: Math.round(p.hp),
          x: Math.round(p.x),
          alive: p.alive,
          state: p.state,
          on: p.onBeatHits,
          off: p.offBeatHits,
        }
      }),
    }
  }
  // <--- 2026/10/01 変更

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
    else boot()
  }
})()
