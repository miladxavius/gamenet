
function createFirefly(canvas, hooks) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const GROUND = H - 70;

  // Fit the canvas to the window while keeping its shape
  function fit() {
    const box = canvas.parentElement;
    const s = Math.min(box.clientWidth / W, box.clientHeight / H);
    canvas.style.width = (W * s) + 'px';
    canvas.style.height = (H * s) + 'px';
  }
  window.addEventListener('resize', fit); fit();

  // ---------- Tunables ----------
  const GRAVITY = 1500;      // px/s^2
  const FLAP = -470;         // px/s
  const SPEED_START = 170;   // px/s
  const SPEED_MAX = 290;
  const GAP_START = 210;
  const GAP_MIN = 150;
  const TOWER_W = 62;
  const TOWER_EVERY = 1.55;  // seconds between towers
  const GLOW_DRAIN = 0.075;  // glow lost per second (1 = full)
  const DEW_GAIN = 0.35;

  // ---------- Sound (made in code, works offline) ----------
  let audio = null;
  function beep(freq, dur, type = 'sine', vol = 0.12, slide = 0) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime;
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audio.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  }
  const sfx = {
    flap:  () => beep(520, 0.09, 'triangle', 0.07, 260),
    point: () => { beep(880, 0.08, 'sine', 0.08); setTimeout(() => beep(1320, 0.1, 'sine', 0.07), 70); },
    dew:   () => { beep(660, 0.1, 'sine', 0.09, 600); setTimeout(() => beep(1500, 0.15, 'sine', 0.05), 90); },
    hit:   () => beep(220, 0.4, 'sawtooth', 0.1, -170),
    fade:  () => beep(400, 0.8, 'sine', 0.1, -330),
  };

  // ---------- Best score ----------
  let best = hooks.getBest() || 0;
  function saveBest() {}

  // ---------- Background (stars + hills, made once) ----------
  const stars = Array.from({ length: 90 }, () => ({
    x: Math.random() * W, y: Math.random() * GROUND * 0.85,
    r: Math.random() * 1.4 + 0.3, tw: Math.random() * Math.PI * 2,
  }));
  function hillLayer(seed, base, amp) {
    const pts = [];
    for (let x = 0; x <= W * 2 + 40; x += 40) {
      pts.push(base - amp * (0.5 + 0.5 * Math.sin(x * 0.011 + seed) * Math.cos(x * 0.004 + seed * 2)));
    }
    return pts;
  }
  const hillsFar = hillLayer(1.3, GROUND - 40, 120);
  const hillsNear = hillLayer(4.1, GROUND - 5, 70);

  // ---------- Game state ----------
  let state, fly, towers, dews, sparks, score, speed, gap, spawnT, glow, time, shake, deathReason, scrollX, flashT;

  function reset() {
    state = 'ready';
    fly = { x: W * 0.3, y: H * 0.42, vy: 0, rot: 0, wing: 0 };
    towers = []; dews = []; sparks = [];
    score = 0; speed = SPEED_START; gap = GAP_START; spawnT = 0.6;
    glow = 1; time = 0; shake = 0; deathReason = ''; scrollX = 0; flashT = 0;
  }
  reset();

  function flap() {
    if (state === 'ready') { state = 'play'; }
    if (state === 'play') {
      fly.vy = FLAP; fly.wing = 1; sfx.flap();
      for (let i = 0; i < 3; i++) spark(fly.x - 8, fly.y + 6, '#ffe28a', 60);
    } else if (state === 'over' && time > 0.7) {
      reset();
    }
  }

  function spark(x, y, color, power) {
    sparks.push({
      x, y, vx: (Math.random() - 0.7) * power, vy: (Math.random() - 0.3) * power,
      life: 0.5 + Math.random() * 0.4, max: 0.9, color,
    });
  }

  function die(reason) {
    if (state !== 'play') return;
    state = 'over'; time = 0; deathReason = reason;
    shake = reason === 'dark' ? 0 : 12;
    reason === 'dark' ? sfx.fade() : sfx.hit();
    if (score > best) { best = score; saveBest(); }
    hooks.onGameOver(score);
    for (let i = 0; i < 25; i++) spark(fly.x, fly.y, '#ffd466', 260);
  }

  // ---------- Input ----------
  function onKey(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
      e.preventDefault(); if (!e.repeat) flap();
    }
  }
  window.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); flap(); });

  // ---------- Update ----------
  function spawnTower() {
    const margin = 90;
    const gy = margin + Math.random() * (GROUND - margin * 2 - gap) + gap / 2;
    towers.push({ x: W + 20, gapY: gy, gap, passed: false, sway: Math.random() * 6 });
    // Most towers carry a dewdrop somewhere near the gap
    if (Math.random() < 0.8) {
      const off = (Math.random() - 0.5) * (gap * 0.55);
      dews.push({ x: W + 20 + TOWER_W / 2 + (Math.random() < 0.5 ? 0 : TOWER_W * 1.6),
                  y: gy + off, t: Math.random() * 6, taken: false });
    }
  }

  function update(dt) {
    time += dt;
    shake = Math.max(0, shake - dt * 40);
    flashT = Math.max(0, flashT - dt);
    fly.wing = Math.max(0, fly.wing - dt * 6);

    if (state === 'ready') {
      fly.y = H * 0.42 + Math.sin(time * 3) * 10;
      scrollX += speed * 0.5 * dt;
    }

    if (state === 'play') {
      scrollX += speed * dt;
      fly.vy += GRAVITY * dt;
      fly.y += fly.vy * dt;
      fly.rot = Math.max(-0.5, Math.min(1.2, fly.vy / 600));

      glow -= GLOW_DRAIN * dt * (1 + score * 0.015);
      if (glow <= 0) { glow = 0; die('dark'); }

      spawnT -= dt;
      if (spawnT <= 0) { spawnTower(); spawnT = TOWER_EVERY * (SPEED_START / speed); }

      for (const t of towers) {
        t.x -= speed * dt;
        if (!t.passed && t.x + TOWER_W < fly.x) {
          t.passed = true; score++; sfx.point();
          speed = Math.min(SPEED_MAX, speed + 4);
          gap = Math.max(GAP_MIN, gap - 2);
        }
        // collision (circle vs rects)
        const r = 11;
        if (fly.x + r > t.x && fly.x - r < t.x + TOWER_W) {
          if (fly.y - r < t.gapY - t.gap / 2 || fly.y + r > t.gapY + t.gap / 2) die('tower');
        }
      }
      towers = towers.filter(t => t.x > -TOWER_W - 20);

      for (const d of dews) {
        d.x -= speed * dt; d.t += dt;
        if (!d.taken && Math.hypot(d.x - fly.x, d.y - fly.y) < 24) {
          d.taken = true; glow = Math.min(1, glow + DEW_GAIN); flashT = 0.25; sfx.dew();
          for (let i = 0; i < 12; i++) spark(d.x, d.y, '#9ff6ff', 180);
        }
      }
      dews = dews.filter(d => d.x > -30 && !d.taken);

      if (fly.y + 11 > GROUND) { fly.y = GROUND - 11; die('ground'); }
      if (fly.y < -30) { fly.y = -30; fly.vy = 0; }
    }

    if (state === 'over') {
      if (fly.y + 11 < GROUND) { fly.vy += GRAVITY * dt; fly.y = Math.min(GROUND - 11, fly.y + fly.vy * dt); }
      fly.rot = Math.min(1.6, fly.rot + dt * 4);
    }

    for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 200 * dt; s.life -= dt; }
    sparks = sparks.filter(s => s.life > 0);
  }

  // ---------- Draw ----------
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, '#0b1030'); g.addColorStop(0.6, '#1d1f4d'); g.addColorStop(1, '#3a2a55');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // moon
    ctx.fillStyle = 'rgba(255,245,220,0.9)';
    ctx.beginPath(); ctx.arc(W - 90, 110, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#141a3f';
    ctx.beginPath(); ctx.arc(W - 76, 100, 30, 0, Math.PI * 2); ctx.fill();
    for (const s of stars) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(s.tw + time * 1.5));
      ctx.fillStyle = `rgba(255,255,230,${a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
  }

  function drawHills(pts, par, color) {
    const off = (scrollX * par) % (W);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-off, GROUND);
    for (let i = 0; i < pts.length; i++) ctx.lineTo(i * 40 - off, pts[i]);
    ctx.lineTo(W * 2, GROUND); ctx.closePath(); ctx.fill();
  }

  function drawTower(x, yTop, yBot, capDown) { drawMinaret(ctx, x, yTop, yBot, TOWER_W, capDown, 1); }

  function drawDew(d) {
    const bob = Math.sin(d.t * 4) * 4;
    const y = d.y + bob;
    const glowG = ctx.createRadialGradient(d.x, y, 0, d.x, y, 26);
    glowG.addColorStop(0, 'rgba(160,250,255,0.7)'); glowG.addColorStop(1, 'rgba(160,250,255,0)');
    ctx.fillStyle = glowG; ctx.beginPath(); ctx.arc(d.x, y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9fbff';
    ctx.beginPath();
    ctx.moveTo(d.x, y - 11);
    ctx.quadraticCurveTo(d.x + 9, y + 1, d.x, y + 8);
    ctx.quadraticCurveTo(d.x - 9, y + 1, d.x, y - 11);
    ctx.fill();
    ctx.fillStyle = 'white'; ctx.fillRect(d.x - 3, y - 3, 2, 3);
  }

  function drawFirefly() {
    ctx.save();
    ctx.translate(fly.x, fly.y);
    ctx.rotate(fly.rot);
    // glow halo
    const rad = 20 + 40 * glow;
    const hg = ctx.createRadialGradient(0, 4, 0, 0, 4, rad);
    hg.addColorStop(0, `rgba(255,230,120,${0.35 + 0.5 * glow})`); hg.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 4, rad, 0, Math.PI * 2); ctx.fill();
    // wings
    const flapA = Math.sin(time * 40) * 0.4 + fly.wing * 0.8;
    ctx.fillStyle = 'rgba(210,230,255,0.55)';
    ctx.save(); ctx.rotate(-0.6 - flapA);
    ctx.beginPath(); ctx.ellipse(-2, -12, 7, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.rotate(-0.1 - flapA * 0.6);
    ctx.beginPath(); ctx.ellipse(4, -11, 6, 11, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // glowing tail
    ctx.fillStyle = `rgb(255,${200 + 40 * glow},${80 + 60 * glow})`;
    ctx.beginPath(); ctx.ellipse(-9, 3, 9, 7, 0.2, 0, Math.PI * 2); ctx.fill();
    // body
    ctx.fillStyle = '#2b2440';
    ctx.beginPath(); ctx.ellipse(3, 0, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
    // head
    ctx.fillStyle = '#3d3360';
    ctx.beginPath(); ctx.arc(12, -2, 6, 0, Math.PI * 2); ctx.fill();
    // eye
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(14, -3, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(15, -3, 1.3, 0, Math.PI * 2); ctx.fill();
    // antennae
    ctx.strokeStyle = '#3d3360'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(13, -7); ctx.quadraticCurveTo(16, -16, 22, -15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(11, -7); ctx.quadraticCurveTo(12, -17, 17, -19); ctx.stroke();
    ctx.restore();
  }

  function drawDarkness() {
    // The world fades into the dark as the firefly's glow runs low
    const r = 90 + 360 * glow;
    const g = ctx.createRadialGradient(fly.x, fly.y, r * 0.35, fly.x, fly.y, r);
    g.addColorStop(0, 'rgba(3,3,10,0)');
    g.addColorStop(1, `rgba(3,3,10,${0.55 + 0.4 * (1 - glow)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (flashT > 0) { ctx.fillStyle = `rgba(160,250,255,${flashT * 0.5})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawGround() {
    ctx.fillStyle = '#141a14'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#1f2d1c'; ctx.fillRect(0, GROUND, W, 8);
    // grass tufts
    ctx.strokeStyle = '#2f4a2a'; ctx.lineWidth = 2;
    const off = scrollX % 18;
    for (let x = -off; x < W; x += 18) {
      ctx.beginPath(); ctx.moveTo(x, GROUND + 2); ctx.lineTo(x + 3, GROUND - 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 6, GROUND + 2); ctx.lineTo(x + 5, GROUND - 4); ctx.stroke();
    }
  }

  function text(str, x, y, size, color = 'white', align = 'center', weight = '800') {
    ctx.font = `${weight} ${size}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size / 7); ctx.strokeStyle = 'rgba(10,8,25,0.85)';
    ctx.strokeText(str, x, y); ctx.fillStyle = color; ctx.fillText(str, x, y);
  }

  function drawHUD() {
    if (state !== 'ready') text(String(score), W / 2, 70, 56);
    // glow meter
    const mx = 20, my = H - 42, mw = W - 40, mh = 14;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(mx, my, mw, mh, 7); ctx.fill();
    const low = glow < 0.25 && state === 'play' && Math.sin(time * 14) > 0;
    ctx.fillStyle = low ? '#ff6b5a' : '#ffd35c';
    roundRect(mx, my, Math.max(0, mw * glow), mh, 7); ctx.fill();
    text('GLOW', mx + 6, my - 12, 13, '#ffe9a8', 'left', '700');
    text('BEST ' + best, W - 26, my - 12, 13, '#ffe9a8', 'right', '700');
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawPanels() {
    if (state === 'ready') {
      ctx.direction = 'rtl'; text('شیخ فضل‌الله نوری', W / 2, 150, 40, '#ffe28a'); ctx.direction = 'ltr';
      text('Fly Nuri the firefly between the minarets', W / 2, 200, 17, '#ffffff', 'center', '600');
      text('Catch dewdrops to keep your light on!', W / 2, 226, 17, '#9ff6ff', 'center', '600');
      const a = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.globalAlpha = 0.4 + 0.6 * a;
      text('Tap, click or press SPACE', W / 2, H * 0.62, 22);
      ctx.globalAlpha = 1;
    }
    if (state === 'over') {
      ctx.fillStyle = 'rgba(10,8,25,0.55)';
      roundRect(W / 2 - 160, H / 2 - 130, 320, 250, 20); ctx.fill();
      text(deathReason === 'dark' ? 'Your light went out' : 'Bonk!', W / 2, H / 2 - 92, 30, '#ffe28a');
      text('Score', W / 2 - 70, H / 2 - 38, 16, '#cfd3ff', 'center', '600');
      text('Best', W / 2 + 70, H / 2 - 38, 16, '#cfd3ff', 'center', '600');
      text(String(score), W / 2 - 70, H / 2 + 2, 44);
      text(String(best), W / 2 + 70, H / 2 + 2, 44, score >= best && score > 0 ? '#9ff6ff' : 'white');
      if (score >= best && score > 0) text('New best!', W / 2, H / 2 + 46, 18, '#9ff6ff');
      if (time > 0.7) text('Tap or SPACE to fly again', W / 2, H / 2 + 88, 17, '#ffffff', 'center', '600');
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawSky();
    drawHills(hillsFar, 0.15, '#241f45');
    drawHills(hillsNear, 0.35, '#1a1832');
    for (const t of towers) {
      drawTower(t.x, -10, t.gapY - t.gap / 2, false);
      drawTower(t.x, t.gapY + t.gap / 2, GROUND, true);
    }
    for (const d of dews) drawDew(d);
    drawGround();
    for (const s of sparks) {
      ctx.globalAlpha = Math.max(0, s.life / s.max);
      ctx.fillStyle = s.color; ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
    drawFirefly();
    drawDarkness();
    ctx.restore();
    drawHUD();
    drawPanels();
  }

  // ---------- Loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    if (alive) raf = requestAnimationFrame(frame);
  }
  let alive = true, raf = requestAnimationFrame(frame);

  return {
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', fit);
      if (audio) audio.close().catch(() => {});
    },
    setBest(b) { if (b > best) best = b; },
    test: { get state() { return state; }, get score() { return score; }, get fly() { return fly; }, get towers() { return towers; }, flap },
  };
}
