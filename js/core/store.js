// Persistence. Learning progress lives in localStorage (small, synchronous);
// imported PDF texts live in IndexedDB (can be several MB).

const KEY = 'norsk-na.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  newPerDay: 15,          // new words/phrases per day – cognitive-load guard
  maxReviews: 200,        // cap per session so a backlog never becomes a wall
  retention: 0.9,         // desired retention for FSRS
  reviewMode: 'adaptive', // adaptive | production | recognition
  ttsRate: 0.9,
  voiceURI: '',
  autoplay: true,
  dailyGoalXp: 100,       // daily XP goal (≈10 min); small goals make the habit easy
  theme: 'auto',
  name: '',
  sound: true,
  haptics: true,
  autoAdvance: true,      // flow: correct typed answers move on by themselves
  shadowing: true,
  aiKey: '',
  aiModel: 'claude-opus-5-5',
  level: 'A1',
});

function freshState() {
  return {
    version: 1,
    createdAt: Date.now(),
    cards: {},       // id -> card
    known: {},       // lemma -> true ("I already know this" – counts for coverage)
    lessons: {},     // unitId -> { step, done, completedAt }
    stories: {},     // storyId -> { read: n, last }
    roleplays: {},   // unitId -> { best, last }
    stats: { days: {} },
    log: [],         // review log [cardId, ts, rating, verdict, ms]
    settings: { ...DEFAULT_SETTINGS },
    game: null,      // XP, achievements, missions … (see gamify.js)
  };
}

let state = null;
let saveTimer = null;
const listeners = new Set();

function safeGet() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function safeSet(v) {
  try { localStorage.setItem(KEY, v); return true; } catch (e) { console.warn('save failed', e); return false; }
}

export function load() {
  const raw = safeGet();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      state = { ...freshState(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) } };
    } catch {
      state = freshState();
    }
  } else {
    state = freshState();
  }
  return state;
}

export function getState() {
  return state ?? load();
}

export function save(immediate = false) {
  clearTimeout(saveTimer);
  const doSave = () => {
    if (state.log.length > 20000) state.log = state.log.slice(-15000);
    safeSet(JSON.stringify(state));
  };
  if (immediate) doSave(); else saveTimer = setTimeout(doSave, 250);
}

export function update(fn) {
  const s = getState();
  fn(s);
  save();
  for (const l of listeners) { try { l(s); } catch (e) { console.error(e); } }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const settings = () => getState().settings;

/** Local date key; a "day" rolls over at 04:00 so late-night study counts for the same day. */
export function dayKey(ts = Date.now()) {
  const d = new Date(ts - 4 * 3600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Epoch ms of the next 04:00 rollover. */
export function nextDayStart(ts = Date.now()) {
  const d = new Date(ts);
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 4, 0, 0, 0);
  if (r.getTime() <= ts) r.setDate(r.getDate() + 1);
  return r.getTime();
}

export function todayStats(ts = Date.now()) {
  const s = getState();
  const k = dayKey(ts);
  s.stats.days[k] ??= { reviews: 0, correct: 0, newCards: 0, ms: 0, lessons: 0 };
  return s.stats.days[k];
}

export function bump(field, n = 1, ts = Date.now()) {
  todayStats(ts)[field] = (todayStats(ts)[field] || 0) + n;
  save();
}

export function streak(ts = Date.now()) {
  const days = getState().stats.days;
  const goal = 1; // any real study counts towards the streak
  let n = 0;
  let t = ts;
  // Today counts only if done; otherwise start from yesterday
  const active = (k) => (days[k]?.reviews || 0) + (days[k]?.lessons || 0) >= goal;
  if (!active(dayKey(t))) t -= 86400_000;
  while (active(dayKey(t))) { n++; t -= 86400_000; }
  return n;
}

export function exportData() {
  return JSON.stringify({ app: 'norsk-na', exportedAt: new Date().toISOString(), state: { ...getState(), settings: { ...getState().settings, aiKey: '' } } }, null, 1);
}

export function importData(json) {
  const parsed = JSON.parse(json);
  const incoming = parsed.state ?? parsed;
  if (!incoming || typeof incoming.cards !== 'object') throw new Error('This file does not look like a Norsk Nå backup.');
  const keepKey = getState().settings.aiKey;
  state = { ...freshState(), ...incoming, settings: { ...DEFAULT_SETTINGS, ...(incoming.settings || {}), aiKey: keepKey } };
  save(true);
  for (const l of listeners) l(state);
}

export function resetAll() {
  state = freshState();
  save(true);
  for (const l of listeners) l(state);
}

// --- IndexedDB for imported documents ------------------------------------

const DB_NAME = 'norsk-na-docs';
let dbPromise = null;

function db() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction('docs', mode);
    const store = t.objectStore('docs');
    const result = fn(store);
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
  }));
}

export const docs = {
  put: (doc) => tx('readwrite', (s) => s.put(doc)),
  get: (id) => db().then((d) => new Promise((resolve, reject) => {
    const r = d.transaction('docs').objectStore('docs').get(id);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
  })),
  list: () => db().then((d) => new Promise((resolve, reject) => {
    const r = d.transaction('docs').objectStore('docs').getAll();
    r.onsuccess = () => resolve((r.result || []).map(({ pages, ...meta }) => ({ ...meta, pageCount: pages?.length ?? 0 }))
      .sort((a, b) => b.importedAt - a.importedAt));
    r.onerror = () => reject(r.error);
  })),
  delete: (id) => tx('readwrite', (s) => s.delete(id)),
};
