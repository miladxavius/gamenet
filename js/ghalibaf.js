// Gurbanguly Berdimuhamedow (Arkadag): the carpet block game lives in its own page (games/ghalibaf/) and runs in a frame on the stage.
// The page reports the score by message; whatever it reached is saved when the round ends or the player leaves.
function createGhalibaf(canvas, hooks) {
  const frame = document.createElement('iframe');
  frame.src = 'games/ghalibaf/index.html?v=10#best=' + (hooks.getBest() || 0);
  frame.title = canvas.getAttribute('aria-label') || 'Game';
  frame.className = 'game-frame';
  frame.addEventListener('load', () => { try { frame.contentWindow.focus(); } catch (e) {} });   // keys work without a click first
  canvas.replaceWith(frame);
  let last = 0, saved = 0;
  function save(score) { if (score > saved) { saved = score; hooks.onGameOver(score); } }
  function onMessage(e) {
    if (e.source !== frame.contentWindow || !e.data || typeof e.data.score !== 'number') return;
    const score = Math.max(0, Math.floor(e.data.score));
    if (e.data.gamenet === 'score') last = score;
    if (e.data.gamenet === 'over') { save(score); last = 0; saved = 0; }
  }
  window.addEventListener('message', onMessage);
  return {
    flush() { save(last); },   // the phone is leaving the app: keep the score reached so far
    destroy() { window.removeEventListener('message', onMessage); save(last); frame.remove(); },
  };
}

// Card picture: a painting of the Turkmenistan flag waving at night
function drawGhalibafThumb(cv) {
  const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d);
  const c = cv.getContext('2d');
  const img = drawGhalibafThumb.img || (drawGhalibafThumb.img = Object.assign(new Image(), { src: 'games/ghalibaf/card2.jpg' }));
  const paint = () => {
    const s = Math.max(cv.width / img.width, cv.height / img.height);
    c.drawImage(img, (cv.width - img.width * s) / 2, (cv.height - img.height * s) / 2, img.width * s, img.height * s);
  };
  c.fillStyle = '#141a40'; c.fillRect(0, 0, cv.width, cv.height);
  if (img.complete && img.naturalWidth) paint(); else img.addEventListener('load', paint, { once: true });
}
