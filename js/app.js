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
  {
    id: 'gohar',
    title: 'گوهر خیراندیش',
    rtl: true,
    blurb: 'Drop gems into the cave and clear full lines before the rocks take over. Clear the whole board to find a new gem.',
    create: createGohar,
    thumb: drawGoharThumb,
  },
  {
    id: 'qabus',
    title: 'قابوس بن وشمگیر',
    rtl: true,
    blurb: 'Stack brick and tile slabs into a tower. Whatever hangs over the edge is cut off, and perfect drops help the tower grow back.',
    create: createQabus,
    thumb: drawQabusThumb,
  },
  {
    id: 'ghalibaf',
    title: 'Gurbanguly Berdimuhamedow (Arkadag)',
    rtl: false,
    blurb: 'Weave a Turkmen carpet from falling guls. Every full row rolls up and is carried off the loom.',
    create: createGhalibaf,
    thumb: drawGhalibafThumb,
  },
  {
    id: 'chamran',
    title: 'چمران (شمال)',
    rtl: true,
    blurb: 'Drive your white Peykan up the Chamran expressway at rush hour. Hold to brake, honk slow cars aside and grab fuel cards before the tank runs dry. Some might call it همت شرق.',
    create: createChamran,
    thumb: drawChamranThumb,
  },
  {
    id: 'baran',
    title: 'پس از باران Beta',
    rtl: true,
    blurb: 'Run and jump across the north of Iran as Mammad. Eat kateh to grow, throw tahdig, and reach Golnar at the alachiq before Stratus rains on you. Beta with Levels 1 to 5.',
    immersive: true,   // the game shows the gamertag and the way back itself, so the site's bar is hidden
    create: createBaran,
    thumb: drawBaranThumb,
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

// ---------- Sign up, log in, edit ----------
// Each gamertag maps to a login address on Supabase; the PIN is the password.
const LOGIN_DOMAIN = 'players.gamenet.app';
const PIN_RE = /^[0-9]{6}$/;
const loginEmail = tag => tag.toLowerCase() + '@' + LOGIN_DOMAIN;
let formMode = 'new';           // 'new' | 'login' | 'edit'

function setMode(m) {
  formMode = m;
  const editing = m === 'edit', login = m === 'login';
  $('modes').hidden = editing || !online;
  $('modeNew').setAttribute('aria-selected', String(m === 'new'));
  $('modeLogin').setAttribute('aria-selected', String(login));
  $('profileHeading').textContent = editing ? 'Edit your player' : login ? 'Welcome back' : 'Make your player';
  $('avField').hidden = login;
  $('pinField').hidden = editing || !online;
  $('tagInput').disabled = editing && online;
  $('tagHint').textContent = editing && online ? "Your gamertag is your login, so it can't be changed."
    : login ? '' : '3 to 14 letters, numbers or _. Nobody else can use it.';
  $('tagHint').hidden = login;
  $('pinInput').autocomplete = login ? 'current-password' : 'new-password';
  $('pinHint').textContent = login ? '' : "You'll use your gamertag and this PIN to log in on any phone.";
  $('pinHint').hidden = login;
  $('profileSave').textContent = editing ? 'Save' : login ? 'Log in' : 'Enter Game Net';
  $('profileCancel').hidden = !editing;
  $('logoutBtn').hidden = !(editing && online);
  $('profileErr').hidden = true;
}

function openProfile(mode) {
  pickedAvatar = me ? AVATARS.indexOf(avatarOf(me.avatar)) : Math.floor(Math.random() * AVATARS.length);
  $('tagInput').value = me ? me.tag : '';
  $('pinInput').value = '';
  setMode(mode);
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

async function loadMe() {
  const [p, s] = await Promise.all([
    sb.from('players').select('tag, avatar').eq('id', myId).maybeSingle(),
    sb.from('scores').select('game, best').eq('player_id', myId),
  ]);
  if (p.error || s.error) throw p.error || s.error;
  if (!p.data) return null;
  const m = { tag: cleanTag(p.data.tag), avatar: p.data.avatar, best: {} };
  for (const r of s.data || []) m.best[r.game] = Number(r.best) || 0;
  return m;
}

$('modeNew').addEventListener('click', () => setMode('new'));
$('modeLogin').addEventListener('click', () => setMode('login'));
$('profileCancel').addEventListener('click', () => show('dash'));
$('editProfile').addEventListener('click', () => openProfile('edit'));
$('logoutBtn').addEventListener('click', async () => {
  await sb.auth.signOut().catch(() => {});
  myId = null; me = null;
  for (const k in boards) delete boards[k];
  openProfile('login');
});

$('profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const tag = $('tagInput').value.trim(), pin = $('pinInput').value.trim();
  const btn = $('profileSave');
  btn.disabled = true;
  try {
    if (!online) {
      if (!TAG_RE.test(tag)) { profileError('Use 3 to 14 letters, numbers or _ with no spaces.'); return; }
      me = Object.assign({ best: {} }, me || {}, { tag, avatar: pickedAvatar });
      saveLocal();
      show('dash');
      return;
    }
    if (formMode === 'edit') {
      const { error } = await sb.from('players').update({ avatar: pickedAvatar }).eq('id', myId);
      if (error) { profileError("Couldn't save your avatar. Check your connection and try again."); return; }
      me.avatar = pickedAvatar;
      show('dash');
      return;
    }
    if (!TAG_RE.test(tag)) { profileError('Gamertags are 3 to 14 letters, numbers or _ with no spaces.'); return; }
    if (!PIN_RE.test(pin)) { profileError('Your PIN is 6 numbers, like 482913.'); return; }
    if (formMode === 'login') {
      const { data, error } = await sb.auth.signInWithPassword({ email: loginEmail(tag), password: pin });
      if (error) { profileError(/invalid/i.test(error.message) ? 'That gamertag and PIN don’t match. Try again.' : "Couldn't log in. Check your connection and try again."); return; }
      myId = data.user.id;
    } else {
      const { data, error } = await sb.auth.signUp({
        email: loginEmail(tag), password: pin,
        options: { data: { tag, avatar: pickedAvatar } },
      });
      if (error) {
        profileError(/registered|exists|duplicate|database/i.test(error.message)
          ? `“${tag}” is taken. Pick another gamertag, or log in if it’s yours.`
          : "Couldn't create your player. Check your connection and try again.");
        return;
      }
      if (!data.session) { profileError('Your player was made, but logging in needs a setting changed in Supabase. Ask Milad.'); return; }
      myId = data.user.id;
    }
    me = await loadMe();
    if (!me) { profileError("Couldn't find your player. Try again in a moment."); return; }
    show('dash');
  } catch (err) {
    profileError("Couldn't reach Game Net. Check your connection and try again.");
  } finally {
    btn.disabled = false;
  }
});

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
  await pendingSave;             // a score that is still being saved should show up in this refresh
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
  $('play').classList.toggle('immersive', !!g.immersive);
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
    player: { tag: me.tag, face: avatarOf(me.avatar)[0], bg: avatarOf(me.avatar)[1] },
    exit: () => stopGame(),
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
// while a game is open, two thumbs on the screen must not pinch-zoom the page
document.addEventListener('touchmove', e => { if (current && e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', e => { if (current) e.preventDefault(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && current) stopGame(); });

// The database caps scores at 99999 until supabase/03-bigger-scores.sql is run; a bigger score is then saved as the cap.
const OLD_SCORE_CAP = 99999;
let pendingSave = Promise.resolve();
function submitScore(g, score) {
  if (score <= bestOf(g)) return;
  me.best = Object.assign({}, me.best, { [g.id]: score });
  if (!online) { saveLocal(); return; }
  const row = best => ({ player_id: myId, game: g.id, best, updated_at: new Date().toISOString() });
  pendingSave = pendingSave.then(async () => {
    let { error } = await sb.from('scores').upsert(row(score));
    if (error && score > OLD_SCORE_CAP) ({ error } = await sb.from('scores').upsert(row(OLD_SCORE_CAP)));
    if (error) saveLocal();
  }).catch(() => saveLocal());
}

// Phones often leave a game by going to the home screen, not by pressing "← Games": save the score reached so far.
function flushGame() { if (current && current.flush) current.flush(); }
document.addEventListener('visibilitychange', () => { if (document.hidden) flushGame(); });
window.addEventListener('pagehide', flushGame);

// Keep the dashboard fresh while it's open
setInterval(() => { if (!document.hidden && !current && (view === 'dash' || view === 'board')) refreshBoards(); }, 30000);

// ---------- Start up ----------
async function boot() {
  const cfg = window.GAMENET_CONFIG || {};
  try {
    if (!window.supabase || !cfg.key || cfg.key.startsWith('PASTE_')) throw new Error('not configured');
    sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data: { session } } = await sb.auth.getSession();
    online = true;
    if (session && !session.user.is_anonymous) {
      myId = session.user.id;
      me = await loadMe();
    }
  } catch (err) {
    console.warn('Game Net is offline:', err && err.message);
    me = loadLocal();
    goLocal("Couldn't reach the Game Net server, so scores are saved on this device for now.");
  }
  me ? show('dash') : openProfile('new');
}
boot();
