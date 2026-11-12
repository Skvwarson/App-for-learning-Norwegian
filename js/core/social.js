// The race between friends. Builds a comparable snapshot of each player.
// Today the friend is DEMO data; once Firebase is connected, friends' real
// snapshots come from there and replace demoFriends(), the screens stay the same.

import { getState, settings, dayKey } from './store.js';
import { levelInfo, streak, activity, getGame } from './gamify.js';
import { knowledgeMap } from './deck.js';
import { UNITS, lesson } from './course.js';

/** Your own stats in the shape every player shares. */
export function mySnapshot(now = Date.now()) {
  const week = activity(7, now).map((d) => d.xp);
  const known = [...knowledgeMap().values()].filter((v) => v === 'known').length;
  const doneUnits = UNITS.filter((u) => lesson(u.id).done);
  const lv = levelInfo();
  return {
    id: 'me',
    name: settings().name || 'You',
    you: true,
    xpTotal: lv.xp,
    level: lv.level,
    levelTitle: lv.title,
    streak: streak(now),
    week,
    xpWeek: week.reduce((a, b) => a + b, 0),
    wordsKnown: known,
    unitsDone: doneUnits.length,
    lastUnit: doneUnits[doneUnits.length - 1]?.title ?? null,
    bestCombo: getGame().bestCombo || 0,
    lastActive: Math.max(0, ...getState().log.slice(-1).map((l) => l[1])),
  };
}

// Small deterministic PRNG so the demo looks the same all day but changes daily.
function rng(seed) {
  let x = 0;
  for (const ch of seed) x = (Math.imul(x, 31) + ch.charCodeAt(0)) | 0;
  return () => { x = (Math.imul(x ^ (x >>> 15), 2246822507) + 0x9e3779b9) | 0; return ((x >>> 0) % 10000) / 10000; };
}

/** Demo friend(s) whose numbers sit close to yours, so the race feels real. */
export function demoFriends(me = mySnapshot(), now = Date.now()) {
  const r = rng(`demo-${dayKey(now)}`);
  const make = (name, skill) => {
    const week = Array.from({ length: 7 }, (_, i) => (r() < 0.15 && i < 6 ? 0 : Math.round((60 + r() * 140) * skill)));
    const xpWeek = week.reduce((a, b) => a + b, 0);
    const xpTotal = Math.max(xpWeek, Math.round(me.xpTotal * (0.75 + r() * 0.5) + 300 * skill));
    let L = 1; while (xpTotal >= 50 * L * (L + 1)) L++;
    const unitsDone = Math.min(UNITS.length, Math.max(1, me.unitsDone + Math.round((r() - 0.4) * 3)));
    return {
      id: `demo-${name}`, name, you: false, demo: true,
      xpTotal, level: L, levelTitle: null,
      streak: Math.max(1, Math.round(me.streak + (r() - 0.3) * 6)),
      week, xpWeek,
      wordsKnown: Math.max(5, Math.round(me.wordsKnown * (0.8 + r() * 0.5) + 20 * skill)),
      unitsDone,
      lastUnit: UNITS[unitsDone - 1]?.title ?? null,
      bestCombo: Math.round(8 + r() * 20),
      lastActive: now - Math.round(r() * 20) * 3600_000,
    };
  };
  return [make('Ola', 1.05)];
}

/** Everyone in the race (you first), plus whether it's demo data. */
export function raceSnapshot(now = Date.now()) {
  const me = mySnapshot(now);
  const friends = demoFriends(me, now); // ← replaced by Firebase later
  return { players: [me, ...friends], demo: friends.some((f) => f.demo) };
}

/** Recent things worth bragging about, newest first (for the feed). */
export function raceFeed(players, now = Date.now()) {
  const items = [];
  for (const p of players) {
    const who = p.you ? 'You' : p.name;
    if (p.streak >= 3) items.push({ p, icon: '🔥', text: `${who} reached a ${p.streak}-day streak`, at: now - 3 * 3600_000 });
    if (p.lastUnit) items.push({ p, icon: '🎓', text: `${who} finished “${p.lastUnit}”`, at: p.lastActive || now - 6 * 3600_000 });
    if (p.bestCombo >= 10) items.push({ p, icon: '⚡', text: `${who} hit a ×${p.bestCombo} combo`, at: now - 26 * 3600_000 });
  }
  return items.sort((a, b) => b.at - a.at).slice(0, 6);
}
