// The deck: cards, review queue, statistics and the "what do I already know" map
// that powers comprehensible-input coverage in the reader.

import { createScheduler, newSrsState, State, Rating, DAY } from './fsrs.js';
import { getState, update, settings, bump, nextDayStart, dayKey } from './store.js';
import { normalize, words, lemmaCandidates, slug, makeCloze } from './text.js';

let scheduler = null;
let schedulerRetention = null;

export function sched() {
  const r = settings().retention;
  if (!scheduler || schedulerRetention !== r) {
    scheduler = createScheduler({ retention: r });
    schedulerRetention = r;
  }
  return scheduler;
}

/** "en bil" → "bil", "å snakke" → "snakke", "Hvordan går det?" → "hvordan går det" */
export function lemmaKey(no) {
  return normalize(String(no).split('|')[0]).replace(/^(en|ei|et|å)\s+/, '');
}

export function allCards() {
  return Object.values(getState().cards);
}

export function getCard(id) {
  return getState().cards[id] ?? null;
}

export function findCardByNo(no) {
  const key = lemmaKey(no);
  return allCards().find((c) => lemmaKey(c.no) === key) ?? null;
}

/**
 * Create a card (or return the existing one with the same Norwegian text).
 * fields: { no, en, alt?, pos?, g?, ex?: {no, en}, unit?, src?, note?, id? }
 */
