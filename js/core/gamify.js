// Motivation layer: XP, levels, combos, surprise bonuses, daily goal, forgiving
// streaks (with freezes), achievements, daily-life missions and a
// "conversation readiness" estimate. Psychology notes in data/science.js.

import { getState, update, dayKey, streak as rawStreak, todayStats } from './store.js';
import { ACHIEVEMENTS, LEVEL_TITLES, MISSIONS } from '../../data/habits.js';

const listeners = {};
export function on(evt, fn) { (listeners[evt] ??= new Set()).add(fn); return () => listeners[evt].delete(fn); }
function emit(evt, data) { for (const fn of listeners[evt] ?? []) { try { fn(data); } catch (e) { console.error(e); } } }

const GAME_DEFAULTS = { xp: 0, freezes: 0, frozen: {}, achievements: {}, missions: {}, bestCombo: 0, xpDays: {}, plan: null, onboarded: false, mined: 0, chats: 0, streakShownDay: '', dayDone: '' };

function game() {
  const s = getState();
  s.game ??= {};
  // Fill any missing fields (older saves, restored backups) so nothing reads undefined.
  for (const [k, v] of Object.entries(GAME_DEFAULTS)) {
    if (s.game[k] == null) s.game[k] = v && typeof v === 'object' ? { ...v } : v;
  }
  return s.game;
}

export const getGame = game;

// ---------- Levels ----------
export const xpForLevel = (L) => 50 * (L - 1) * L; // total XP needed to *reach* level L (L1 = 0)

export function levelInfo(xp = game().xp) {
  let L = 1;
  while (xp >= xpForLevel(L + 1)) L++;
  const base = xpForLevel(L), next = xpForLevel(L + 1);
  const t = LEVEL_TITLES[Math.min(L - 1, LEVEL_TITLES.length - 1)];
  const stars = L > LEVEL_TITLES.length ? ' ' + '★'.repeat(Math.min(5, L - LEVEL_TITLES.length)) : '';
  return { level: L, title: t[0] + stars, titleEn: t[1], into: xp - base, span: next - base, pct: (xp - base) / (next - base), xp };
}

// ---------- XP ----------
export function todayXp(ts = Date.now()) { return game().xpDays[dayKey(ts)] ?? 0; }

export function dailyGoal() { return getState().settings.dailyGoalXp ?? 100; }

/** Award XP. Fires 'xp', 'levelup', 'goal' events. Returns amount awarded. */
export function addXp(amount, reason = '', ts = Date.now()) {
  amount = Math.round(amount);
  if (amount <= 0) return 0;
  const before = levelInfo().level;
  const goalBefore = todayXp(ts) >= dailyGoal();
  update(() => {
    const g = game();
    g.xp += amount;
    const k = dayKey(ts);
    g.xpDays[k] = (g.xpDays[k] ?? 0) + amount;
  });
  emit('xp', { amount, reason });
  // The first real activity of the day extends the streak – celebrate it (once a day).
  const k = dayKey(ts);
  if (game().streakShownDay !== k && activeDay(k)) {
    update(() => { game().streakShownDay = k; });
    emit('streak', { streak: streak(ts), week: activity(7, ts) });
  }
  const after = levelInfo();
  if (after.level > before) emit('levelup', after);
  if (!goalBefore && todayXp(ts) >= dailyGoal()) {
    emit('goal', { goal: dailyGoal() });
    checkStreakAchievements(ts);
  }
  checkTimeAchievements(ts);
  return amount;
}

// ---------- Combo & surprise bonus (inside a session) ----------
export function createCombo() {
  let combo = 0, best = 0;
  return {
    get value() { return combo; },
    get best() { return best; },
    multiplier() { return 1 + Math.min(combo, 20) * 0.05; }, // up to ×2
    hit() {
      combo++; best = Math.max(best, combo);
      if (combo === 10) unlock('combo-10');
      if (combo === 25) unlock('combo-25');
      if (combo > game().bestCombo) update(() => { game().bestCombo = combo; });
      return combo;
    },
    miss() { combo = 0; },
  };
}

/** Variable-ratio reward: ~1 in 12 correct answers drops a surprise bonus. */
export function maybeBonus(rnd = Math.random) {
  if (rnd() > 0.083) return 0;
  const r = rnd();
  return r < 0.6 ? 20 : r < 0.9 ? 40 : 100;
}

/** XP for a single review answer. Effort is rewarded too – mistakes are part of learning. */
export function reviewXp(rating, combo) {
  const base = rating >= 3 ? 10 : rating === 2 ? 6 : 2;
  return base * (rating >= 2 ? combo.multiplier() : 1);
}

// ---------- Streak with freezes ----------
function activeDay(k) {
  const g = game();
  const d = getState().stats.days[k];
  return (g.xpDays[k] ?? 0) >= 10 || (d?.reviews ?? 0) > 0 || (d?.lessons ?? 0) > 0 || !!g.frozen[k];
}

export function streak(ts = Date.now()) {
  let n = 0, t = ts;
  if (!activeDay(dayKey(t))) t -= 86400_000;
  while (activeDay(dayKey(t))) { n++; t -= 86400_000; }
  return n;
}

