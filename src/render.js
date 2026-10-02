/* Canvas drawing for Beat Smash. Reads match state; does not simulate. */
(function () {
  'use strict'

  const Sim = globalThis.BeatSim
  const W = Sim.W
  const H = Sim.H
  const ARENA = Sim.ARENA
  const FLOOR = Sim.FLOOR
  const FONT = '"WenQuanYi Micro Hei", "Droid Sans Fallback", sans-serif'

  const STARS = []
  for (let i = 0; i < 48; i++) {
    STARS.push({
      x: (i * 137 + 40) % W,
      y: (i * 89 + 20) % 640,
      r: i % 5 === 0 ? 2.2 : 1.1,
    })
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2))
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  }

  function setFont(ctx, size, weight) {
    ctx.font = (weight || 700) + ' ' + size + 'px ' + FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
  }

  function paint(ctx, text, x, y, size, fill, stroke, weight) {
    setFont(ctx, size, weight)
    ctx.lineWidth = Math.max(3, size / 9)
    ctx.strokeStyle = stroke || '#140810'
    ctx.strokeText(text, x, y)
    ctx.fillStyle = fill
    ctx.fillText(text, x, y)
  }

  function inside(b, m) {
    return !!m && m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h
  }

  function button(ctx, ui, view, spec) {
    const hot = spec.selected || inside(spec, view.mouse)
    roundRect(ctx, spec.x, spec.y, spec.w, spec.h, 14)
    ctx.fillStyle = hot ? spec.color || '#ffe14a' : 'rgba(28, 16, 48, 0.92)'
    ctx.fill()
    ctx.lineWidth = hot ? 4 : 2
    ctx.strokeStyle = hot ? '#fff6c8' : '#8b6bb5'
    ctx.stroke()
    paint(ctx, spec.label, spec.x + spec.w / 2, spec.y + (spec.sub ? spec.h / 2 - 8 : spec.h / 2), spec.size || 26, hot ? spec.ink || '#241206' : '#fff6ea', hot ? 'rgba(0,0,0,0)' : '#140810')
    if (spec.sub) {
      setFont(ctx, 13, 700)
      ctx.fillStyle = hot ? 'rgba(36,18,6,0.8)' : '#cbb6e6'
      ctx.fillText(spec.sub, spec.x + spec.w / 2, spec.y + spec.h / 2 + 14)
    }
    ui.push({ id: spec.id, x: spec.x, y: spec.y, w: spec.w, h: spec.h })
  }

  function drawBackdrop(ctx, match) {
    const hot = Sim.onBeat(match.clock)
    const pulse = Sim.beatPulse(match.clock)
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#241038')
    g.addColorStop(0.45, '#140818')
    g.addColorStop(1, '#07040d')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    wash(ctx, 180, 180, 'rgba(255, 59, 92, 0.9)', 260, hot ? 0.22 : 0.08 + pulse * 0.08)
    wash(ctx, 1100, 200, 'rgba(46, 230, 166, 0.9)', 280, hot ? 0.18 : 0.06 + pulse * 0.06)
    wash(ctx, 640, 80, 'rgba(255, 225, 74, 0.95)', 220, hot ? 0.2 : pulse * 0.05)

    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    for (let i = 0; i < STARS.length; i++) {
      const s = STARS[i]
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(match.clock * 3 + i))
      ctx.globalAlpha = tw * (hot ? 1 : 0.7)
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  function wash(ctx, x, y, color, r, a) {
    const g = ctx.createRadialGradient(x, y, 8, x, y, r)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.save()
    ctx.globalAlpha = a
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  function drawArena(ctx, match) {
    const hot = Sim.onBeat(match.clock)
    const pulse = Sim.beatPulse(match.clock)
    roundRect(ctx, ARENA.x, ARENA.y, ARENA.w, ARENA.h, 26)
    const bg = ctx.createLinearGradient(0, ARENA.y, 0, ARENA.y + ARENA.h)
    bg.addColorStop(0, hot ? '#3a2a52' : '#2a1844')
    bg.addColorStop(1, '#160c22')
    ctx.fillStyle = bg
    ctx.fill()

    ctx.fillStyle = hot ? '#4d3824' : '#3a2456'
    ctx.fillRect(ARENA.x + 10, FLOOR, ARENA.w - 20, ARENA.y + ARENA.h - FLOOR - 10)

    ctx.beginPath()
    ctx.ellipse(W / 2, FLOOR + 4, 210 + pulse * 36, 22 + pulse * 8, 0, 0, Math.PI * 2)
    ctx.strokeStyle = hot ? 'rgba(255, 225, 74, 0.95)' : 'rgba(190, 160, 255, ' + (0.25 + pulse * 0.5) + ')'
    ctx.lineWidth = hot ? 7 : 3
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(W / 2, FLOOR + 4, 90 + pulse * 10, 10, 0, 0, Math.PI * 2)
    ctx.strokeStyle = hot ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 2
    ctx.stroke()

    roundRect(ctx, ARENA.x, ARENA.y, ARENA.w, ARENA.h, 26)
    ctx.lineWidth = hot ? 10 : 4
    ctx.strokeStyle = hot ? '#ffe14a' : '#6e4d98'
    ctx.stroke()

    if (hot) {
      roundRect(ctx, ARENA.x + 8, ARENA.y + 8, ARENA.w - 16, ARENA.h - 16, 20)
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(255, 225, 74, 0.45)'
      ctx.stroke()
    }
  }

  function drawShadows(ctx, match) {
    for (let i = 0; i < match.players.length; i++) {
      const p = match.players[i]
      if (!p.alive && p.deadT > 0.9) continue
      const air = Math.max(0, Math.min(1, (FLOOR - p.y) / 240))
      ctx.beginPath()
      ctx.ellipse(p.x, FLOOR - 1, 24 * (1 - air * 0.45), 8 * (1 - air * 0.4), 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,' + (0.38 - air * 0.2) + ')'
      ctx.fill()
    }
  }

  function drawTrails(ctx, match) {
    for (let i = 0; i < match.players.length; i++) {
      const p = match.players[i]
      for (let t = 0; t < p.trail.length; t++) {
        const tr = p.trail[t]
        ctx.save()
        ctx.globalAlpha = Math.max(0, tr.life / 0.16) * 0.45
        ctx.translate(tr.x, tr.y - p.h / 2)
        ctx.rotate(tr.angle)
        roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 12)
        ctx.fillStyle = p.color
        ctx.fill()
        ctx.restore()
      }
    }
  }

  function drawFace(ctx, p) {
    const hit = p.state === 'hitstun' || !p.alive
    const blink = p.blink % 3.4 < 0.12 && !hit
    ctx.strokeStyle = p.ink
    ctx.fillStyle = '#fff'
    ctx.lineWidth = 3
    if (hit) {
      drawX(ctx, -12, -6, 7)
      drawX(ctx, 12, -6, 7)
    } else if (!blink) {
      eye(ctx, -12, -6, p)
      eye(ctx, 12, -6, p)
      brows(ctx, p)
    } else {
      ctx.beginPath()
      ctx.moveTo(-18, -6)
      ctx.lineTo(-6, -6)
      ctx.moveTo(6, -6)
      ctx.lineTo(18, -6)
      ctx.stroke()
    }
    mouth(ctx, p, hit)
  }

  function eye(ctx, x, y, p) {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    if (p.index === 1) {
      ctx.arc(x, y, 7, 0, Math.PI * 2)
    } else if (p.index === 3) {
      roundRect(ctx, x - 7, y - 4, 14, 9, 3)
      ctx.fill()
      ctx.strokeStyle = p.ink
      ctx.stroke()
    } else {
      roundRect(ctx, x - 6, y - 7, 12, 14, 3)
      ctx.fill()
      ctx.strokeStyle = p.ink
      ctx.stroke()
    }
    if (p.index === 1) {
      ctx.fill()
      ctx.strokeStyle = p.ink
      ctx.stroke()
    }
    const px = x + p.facing * 2
    ctx.fillStyle = p.ink
    ctx.beginPath()
    ctx.arc(px, y + 1, p.index === 2 ? 2.2 : 3, 0, Math.PI * 2)
    ctx.fill()
    if (p.index === 2) {
      ctx.fillStyle = '#fff'
      ctx.fillRect(px - 2, y - 3, 2, 2)
    }
  }

  function brows(ctx, p) {
    ctx.strokeStyle = p.ink
    ctx.lineWidth = 3
    ctx.beginPath()
    if (p.index === 0) {
      ctx.moveTo(-20, -16)
      ctx.lineTo(-6, -12)
      ctx.moveTo(20, -16)
      ctx.lineTo(6, -12)
    } else if (p.index === 3) {
      ctx.moveTo(-18, -14)
      ctx.lineTo(-6, -14)
      ctx.moveTo(18, -14)
      ctx.lineTo(6, -14)
    }
    ctx.stroke()
  }

  function drawX(ctx, x, y, s) {
    ctx.beginPath()
    ctx.moveTo(x - s, y - s)
    ctx.lineTo(x + s, y + s)
    ctx.moveTo(x + s, y - s)
    ctx.lineTo(x - s, y + s)
    ctx.stroke()
  }

  function mouth(ctx, p, hit) {
    ctx.strokeStyle = p.ink
    ctx.fillStyle = p.ink
    ctx.lineWidth = 3
    ctx.beginPath()
    if (hit) {
      ctx.arc(0, 12, 7, 0, Math.PI * 2)
      ctx.stroke()
    } else if (p.state === 'attack') {
      ctx.ellipse(0, 12, 8, 6, 0, 0, Math.PI * 2)
      ctx.fill()
    } else if (p.index === 1) {
      ctx.arc(0, 8, 8, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx.stroke()
    } else {
      ctx.moveTo(-8, 12)
      ctx.lineTo(8, 12)
      ctx.stroke()
    }
  }

  function drawPlayers(ctx, match) {
    const list = match.players.slice().sort((a, b) => a.y - b.y)
    for (let i = 0; i < list.length; i++) drawPlayer(ctx, list[i], match)
  }

  function drawPlayer(ctx, p, match) {
    if (!p.alive && p.deadT > 1) return
    const hot = Sim.onBeat(match.clock) && p.alive
    const bob = p.onGround && p.alive && p.state !== 'hitstun' ? Math.sin(match.clock * 10 + p.index) * 1.5 : 0
    ctx.save()
    const fade = p.alive ? 1 : Math.max(0, 1 - p.deadT / 0.9)
    ctx.globalAlpha = fade
    if (p.alive && p.iframes > 0 && p.state !== 'dodge' && Math.floor(match.clock * 26) % 2 === 0) {
      ctx.globalAlpha = 0.4
    }
    ctx.translate(p.x, p.y + bob)
    ctx.rotate(p.angle)
    let sx = 1
    let sy = 1
    if (p.state === 'hitstun' || !p.alive) {
      const ax = Math.min(0.8, Math.abs(p.vx) / 1400)
      const ay = Math.min(0.8, Math.abs(p.vy) / 1400)
      sx = 1 + ax - ay * 0.35
      sy = 1 + ay - ax * 0.35
    }
    if (p.onGround && p.alive && p.state !== 'hitstun') {
      const pulse = Sim.beatPulse(match.clock)
      sy *= 1 - pulse * 0.1
      sx *= 1 + pulse * 0.07
    }
    sy *= 1 - p.squash * 0.38
    sx *= 1 + p.squash * 0.22
    if (!p.alive) {
      const k = p.deadT
      sx *= 1 + k * 0.45
      sy *= 1 + k * 0.45
    }
    ctx.scale(sx, sy)
    let lean = 0
    if (p.state === 'attack' && p.attack) {
      const a = Sim.ATTACKS[p.attack]
      if (p.stateT < a.startup) lean = -p.facing * 14 * (1 - p.stateT / a.startup)
      else lean = p.facing * 8
    }
    ctx.translate(lean, -p.h / 2)

    if (hot || p.glow > 0) {
      ctx.beginPath()
      ctx.arc(0, 0, p.w * 0.78, 0, Math.PI * 2)
      ctx.strokeStyle = p.glow > 0 ? '#fff6c2' : '#ffe14a'
      ctx.lineWidth = p.glow > 0 ? 8 : 6
      ctx.stroke()
    }

    roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 12)
    ctx.fillStyle = p.color
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    roundRect(ctx, -p.w / 2 + 6, -p.h / 2 + 6, p.w - 18, 14, 6)
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = p.dark
    roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 12)
    ctx.stroke()

    if (p.flash > 0) {
      ctx.globalAlpha *= Math.min(0.85, p.flash * 5)
      roundRect(ctx, -p.w / 2, -p.h / 2, p.w, p.h, 12)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.globalAlpha = fade
    }

    drawFace(ctx, p)

    if (p.onGround && p.alive && p.state !== 'dodge') {
      ctx.fillStyle = p.dark
      ctx.fillRect(-16, p.h / 2 - 4, 12, 8)
      ctx.fillRect(4, p.h / 2 - 4, 12, 8)
    }
    ctx.restore()

    if (p.alive) {
      const bw = 52
      const pct = Math.max(0, p.hp / p.maxHp)
      const by = p.y - p.h - 18 + bob
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      roundRect(ctx, p.x - bw / 2, by, bw, 7, 3)
      ctx.fill()
      ctx.fillStyle = pct > 0.5 ? '#8dff72' : pct > 0.25 ? '#ffd15c' : '#ff4d6a'
      roundRect(ctx, p.x - bw / 2, by, Math.max(0, bw * pct), 7, 3)
      ctx.fill()
    }
  }

  function drawFists(ctx, match) {
    for (let i = 0; i < match.players.length; i++) {
      const p = match.players[i]
      if (p.state !== 'attack' || !p.attack || !p.alive) continue
      const a = Sim.ATTACKS[p.attack]
      const box = Sim.hitBox(p)
      const on = p.attackOnBeat
      ctx.fillStyle = on ? '#ffe14a' : p.accent
      ctx.strokeStyle = on ? '#fff6c2' : p.ink
      ctx.lineWidth = on ? 4 : 3
      if (box) {
        roundRect(ctx, box.x, box.y, box.w, box.h, 12)
        ctx.fill()
        ctx.stroke()
        if (on) {
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(box.x + 8, box.y + box.h * 0.3)
          ctx.lineTo(box.x + box.w - 8, box.y + box.h * 0.7)
          ctx.stroke()
        }
      } else if (p.stateT < a.startup) {
        const size = p.attack === 'heavy' ? 34 : 22
        const u = 1 - p.stateT / a.startup
        const reach = -p.facing * (16 + u * 18)
        const x = p.x + reach - size / 2
        const y = p.y - p.h * 0.7
        roundRect(ctx, x, y, size, size, 7)
        ctx.fill()
        ctx.stroke()
      }
    }
  }

  function drawFx(ctx, match) {
    const parts = match.fx.particles
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      const a = Math.max(0, p.life / p.max)
      ctx.globalAlpha = a
      ctx.fillStyle = p.color
      ctx.strokeStyle = p.color
      if (p.type === 'streak') {
        ctx.lineWidth = 3
        ctx.beginPath()
        const mag = Math.hypot(p.vx, p.vy) || 1
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - (p.vx / mag) * p.len, p.y - (p.vy / mag) * p.len)
        ctx.stroke()
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      }
    }
    ctx.globalAlpha = 1
    const rings = match.fx.rings
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i]
      ctx.beginPath()
      ctx.arc(r.x, r.y, Math.max(1, r.r), 0, Math.PI * 2)
      ctx.lineWidth = r.width
      ctx.strokeStyle = r.color
      ctx.globalAlpha = Math.max(0, r.life / r.max)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    const texts = match.fx.texts
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i]
      const age = 1 - t.life / t.max
      const pop = age < 0.12 ? age / 0.12 : 1
      ctx.save()
      ctx.translate(t.x, t.y)
      ctx.scale(0.7 + pop * 0.35, 0.7 + pop * 0.35)
      ctx.globalAlpha = Math.min(1, t.life / 0.2)
      paint(ctx, t.text, 0, 0, t.size, t.color, '#1a0a14')
      ctx.restore()
    }
    ctx.globalAlpha = 1

    if (match.fx.shake > 8) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 2
      for (let i = 0; i < 8; i++) {
        const y = 140 + i * 60
        const len = 40 + (i % 3) * 30
        ctx.beginPath()
        ctx.moveTo(i % 2 === 0 ? 20 : W - 20, y)
        ctx.lineTo(i % 2 === 0 ? 20 + len : W - 20 - len, y + 8)
        ctx.stroke()
      }
    }
  }

  function drawDebug(ctx, match) {
    ctx.lineWidth = 1
    for (let i = 0; i < match.players.length; i++) {
      const p = match.players[i]
      const b = Sim.bodyBox(p)
      ctx.strokeStyle = '#7dff72'
      ctx.strokeRect(b.x, b.y, b.w, b.h)
      const h = Sim.hitBox(p)
      if (h) {
        ctx.strokeStyle = '#ff4d6a'
        ctx.strokeRect(h.x, h.y, h.w, h.h)
      }
    }
  }

  function applyCamera(ctx, match) {
    const fx = match.fx
    ctx.translate(fx.shakeX, fx.shakeY)
    if (fx.zoom > 1.004) {
      ctx.translate(fx.zoomX, fx.zoomY)
      ctx.scale(fx.zoom, fx.zoom)
      ctx.translate(-fx.zoomX, -fx.zoomY)
    }
  }

  function drawVignette(ctx, hot) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 220, W / 2, H / 2, 760)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, hot ? 'rgba(40, 24, 0, 0.25)' : 'rgba(0,0,0,0.38)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  function drawBeatMeter(ctx, match) {
    const t = match.clock
    const hot = Sim.onBeat(t)
    const until = Sim.timeUntilBeat(t)
    const approach = 1 - until / Sim.BEAT
    const maxR = 40
    const core = 15
    const r = maxR + (core - maxR) * approach
    const cx = W / 2
    const cy = 54

    ctx.beginPath()
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(cx, cy, Math.max(core, r), 0, Math.PI * 2)
    ctx.strokeStyle = hot ? '#ffe14a' : '#7cf0ff'
    ctx.lineWidth = hot ? 6 : 3
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(cx, cy, core + (hot ? 5 : 0), 0, Math.PI * 2)
    ctx.fillStyle = hot ? '#ffe14a' : '#241433'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = hot ? '#fff6c8' : '#b79ae0'
    ctx.stroke()

    paint(ctx, hot ? 'ジャスト！' : 'ビート', cx, cy + maxR + 16, 16, hot ? '#ffe14a' : '#e6d8f8', '#140810', 700)
  }

  function drawFightHud(ctx, match) {
    const sec = Math.max(0, Math.ceil(match.timer))
    const urgent = match.state === 'fight' && sec <= 10
    const pulse = urgent ? 1 + Math.sin(match.clock * 14) * 0.06 : 1
    ctx.save()
    ctx.translate(118, 52)
    ctx.scale(pulse, pulse)
    paint(ctx, String(sec), 0, 0, urgent ? 54 : 48, urgent ? '#ff5d7a' : '#fff6ea', '#140810')
    ctx.restore()
    setFont(ctx, 14, 700)
    ctx.fillStyle = '#cbb6e6'
    ctx.textAlign = 'center'
    ctx.fillText('秒', 118, 84)

    const n = match.players.length
    const gap = 14
    const total = Math.min(1080, n * 250)
    const bw = (total - gap * (n - 1)) / n
    let x = (W - total) / 2
    const y = 632
    for (let i = 0; i < n; i++) {
      const p = match.players[i]
      roundRect(ctx, x, y, bw, 76, 12)
      ctx.fillStyle = 'rgba(10, 6, 18, 0.78)'
      ctx.fill()
      ctx.fillStyle = p.color
      roundRect(ctx, x + 10, y + 14, 18, 18, 4)
      ctx.fill()
      ctx.textAlign = 'left'
      setFont(ctx, 22, 700)
      ctx.fillStyle = p.alive ? '#fff6ea' : '#887898'
      ctx.textBaseline = 'middle'
      ctx.fillText(p.name, x + 36, y + 24)
      ctx.font = '700 12px ' + FONT
      ctx.fillStyle = '#cbb6e6'
      const tag = p.cpu ? 'CPU' : 'P' + (i + 1)
      ctx.fillText(tag + '  ' + p.romaji, x + 36, y + 44)
      const pct = Math.max(0, p.hp / p.maxHp)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      roundRect(ctx, x + 10, y + 56, bw - 20, 8, 4)
      ctx.fill()
      ctx.fillStyle = pct > 0.5 ? '#8dff72' : pct > 0.25 ? '#ffd15c' : '#ff4d6a'
      roundRect(ctx, x + 10, y + 56, (bw - 20) * pct, 8, 4)
      ctx.fill()
      ctx.textAlign = 'right'
      ctx.fillStyle = '#ffe14a'
      ctx.font = '700 13px ' + FONT
      ctx.fillText('ジャスト ' + p.onBeatHits, x + bw - 12, y + 28)
      x += bw + gap
    }
  }

  function drawCountdown(ctx, match) {
    if (match.countdown <= 0) return
    const n = Math.ceil(match.countdown)
    const hot = Sim.onBeat(match.clock)
    paint(ctx, String(n), W / 2, 300, hot ? 140 : 120, hot ? '#ffe14a' : '#ffffff', '#140810')
    paint(ctx, '光っている間に殴れ', W / 2, 390, 28, '#fff6ea', '#140810')
    paint(ctx, '弱 J/I    強 K/O    回避 L/P', W / 2, 430, 20, '#e6d8f8', '#140810')
  }

  function drawBanner(ctx, match) {
    const b = match.banner
    if (!b) return
    const a = Math.min(1, b.life / 0.2)
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, a))
    const pop = b.life > b.life ? 1 : 1
    paint(ctx, b.text, W / 2, match.state === 'countdown' ? 300 : 250, b.size || 72, b.color || '#fff', '#140810')
    ctx.restore()
    void pop
  }

  function drawPause(ctx, ui, view) {
    ctx.fillStyle = 'rgba(6, 3, 12, 0.55)'
    ctx.fillRect(0, 0, W, H)
    paint(ctx, '一時停止', W / 2, 250, 64, '#fff6ea', '#140810')
    button(ctx, ui, view, {
      id: 'resume',
      x: W / 2 - 140,
      y: 330,
      w: 280,
      h: 64,
      label: 'つづける',
      color: '#ffe14a',
      ink: '#241206',
    })
  }

  function ranking(match) {
    return match.players.slice().sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1
      if (b.hp !== a.hp) return b.hp - a.hp
      return b.damageDealt - a.damageDealt
    })
  }

  function drawResult(ctx, match, ui, view) {
    ctx.fillStyle = 'rgba(6, 3, 12, 0.62)'
    ctx.fillRect(0, 0, W, H)
    roundRect(ctx, 280, 70, 720, 560, 28)
    ctx.fillStyle = 'rgba(18, 10, 32, 0.94)'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#8b6bb5'
    ctx.stroke()

    if (match.winner == null) {
      paint(ctx, '引き分け', W / 2, 140, 64, '#ffe14a', '#140810')
    } else {
      const p = match.players[match.winner]
      paint(ctx, p.name + 'の勝ち！', W / 2, 140, 64, p.color, '#140810')
    }
    paint(ctx, 'ベスト・オブ・ワン', W / 2, 190, 16, '#cbb6e6', '#140810')

    const rows = ranking(match)
    for (let i = 0; i < rows.length; i++) {
      const p = rows[i]
      const y = 250 + i * 62
      ctx.fillStyle = p.color
      roundRect(ctx, 330, y - 16, 22, 22, 5)
      ctx.fill()
      ctx.textAlign = 'left'
      setFont(ctx, 26, 700)
      ctx.fillStyle = '#fff6ea'
      ctx.fillText(p.name, 364, y - 2)
      ctx.textAlign = 'right'
      ctx.font = '700 16px ' + FONT
      ctx.fillStyle = '#ffe14a'
      ctx.fillText('ジャスト ' + p.onBeatHits, 760, y - 6)
      ctx.fillStyle = '#ffffff'
      ctx.fillText('ダメージ ' + p.damageDealt, 930, y - 6)
      ctx.fillStyle = p.alive ? '#8dff72' : '#ff8aa0'
      ctx.fillText(p.alive ? 'HP ' + Math.ceil(p.hp) : 'KO', 760, y + 16)
      ctx.fillStyle = '#cbb6e6'
      ctx.fillText('撃破 ' + p.kos, 930, y + 16)
    }

    button(ctx, ui, view, {
      id: 'replay',
      x: 400,
      y: 530,
      w: 220,
      h: 64,
      label: 'もう一回',
      color: '#ffe14a',
      ink: '#241206',
    })
    button(ctx, ui, view, {
      id: 'back',
      x: 660,
      y: 530,
      w: 220,
      h: 64,
      label: 'メニュー',
      color: '#2EE6A6',
      ink: '#04281c',
    })
  }

  function drawMenu(ctx, view, ui) {
    const top = ctx.createLinearGradient(0, 0, 0, 130)
    top.addColorStop(0, 'rgba(8,4,14,0.78)')
    top.addColorStop(1, 'rgba(8,4,14,0)')
    ctx.fillStyle = top
    ctx.fillRect(0, 0, W, 130)
    const bot = ctx.createLinearGradient(0, 560, 0, H)
    bot.addColorStop(0, 'rgba(8,4,14,0)')
    bot.addColorStop(1, 'rgba(8,4,14,0.82)')
    ctx.fillStyle = bot
    ctx.fillRect(0, 560, W, 160)

    ctx.textAlign = 'left'
    paint(ctx, 'ビートスマッシュ', 168, 46, 32, '#fff6ea', '#140810')
    setFont(ctx, 13, 700)
    ctx.fillStyle = '#cbb6e6'
    ctx.textAlign = 'center'
    ctx.fillText('BEAT SMASH', 168, 78)

    const notes = view.notes || ['', '', '', '']
    const labels = ['ひとり', '2人', '3人', '4人']
    const colors = ['#FF3B5C', '#2EE6A6', '#FFC233', '#B08CFF']
    const inks = ['#3a0612', '#04281c', '#3a2500', '#1c0e3a']
    const bw = 132
    const fightW = 210
    const gap = 10
    const total = bw * 4 + gap * 3 + 16 + fightW
    let x = (W - total) / 2
    const y = 618
    for (let i = 0; i < 4; i++) {
      button(ctx, ui, view, {
        id: 'mode-' + i,
        x,
        y,
        w: bw,
        h: 52,
        label: labels[i],
        sub: notes[i],
        size: 22,
        selected: view.menuIndex === i,
        color: colors[i],
        ink: inks[i],
      })
      x += bw + gap
    }
    x += 6
    button(ctx, ui, view, {
      id: 'start',
      x,
      y,
      w: fightW,
      h: 52,
      label: 'ファイト！',
      size: 26,
      color: '#ffe14a',
      ink: '#241206',
      selected: true,
    })

    paint(ctx, '光った瞬間の攻撃だけが、本気でぶっ飛ぶ。', W / 2, 688, 16, '#fff6ea', '#140810')
  }

  function drawMute(ctx, view, ui) {
    button(ctx, ui, view, {
      id: 'mute',
      x: W - 132,
      y: 18,
      w: 112,
      h: 36,
      label: view.muted ? '音オフ' : '音オン',
      size: 16,
      color: view.muted ? '#887898' : '#2EE6A6',
      ink: '#04281c',
      selected: !view.muted,
    })
  }

  function drawUnlock(ctx) {
    paint(ctx, 'クリックかキーで音が鳴る', W / 2, 108, 14, '#ffe14a', '#140810')
  }

  function draw(ctx, view) {
    const ui = []
    const match = view.screen === 'menu' ? view.attract : view.match
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    applyCamera(ctx, match)
    drawBackdrop(ctx, match)
    drawArena(ctx, match)
    drawShadows(ctx, match)
    drawTrails(ctx, match)
    drawPlayers(ctx, match)
    drawFists(ctx, match)
    drawFx(ctx, match)
    if (view.debug) drawDebug(ctx, match)
    ctx.restore()
    drawVignette(ctx, Sim.onBeat(match.clock))
    drawBeatMeter(ctx, match)
    if (view.screen === 'menu') {
      drawMenu(ctx, view, ui)
    } else {
      drawFightHud(ctx, match)
      if (match.state === 'countdown') drawCountdown(ctx, match)
      if (match.banner && match.state !== 'result') drawBanner(ctx, match)
      if (match.paused) drawPause(ctx, ui, view)
      if (match.state === 'result' && !match.paused) drawResult(ctx, match, ui, view)
    }
    drawMute(ctx, view, ui)
    if (!view.unlocked) drawUnlock(ctx)
    return ui
  }

  globalThis.BeatRender = { draw }
})()
