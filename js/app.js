// ---------- Game Net: profiles, dashboard, leaderboards ----------
const AVATARS = [
  ['🦊', '#3b2a12'], ['🐼', '#1e3a2a'], ['🐸', '#1d3a1a'], ['🐯', '#3d2a10'],
  ['🦁', '#3a2f12'], ['🐵', '#33241a'], ['🐙', '#12304a'], ['🦄', '#36224a'],
  ['🐲', '#16382c'], ['👾', '#3a1e3a'], ['🤖', '#1f2e44'], ['👻', '#2a2d44'],
  ['😎', '#3a3312'], ['🥷', '#22223a'], ['🧙', '#2c1f44'], ['🦉', '#342818'],
];

// To add a game: write its create function (like createFirefly) and add one entry here.
const GAMES = [
  {
    id: 'firefly',
    title: 'شیخ فضل‌الله نوری',
    rtl: true,
    blurb: 'Fly Nuri the firefly between the minarets. Catch dewdrops before your light runs out.',
    create: createFirefly,
    thumb: drawFireflyThumb,
  },
];

const $ = id => document.getElementById(id);
const TAG_RE = /^[A-Za-z0-9_]{3,14}$/;
const LOCAL_KEY = 'gamenet-local-profile';

let sb = null, myId = null, online = false;
let me = null;                 // { tag, avatar, best: { gameId: score } }
const boards = {};             // gameId -> [{id, tag, avatar, score}]
let view = 'loading', boardGame = null, current = null, pickedAvatar = 0;

function avatarOf(i) { const n = Number(i); return AVATARS[Number.isInteger(n) && n >= 0 && n < AVATARS.length ? n : 0]; }
function paintAvatar(el, i) { const a = avatarOf(i); el.textContent = a[0]; el.style.background = a[1]; }
function cleanTag(s) { return String(s || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 14) || 'Player'; }
function bestOf(g) { return (me && me.best && Number(me.best[g.id])) || 0; }

function show(v) {
  view = v;
  for (const id of ['v-loading', 'v-profile', 'v-dash', 'v-board']) $(id).hidden = id !== 'v-' + v;
  window.scrollTo(0, 0);
  if (v === 'dash') { renderDash(); refreshBoards(); }
  if (v === 'board') { renderBoard(); refreshBoards(); }
}

// ---------- Local fallback (database unreachable) ----------
function loadLocal() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch (e) { return null; } }
function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(me)); } catch (e) {} }
function goLocal(reason) {
  online = false;
  const n = $('dashNotice');
  n.textContent = reason; n.hidden = !reason;
}

// ---------- Profile screen ----------
function openProfile(editing) {
  pickedAvatar = me ? AVATARS.indexOf(avatarOf(me.avatar)) : Math.floor(Math.random() * AVATARS.length);
  $('profileHeading').textContent = editing ? 'Edit your player' : 'Make your player';
  $('profileSave').textContent = editing ? 'Save' : 'Enter Game Net';
  $('profileCancel').hidden = !editing;
  $('tagInput').value = me ? me.tag : '';
  $('profileErr').hidden = true;
  renderAvatarGrid();
  show('profile');
}

function renderAvatarGrid() {
  const grid = $('avatarGrid');
  grid.textContent = '';
  AVATARS.forEach((a, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pick'; b.textContent = a[0]; b.style.background = a[1];
    b.setAttribute('aria-pressed', String(i === pickedAvatar));
    b.setAttribute('aria-label', 'Avatar ' + (i + 1));
    b.addEventListener('click', () => { pickedAvatar = i; renderAvatarGrid(); });
    grid.appendChild(b);
  });
}

function profileError(msg) { const e = $('profileErr'); e.textContent = msg; e.hidden = false; }

