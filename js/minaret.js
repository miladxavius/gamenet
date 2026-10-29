// Tiled minaret: gap end has an onion dome, a lantern with arched windows and a gold balcony.
function drawMinaret(c, x, yTop, yBot, w, capDown, s) {
  const cx = x + w / 2, edge = capDown ? yTop : yBot, dir = capDown ? 1 : -1;
  const domeH = 34 * s, lanternH = 26 * s, balconyH = 12 * s;
  const at = t => edge + dir * t;               // distance from the gap edge into the minaret
  const far = capDown ? yBot : yTop;
  const shaftStart = at(domeH + lanternH + balconyH);
  // shaft
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#0f3d58'); g.addColorStop(0.35, '#2f8fb8'); g.addColorStop(0.55, '#4fbcdc'); g.addColorStop(1, '#0f3d58');
  c.fillStyle = g;
  c.fillRect(x, Math.min(shaftStart, far), w, Math.abs(far - shaftStart));
  // tile bands
  for (let t = domeH + lanternH + balconyH + 22 * s; t < Math.abs(far - edge); t += 52 * s) {
    const by = at(t);
    c.fillStyle = '#e8c25a'; c.fillRect(x, by - 1.5 * s, w, 3 * s);
    c.fillStyle = 'rgba(230,248,255,0.85)';
    for (let dx = 7 * s; dx < w - 3 * s; dx += 12 * s) {
      const dy = by + dir * 11 * s;
      c.beginPath(); c.moveTo(x + dx, dy - 4 * s); c.lineTo(x + dx + 4 * s, dy); c.lineTo(x + dx, dy + 4 * s); c.lineTo(x + dx - 4 * s, dy); c.fill();
    }
    c.fillStyle = '#e8c25a'; c.fillRect(x, by + dir * 22 * s - 1.5 * s, w, 3 * s);
  }
  // balcony with stepped underside
  const b0 = at(domeH + lanternH), b1 = at(domeH + lanternH + balconyH);
  c.fillStyle = '#b8862f';
  c.beginPath(); c.moveTo(x - 9 * s, b1); c.lineTo(x + w + 9 * s, b1); c.lineTo(x + w, b1 + dir * 12 * s); c.lineTo(x, b1 + dir * 12 * s); c.fill();
  c.fillStyle = '#e8c25a';
  c.fillRect(x - 9 * s, Math.min(b0, b1), w + 18 * s, balconyH);
  c.fillStyle = 'rgba(80,50,10,0.5)';
  for (let dx = -5 * s; dx < w + 6 * s; dx += 7 * s) c.fillRect(x + dx, Math.min(b0, b1) + 3 * s, 2 * s, balconyH - 6 * s);
  // lantern
  const lw = w * 0.62, l0 = at(domeH), l1 = b0;
  c.fillStyle = '#2a86ad';
  c.fillRect(cx - lw / 2, Math.min(l0, l1), lw, lanternH);
  c.fillStyle = '#0b2433';
  for (const ox of [-lw * 0.25, lw * 0.25]) {
    const wy = at(domeH + lanternH * 0.5);
    c.beginPath();
    c.moveTo(cx + ox - 4 * s, wy + dir * 8 * s);
    c.lineTo(cx + ox - 4 * s, wy - dir * 3 * s);
    c.quadraticCurveTo(cx + ox, wy - dir * 10 * s, cx + ox + 4 * s, wy - dir * 3 * s);
    c.lineTo(cx + ox + 4 * s, wy + dir * 8 * s); c.fill();
  }
  // onion dome
  const dw = w * 0.86, base = at(domeH), p = t => base - dir * t;
  const dg = c.createLinearGradient(cx - dw / 2, 0, cx + dw / 2, 0);
  dg.addColorStop(0, '#1d6f93'); dg.addColorStop(0.45, '#5ccbe6'); dg.addColorStop(1, '#1d6f93');
  c.fillStyle = dg;
  c.beginPath();
  c.moveTo(cx - lw / 2, p(0));
  c.bezierCurveTo(cx - dw / 2, p(domeH * 0.3), cx - dw * 0.42, p(domeH * 0.75), cx, p(domeH));
  c.bezierCurveTo(cx + dw * 0.42, p(domeH * 0.75), cx + dw / 2, p(domeH * 0.3), cx + lw / 2, p(0));
  c.closePath(); c.fill();
  // gold finial
  c.strokeStyle = '#e8c25a'; c.lineWidth = 2 * s;
  c.beginPath(); c.moveTo(cx, p(domeH)); c.lineTo(cx, p(domeH + 10 * s)); c.stroke();
  c.fillStyle = '#e8c25a'; c.beginPath(); c.arc(cx, p(domeH + 4 * s), 2.6 * s, 0, 7); c.fill();
}