/** Run on app start: protect the streak with freezes for missed days; earn freezes every 7 days. */
export function reconcileStreak(ts = Date.now()) {
  const g = game();
  const yesterday = dayKey(ts - 86400_000);
  const dayBefore = dayKey(ts - 2 * 86400_000);
  let usedFreeze = false;
  // Fill at most `freezes` consecutive missed days, only if there was a streak to protect.
  if (!activeDay(yesterday) && g.freezes > 0) {
    let t = ts - 86400_000, gap = [];
    while (!activeDay(dayKey(t)) && gap.length < 7) { gap.push(dayKey(t)); t -= 86400_000; }
    if (activeDay(dayKey(t)) && gap.length <= g.freezes) {
      update(() => { for (const k of gap) g.frozen[k] = true; g.freezes -= gap.length; });
      usedFreeze = gap.length;
    }
  }
  // Coming back after a break deserves a warm welcome, not guilt.
  const lastActive = Object.keys(g.xpDays).sort().pop();
  if (lastActive && !usedFreeze && lastActive < dayBefore && !activeDay(dayKey(ts))) {
    const days = Math.round((Date.parse(dayKey(ts)) - Date.parse(lastActive)) / 86400_000);
    if (days >= 3) { emit('comeback', { days }); }
  }
  return { usedFreeze };
}

function checkStreakAchievements(ts) {
  const n = streak(ts);
  if (n >= 3) unlock('streak-3');
  if (n >= 7) unlock('streak-7');
  if (n >= 30) unlock('streak-30');
  if (n >= 100) unlock('streak-100');
  // Earn a streak freeze every 7 days (max 2 in the bank).
  const g = game();
  const key = `freeze-earned-${Math.floor(n / 7)}`;
  if (n > 0 && n % 7 === 0 && !g.achievements[key] && g.freezes < 2) {
    update(() => { g.freezes += 1; g.achievements[key] = ts; });
    emit('freeze', { freezes: g.freezes });
  }
}

function checkTimeAchievements(ts) {
  const h = new Date(ts).getHours();
  if (h >= 4 && h < 8) unlock('early');
  if (h >= 22 || h < 3) unlock('night');
}

// ---------- Achievements ----------
export function unlock(id) {
  const g = game();
  if (g.achievements[id]) return false;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return false;
  update(() => { g.achievements[id] = Date.now(); });
  emit('achievement', a);
  addXp(25, 'achievement');
  return true;
}

export function achievementList() {
  const g = game();
  return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: g.achievements[a.id] ?? 0 }));
}

export function checkWordAchievements(knownCount) {
  if (knownCount >= 25) unlock('words-25');
  if (knownCount >= 100) unlock('words-100');
  if (knownCount >= 300) unlock('words-300');
  if (knownCount >= 1000) unlock('words-1000');
}

// ---------- Daily mission ----------
export function todaysMission(ts = Date.now()) {
  const k = dayKey(ts);
  const n = Math.floor(Date.parse(k) / 86400_000);
  const m = MISSIONS[((n % MISSIONS.length) + MISSIONS.length) % MISSIONS.length];
  return { ...m, done: game().missions[k] === m.id };
}

export function completeMission(ts = Date.now()) {
  const m = todaysMission(ts);
  if (m.done) return 0;
  update(() => { game().missions[dayKey(ts)] = m.id; });
  if (Object.keys(game().missions).length >= 5) unlock('missions-5');
  return addXp(25, 'mission');
}

// ---------- Conversation readiness ----------
// Rough share of tokens in everyday *spoken* language covered by the N most
// frequent words (after Nation 2006 / Adolphs & Schmitt 2003). Our course
// teaches high-frequency words first, so known-word count is a fair proxy.
const COVERAGE_CURVE = [[0, 0], [25, 0.22], [50, 0.32], [100, 0.45], [300, 0.62], [500, 0.71], [1000, 0.82], [2000, 0.89], [3000, 0.93], [5000, 0.96]];

export function readiness(knownCount) {
  let pct = 0.96;
  for (let i = 1; i < COVERAGE_CURVE.length; i++) {
    const [x1, y1] = COVERAGE_CURVE[i - 1], [x2, y2] = COVERAGE_CURVE[i];
    if (knownCount <= x2) {
      const t = x1 === 0 ? knownCount / x2 : Math.log(knownCount / x1) / Math.log(x2 / x1);
      pct = y1 + (y2 - y1) * Math.max(0, t);
      break;
    }
  }
  const milestones = [
    { at: 100, label: 'First conversations' },
    { at: 300, label: 'Survival (A1)' },
    { at: 1000, label: 'Conversational (A2)' },
    { at: 2000, label: 'Comfortable (B1)' },
  ];
  const next = milestones.find((m) => knownCount < m.at) ?? null;
  return { pct, next, milestones };
}

// ---------- Activity heatmap ----------
export function activity(days = 84, ts = Date.now()) {
  const g = game();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(ts - i * 86400_000);
    out.push({ k, xp: g.xpDays[k] ?? 0, frozen: !!g.frozen[k] });
  }
  return out;
}

// ---------- Plan (implementation intention) ----------
export function setPlan(plan) { update(() => { game().plan = plan; game().onboarded = true; }); }

/** An .ics calendar file with a daily recurring reminder – works on every phone & computer. */
export function planIcs(plan) {
  const [hh, mm] = (plan.time || '08:00').split(':').map(Number);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hh, mm);
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const end = new Date(start.getTime() + (plan.minutes || 10) * 60_000);
  const cue = plan.cue ? `After I ${plan.cue}, I practise Norwegian.` : 'Time for Norwegian!';
  const url = typeof location !== 'undefined' ? location.href.split('#')[0] : '';
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Norsk Na//EN', 'BEGIN:VEVENT',
    `UID:norsk-na-daily-${Date.now()}@local`, `DTSTAMP:${fmt(now)}`,
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, 'RRULE:FREQ=DAILY',
    'SUMMARY:🇳🇴 Norsk – dagens økt', `DESCRIPTION:${cue} ${url}`.replace(/,/g, '\\,'),
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Tid for norsk!', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

export { todayStats, rawStreak };