export function addCard(fields) {
  const existing = (fields.id && getCard(fields.id)) || findCardByNo(fields.no);
  if (existing) {
    // Enrich with context if the existing card lacks it.
    if (!existing.ex && fields.ex) update((s) => { s.cards[existing.id].ex = fields.ex; });
    return { card: getCard(existing.id), created: false };
  }
  const id = fields.id ?? `x-${slug(fields.no)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const card = {
    id,
    no: fields.no.trim(),
    en: (fields.en ?? '').trim(),
    alt: fields.alt ?? [],
    pos: fields.pos ?? '',
    g: fields.g ?? '',
    ex: fields.ex ?? null,
    note: fields.note ?? '',
    unit: fields.unit ?? null,
    src: fields.src ?? 'manual',
    created: Date.now(),
    seen: 0,
    suspended: false,
    srs: newSrsState(),
  };
  update((s) => { s.cards[id] = card; });
  return { card, created: true };
}

export function editCard(id, patch) {
  update((s) => { Object.assign(s.cards[id], patch); });
}

export function deleteCard(id) {
  update((s) => { delete s.cards[id]; });
}

/** Mark a new card as introduced (shown with its meaning), it comes back shortly for a real recall attempt. */
export function markSeen(id, now = Date.now()) {
  update((s) => {
    const c = s.cards[id];
    if (!c.seen) bump('newCards', 1, now);
    c.seen = now;
    c.srs.due = now + 60_000;
  });
}

/** Record a retrieval attempt. Returns the updated card. */
export function rateCard(id, rating, { verdict = '', ms = 0, now = Date.now() } = {}) {
  let out;
  update((s) => {
    const c = s.cards[id];
    if (!c) return;
    const wasNew = c.srs.state === State.New;
    if (wasNew && !c.seen) { bump('newCards', 1, now); c.seen = now; }
    c.srs = sched().review(c.srs, rating, now, c.id);
    s.log.push([id, now, rating, verdict, Math.round(ms)]);
    out = c;
  });
  bump('reviews', 1, now);
  if (rating >= Rating.Hard) bump('correct', 1, now);
  return out;
}

export function previewRatings(card, now = Date.now()) {
  return sched().preview(card.srs, now, card.id);
}

export function newIntroducedToday(now = Date.now()) {
  return getState().stats.days[dayKey(now)]?.newCards ?? 0;
}

export function newBudgetLeft(now = Date.now()) {
  return Math.max(0, settings().newPerDay - newIntroducedToday(now));
}

/**
 * What to study now.
 *  learning, cards in short-term steps (minutes)
 *  reviews , long-term reviews due today, most-at-risk first
 *  fresh   , user-added cards never shown yet (within the daily new budget)
 */
export function buildQueue(now = Date.now()) {
  const cutoff = nextDayStart(now);
  const learning = [], reviews = [], fresh = [];
  const sc = sched();
  for (const c of allCards()) {
    if (c.suspended) continue;
    const st = c.srs.state;
    if (st === State.New) {
      if (c.seen) learning.push(c); // introduced, awaiting first recall
      else if (!c.unit || c.src !== 'course') fresh.push(c);
    } else if (st === State.Learning || st === State.Relearning) {
      learning.push(c);
    } else if (c.srs.due < cutoff) {
      reviews.push(c);
    }
  }
  learning.sort((a, b) => a.srs.due - b.srs.due);
  reviews.sort((a, b) => sc.retrievabilityNow(a.srs, now) - sc.retrievabilityNow(b.srs, now));
  fresh.sort((a, b) => a.created - b.created);
  const doneToday = getState().stats.days[dayKey(now)]?.reviews ?? 0;
  const reviewCap = Math.max(0, settings().maxReviews - doneToday);
  return {
    learning,
    reviews: reviews.slice(0, Math.max(reviewCap, Math.min(reviews.length, 20))),
    fresh: fresh.slice(0, newBudgetLeft(now)),
    totalDue: reviews.length,
  };
}

export function dueCount(now = Date.now()) {
  const q = buildQueue(now);
  const learningNow = q.learning.filter((c) => c.srs.due <= now + 20 * 60_000).length;
  return { reviews: q.reviews.length, learning: learningNow, fresh: q.fresh.length, total: q.reviews.length + learningNow + q.fresh.length };
}

/** Upcoming reviews per day for the next n days (for the forecast chart). */
export function forecast(days = 7, now = Date.now()) {
  const out = Array(days).fill(0);
  const start = nextDayStart(now) - DAY;
  for (const c of allCards()) {
    if (c.suspended || c.srs.state === State.New) continue;
    const idx = Math.floor((Math.max(c.srs.due, start) - start) / DAY);
    if (idx >= 0 && idx < days) out[idx]++;
  }
  return out;
}

export function deckStats(now = Date.now()) {
  let total = 0, newC = 0, learning = 0, young = 0, mature = 0, suspended = 0;
  for (const c of allCards()) {
    total++;
    if (c.suspended) { suspended++; continue; }
    const st = c.srs.state;
    if (st === State.New) newC++;
    else if (st !== State.Review) learning++;
    else if (c.srs.s >= 21) mature++;
    else young++;
  }
  const log = getState().log;
  const recent = log.filter((l) => l[1] > now - 30 * DAY && l[3] !== 'learning');
  const retention = recent.length ? recent.filter((l) => l[2] >= 2).length / recent.length : null;
  return { total, new: newC, learning, young, mature, suspended, retention };
}

// --- Knowledge map for comprehensible input ------------------------------

let knowCache = null;
let knowCacheKey = '';

/** Map lemma → 'known' | 'learning'. */
export function knowledgeMap() {
  const s = getState();
  const key = `${Object.keys(s.cards).length}:${s.log.length}:${Object.keys(s.known).length}`;
  if (knowCache && key === knowCacheKey) return knowCache;
  const m = new Map();
  const rank = { learning: 1, known: 2 };
  const put = (k, v) => { if (!k) return; if (!m.has(k) || rank[v] > rank[m.get(k)]) m.set(k, v); };
  for (const c of Object.values(s.cards)) {
    if (c.suspended) continue;
    const st = c.srs.state;
    const status = st === State.Review ? 'known' : (c.srs.reps > 0 || c.seen) ? 'learning' : null;
    if (!status) continue;
    for (const variant of String(c.no).split('|')) {
      const lk = lemmaKey(variant);
      put(lk, status);
      const ws = words(lk);
      if (ws.length > 1 && ws.length <= 5) for (const w of ws) put(w, status === 'known' ? 'known' : 'learning');
    }
  }
  for (const k of Object.keys(s.known)) put(k, 'known');
  knowCache = m;
  knowCacheKey = key;
  return m;
}

export function wordStatus(word, map = knowledgeMap()) {
  for (const cand of lemmaCandidates(word)) {
    const v = map.get(cand);
    if (v) return v;
  }
  return null;
}

/** Share of word tokens (excluding names & numbers) that are known or being learned. */
export function coverage(text, map = knowledgeMap()) {
  const toks = String(text).match(/[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu) ?? [];
  let total = 0, known = 0, learning = 0;
  const unknown = new Map();
  toks.forEach((raw, i) => {
    const prev = toks[i - 1];
    // Skip probable proper names (capitalised, not sentence-initial-ish)
    if (/^\p{Lu}/u.test(raw) && i > 0 && prev && !/[.!?]$/.test(prev) && raw.length > 1) {
      const lowerKnown = wordStatus(raw.toLowerCase(), map);
      if (!lowerKnown) return;
    }
    total++;
    const st = wordStatus(raw, map);
    if (st === 'known') known++;
    else if (st === 'learning') learning++;
    else {
      const w = raw.toLowerCase();
      unknown.set(w, (unknown.get(w) || 0) + 1);
    }
  });
  return {
    total, known, learning,
    pct: total ? (known + learning) / total : 0,
    unknown: [...unknown.entries()].sort((a, b) => b[1] - a[1]).map(([w, n]) => ({ w, n })),
  };
}

export function markKnown(word, known = true) {
  const k = lemmaKey(word);
  update((s) => { if (known) s.known[k] = true; else delete s.known[k]; });
}

// --- Exercise selection (scaffolded retrieval) ----------------------------

/**
 * Pick the exercise for a card. Difficulty rises with memory strength:
 * weak memories get recognition (lower cognitive load), stronger ones get
 * cloze-in-context and then full production / listening (desirable difficulty).
 */
export function chooseExercise(card, { ttsOk = false, rnd = Math.random } = {}) {
  const mode = settings().reviewMode;
  const hasCloze = card.ex?.no && makeCloze(card.ex.no, card.no.split('|')[0]);
  const isMulti = words(lemmaKey(card.no)).length >= 3;
  if (mode === 'recognition') return 'recognize';
  if (mode === 'production') return hasCloze && rnd() < 0.3 ? 'cloze' : 'produce';
  const s = card.srs.state === State.New ? 0 : card.srs.s;
  if (card.srs.state === State.New || s < 1.5) return 'recognize';
  if (s < 6) {
    if (isMulti && rnd() < 0.5) return 'tiles';
    return hasCloze ? 'cloze' : 'produce';
  }
  const options = ['produce', 'produce'];
  if (hasCloze) options.push('cloze');
  if (ttsOk) options.push('listen');
  if (isMulti) options.push('tiles');
  return options[Math.floor(rnd() * options.length)];
}
