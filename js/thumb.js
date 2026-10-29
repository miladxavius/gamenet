function drawFireflyThumb(cv) {
  const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d);
  const c = cv.getContext('2d'), w = cv.width, h = cv.height;
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b1030'); g.addColorStop(0.7, '#1d1f4d'); g.addColorStop(1, '#3a2a55');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,230,${0.3 + rnd() * 0.7})`; c.fillRect(rnd() * w, rnd() * h * 0.8, d * 1.4, d * 1.4); }
  c.fillStyle = 'rgba(255,245,220,0.9)'; c.beginPath(); c.arc(w * 0.84, h * 0.22, h * 0.09, 0, 7); c.fill();
  c.fillStyle = '#151b42'; c.beginPath(); c.arc(w * 0.86, h * 0.19, h * 0.08, 0, 7); c.fill();
  const tw = w * 0.11, gap = h * 0.4, sc = h / 260;
  [[0.52, 0.44], [0.82, 0.56]].forEach(([x, gy]) => {
    const bx = w * x, top = h * gy - gap / 2, bot = h * gy + gap / 2;
    drawMinaret(c, bx, -10, top, tw, false, sc);
    drawMinaret(c, bx, bot, h, tw, true, sc);
  });
  c.fillStyle = 'rgba(160,250,255,0.85)'; c.beginPath(); c.arc(w * 0.875, h * 0.56, h * 0.025, 0, 7); c.fill();
  const fx = w * 0.26, fy = h * 0.46, rad = h * 0.22;
  const hg = c.createRadialGradient(fx, fy, 0, fx, fy, rad);
  hg.addColorStop(0, 'rgba(255,230,120,0.8)'); hg.addColorStop(1, 'rgba(255,230,120,0)');
  c.fillStyle = hg; c.beginPath(); c.arc(fx, fy, rad, 0, 7); c.fill();
  const s = h / 110;
  c.fillStyle = 'rgba(210,230,255,0.6)'; c.beginPath(); c.ellipse(fx - 2 * s, fy - 12 * s, 7 * s, 13 * s, -0.6, 0, 7); c.fill();
  c.fillStyle = '#ffe28c'; c.beginPath(); c.ellipse(fx - 9 * s, fy + 3 * s, 9 * s, 7 * s, 0.2, 0, 7); c.fill();
  c.fillStyle = '#2b2440'; c.beginPath(); c.ellipse(fx + 3 * s, fy, 9 * s, 7 * s, 0, 0, 7); c.fill();
  c.fillStyle = '#3d3360'; c.beginPath(); c.arc(fx + 12 * s, fy - 2 * s, 6 * s, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(fx + 14 * s, fy - 3 * s, 2.6 * s, 0, 7); c.fill();
}
