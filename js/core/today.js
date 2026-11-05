// Today's plan: the few things that make a complete day of Norwegian, in the
// order that works best – retrieval first, then new input, then output, then
// real life. Home shows it as a checklist; every finish screen offers the next
// unfinished item, so one session flows straight into the next.

import { buildQueue, newBudgetLeft } from './deck.js';
import { currentUnit, lesson, UNITS } from './course.js';
import { getState, dayKey } from './store.js';
import { todaysMission } from './gamify.js';
import { STORIES } from '../../data/stories.js';

const isToday = (ts, today) => !!ts && dayKey(ts) === today;

/** Cards that are due right now (no learn-ahead, so fresh words get their spacing gap). */
export function cardsReadyNow(now = Date.now()) {
  const q = buildQueue(now);
  return q.reviews.length + q.fresh.length + q.learning.filter((c) => c.srs.due <= now).length;
}

export function todayPlan(now = Date.now()) {
  const s = getState();
  const today = dayKey(now);
  const day = s.stats.days[today] ?? {};
  const ready = cardsReadyNow(now);
  const unit = currentUnit();
  const ul = lesson(unit.id);
  const courseDone = UNITS.every((u) => lesson(u.id).done);

  // Reading: the next unread story from a unit you've started; otherwise any unread one.
  const started = (st) => !!s.lessons[st.unit];
  const story = STORIES.find((st) => !s.stories[st.id] && started(st)) ?? STORIES.find((st) => !s.stories[st.id]) ?? STORIES[0];
  const readToday = Object.values(s.stories).some((x) => isToday(x.last, today));

  // Speaking: a role-play from the most recent unit you've finished.
  const finished = UNITS.filter((u) => lesson(u.id).done);
  const rpUnit = finished[finished.length - 1] ?? unit;
  const spokeToday = (day.lessons ?? 0) > 0 || Object.values(s.roleplays).some((r) => isToday(r.last, today));

  const mission = todaysMission(now);
  const continuing = ul.step && ul.step !== 'intro' && !ul.done;

  return [
    {
      id: 'reviews', icon: '🔁', label: 'Reviews', done: ready === 0, href: '#/review',
      note: ready ? `${ready} ready` : day.reviews ? 'done' : 'nothing due',
      cta: 'Start today’s session', sub: `${ready} cards ready for review · ~${Math.max(1, Math.round(ready * 0.15))} min`,
    },
    {
      id: 'lesson', icon: '📚', label: 'New words', done: courseDone || (day.lessons ?? 0) > 0 || newBudgetLeft(now) === 0,
      href: `#/lesson/${unit.id}/${ul.step || 'intro'}`, note: unit.title,
      cta: `${continuing ? 'Continue' : 'Next lesson'}: ${unit.title}`, sub: unit.subtitle,
    },
    {
      id: 'story', icon: '📖', label: 'Read something', done: readToday, href: `#/read/story/${story.id}`, note: story.title,
      cta: `Read: ${story.title}`, sub: 'A short story you’ll mostly understand',
    },
    {
      id: 'speak', icon: '🗣️', label: 'Speak out loud', done: spokeToday, href: `#/roleplay/${rpUnit.id}`, note: rpUnit.roleplay.title,
      cta: `Speak: ${rpUnit.roleplay.title}`, sub: 'A short role-play – say every answer out loud',
    },
    {
      id: 'mission', icon: mission.icon, label: 'Daily-life mission', done: mission.done, href: '#/mission', note: '+25 XP',
      cta: 'Today’s real-life mission', sub: mission.text,
    },
  ];
}

/** The first unfinished item of today's plan (optionally skipping one), or null when the day is complete. */
export function nextStep(except = null, now = Date.now()) {
  return todayPlan(now).find((item) => !item.done && item.id !== except) ?? null;
}