$('profileCancel').addEventListener('click', () => show('dash'));
$('profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const tag = $('tagInput').value.trim();
  if (!TAG_RE.test(tag)) { profileError('Use 3 to 14 letters, numbers or _ with no spaces.'); return; }
  const btn = $('profileSave');
  btn.disabled = true;
  try {
    if (online) {
      const row = { tag, avatar: pickedAvatar };
      const { error } = me
        ? await sb.from('players').update(row).eq('id', myId)
        : await sb.from('players').insert(Object.assign({ id: myId }, row));
      if (error) {
        if (error.code === '23505') profileError(`“${tag}” is taken. Try another gamertag.`);
        else profileError("Couldn't save your player. Check your connection and try again.");
        return;
      }
      me = Object.assign({ best: {} }, me || {}, row);
    } else {
      me = Object.assign({ best: {} }, me || {}, { tag, avatar: pickedAvatar });
      saveLocal();
    }
    show('dash');
  } finally {
    btn.disabled = false;
  }
});
$('editProfile').addEventListener('click', () => openProfile(true));

// ---------- Dashboard ----------
function topOf(game) { const b = boards[game.id]; return b && b.length ? b[0] : null; }

function renderDash() {
  if (!me) return;
  paintAvatar($('meAv'), me.avatar);
  $('meTag').textContent = me.tag;
  const wrap = $('stations');
  wrap.textContent = '';
  GAMES.forEach((g, i) => {
    const card = document.createElement('article');
    card.className = 'station';
    card.innerHTML = `<div class="screen"><canvas></canvas><span class="pc"></span></div>
      <div class="body"><p class="gtitle"></p><p class="blurb"></p>
      <div class="stats"><span>Your best <b class="mybest"></b></span><span class="topwrap">Top <b class="top"></b></span></div>
      <div class="row"><button class="btn play" type="button">Play</button><button class="btn ghost lb" type="button">Leaderboard</button></div></div>`;
    card.querySelector('.pc').textContent = 'PC ' + String(i + 1).padStart(2, '0');
    const t = card.querySelector('.gtitle'); t.textContent = g.title; if (g.rtl) t.dir = 'rtl';
    card.querySelector('.blurb').textContent = g.blurb;
    card.querySelector('.mybest').textContent = String(bestOf(g));
    const top = topOf(g);
    if (top) card.querySelector('.top').textContent = `${avatarOf(top.avatar)[0]} ${top.tag} ${top.score}`;
    else card.querySelector('.topwrap').hidden = true;
    card.querySelector('.play').addEventListener('click', () => startGame(g));
    card.querySelector('.lb').addEventListener('click', () => { boardGame = g; show('board'); });
    wrap.appendChild(card);
    requestAnimationFrame(() => g.thumb(card.querySelector('canvas')));
  });
  const slot = document.createElement('article');
  slot.className = 'station empty-station';
  slot.innerHTML = `<div class="screen" aria-hidden="true">+</div><div class="body"><p class="gtitle">Next game goes here</p><p class="blurb">When a new game is ready, it gets its own station on this page.</p></div>`;
  wrap.appendChild(slot);
}

// ---------- Leaderboard ----------
async function refreshBoards() {
  if (!online) return;
  await Promise.all(GAMES.map(async g => {
    const { data, error } = await sb.from('scores')
      .select('best, player_id, players(tag, avatar)')
      .eq('game', g.id).order('best', { ascending: false }).limit(50);
    if (error || !data) return;
    boards[g.id] = data.filter(r => r.players && r.best > 0).map(r => ({
      id: r.player_id, tag: cleanTag(r.players.tag), avatar: r.players.avatar, score: Number(r.best) || 0,
    }));
  }));
  if (current) return;
  if (view === 'dash') renderDash();
  if (view === 'board') renderBoard();
}

function renderBoard() {
  const g = boardGame || GAMES[0];
  const t = $('boardTitle'); t.textContent = g.title; t.dir = g.rtl ? 'rtl' : 'ltr';
  const list = $('boardList'), empty = $('boardEmpty');
  list.textContent = '';
  let rows = boards[g.id] || [];
  if (!online) rows = bestOf(g) > 0 ? [{ id: 'me', tag: me.tag, avatar: me.avatar, score: bestOf(g) }] : [];
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    const mine = online ? r.id === myId : true;
    if (mine) li.className = 'mine';
    li.innerHTML = '<span class="rank"></span><div class="av sm"></div><span class="who"></span><span class="pts"></span>';
    li.querySelector('.rank').textContent = String(i + 1);
    paintAvatar(li.querySelector('.av'), r.avatar);
    li.querySelector('.who').textContent = r.tag + (mine ? ' (you)' : '');
    li.querySelector('.pts').textContent = String(r.score);
    list.appendChild(li);
  });
  if (!online) {
    empty.textContent = "Couldn't reach the shared leaderboard. This shows your own best on this device.";
    empty.hidden = false;
  } else {
    empty.textContent = 'No scores yet. Play a round and take first place.';
    empty.hidden = rows.length > 0;
  }
}
$('boardBack').addEventListener('click', () => show('dash'));

// ---------- Playing ----------
function startGame(g) {
  const stage = $('stage');
  stage.textContent = '';
  $('play').hidden = false;
  document.body.classList.add('playing');
  paintAvatar($('playAv'), me.avatar);
  $('playTag').textContent = me.tag;
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 720;
  canvas.setAttribute('aria-label', g.title);
  stage.appendChild(canvas);
  current = g.create(canvas, {
    getBest: () => bestOf(g),
    onGameOver: score => submitScore(g, score),
  });
}

function stopGame() {
  if (current) { current.destroy(); current = null; }
  $('stage').textContent = '';
  $('play').hidden = true;
  document.body.classList.remove('playing');
  renderDash();
  refreshBoards();
}
$('playBack').addEventListener('click', stopGame);
window.addEventListener('keydown', e => { if (e.key === 'Escape' && current) stopGame(); });

async function submitScore(g, score) {
  if (score <= bestOf(g)) return;
  me.best = Object.assign({}, me.best, { [g.id]: score });
  if (!online) { saveLocal(); return; }
  const { error } = await sb.from('scores').upsert({ player_id: myId, game: g.id, best: score, updated_at: new Date().toISOString() });
  if (error) saveLocal();
}

// Keep the dashboard fresh while it's open
setInterval(() => { if (!document.hidden && !current && (view === 'dash' || view === 'board')) refreshBoards(); }, 30000);

// ---------- Start up ----------
async function boot() {
  const cfg = window.GAMENET_CONFIG || {};
  try {
    if (!window.supabase || !cfg.key || cfg.key.startsWith('PASTE_')) throw new Error('not configured');
    sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
    let { data: { session } } = await sb.auth.getSession();
    if (!session) {
      const r = await sb.auth.signInAnonymously();
      if (r.error) throw r.error;
      session = r.data.session;
    }
    myId = session.user.id;
    const [p, s] = await Promise.all([
      sb.from('players').select('tag, avatar').eq('id', myId).maybeSingle(),
      sb.from('scores').select('game, best').eq('player_id', myId),
    ]);
    if (p.error || s.error) throw p.error || s.error;
    online = true;
    if (p.data) {
      me = { tag: cleanTag(p.data.tag), avatar: p.data.avatar, best: {} };
      for (const r of s.data || []) me.best[r.game] = Number(r.best) || 0;
      // carry over a better score played while offline
      const local = loadLocal();
      if (local && local.best) GAMES.forEach(g => { if ((Number(local.best[g.id]) || 0) > bestOf(g)) submitScore(g, Number(local.best[g.id])); });
    }
  } catch (err) {
    console.warn('Game Net is offline:', err && err.message);
    me = loadLocal();
    goLocal("Couldn't reach the Game Net server, so scores are saved on this device for now.");
  }
  me ? show('dash') : openProfile(false);
}
boot();
