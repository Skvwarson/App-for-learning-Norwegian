// Course progression: units → cards, lesson steps, unlocking.

import { UNITS, unitById } from '../../data/units.js';
import { NUMBER_WORDS } from '../../data/dictionary.js';
import { getState, update, bump } from './store.js';
import { addCard, getCard, findCardByNo } from './deck.js';
import { makeCloze, slug } from './text.js';
import { addXp, unlock } from './gamify.js';
import { State } from './fsrs.js';

export const STEPS = ['intro', 'listen', 'words', 'grammar', 'practice', 'speak', 'done'];
export const STEP_LABELS = { intro: 'Start', listen: 'Listen', words: 'Words', grammar: 'Grammar', practice: 'Practice', speak: 'Speak', done: 'Done' };

export const cardIdFor = (unit, w) => `${unit.id}:${slug(w.no)}`;

export function exampleFor(unit, w) {
  if (w.ex) return { no: w.ex[0], en: w.ex[1] };
  for (const [, no, en] of unit.dialogue) {
    if (makeCloze(no, w.no.split('|')[0])) return { no, en };
  }
  return null;
}

/** Create (or fetch) the deck card for a unit word. */
export function cardForWord(unit, w) {
  const id = cardIdFor(unit, w);
  const existing = getCard(id) ?? findCardByNo(w.no);
  if (existing) return existing;
  return addCard({
    id, no: w.no, en: w.en, alt: w.alt ?? [], pos: w.pos ?? '', g: w.g ?? '',
    ex: exampleFor(unit, w), note: w.forms ?? '', unit: unit.id, src: 'course',
  }).card;
}

export function lesson(unitId) {
  return getState().lessons[unitId] ?? { step: 'intro', done: false, wordsDone: 0 };
}

export function setLesson(unitId, patch) {
  update((s) => { s.lessons[unitId] = { ...lesson(unitId), ...patch }; });
}

export function completeLesson(unitId) {
  const already = lesson(unitId).done;
  setLesson(unitId, { done: true, step: 'done', completedAt: lesson(unitId).completedAt ?? Date.now() });
  if (already) return 0;
  bump('lessons', 1);
  if (unitId === 'u03') update((s) => { for (const n of NUMBER_WORDS) s.known[n] = true; });
  unlock('first-lesson');
  const done = UNITS.filter((u) => lesson(u.id).done).length;
  if (done >= Math.ceil(UNITS.length / 2)) unlock('half');
  if (done >= UNITS.length) unlock('all-units');
  return addXp(50, 'lesson');
}

/** A unit opens when the previous one is done (or far enough along), or once you've started it. */
export function isUnlocked(unit) {
  const i = UNITS.indexOf(unit);
  if (i <= 0) return true;
  if (getState().lessons[unit.id]) return true;
  const prev = lesson(UNITS[i - 1].id);
  return prev.done || STEPS.indexOf(prev.step) >= STEPS.indexOf('practice');
}

/** First unit that isn't finished, "where you are" on the journey. */
export function currentUnit() {
  return UNITS.find((u) => !lesson(u.id).done) ?? UNITS[UNITS.length - 1];
}

/** 0-1: how much of the unit's vocabulary is in long-term memory. */
export function unitMastery(unit) {
  let n = 0, strong = 0;
  for (const w of unit.words) {
    n++;
    const c = getCard(cardIdFor(unit, w)) ?? findCardByNo(w.no);
    if (c && c.srs.state === State.Review) strong += c.srs.s >= 21 ? 1 : 0.6;
    else if (c && c.srs.reps > 0) strong += 0.25;
  }
  return n ? strong / n : 0;
}

export { UNITS, unitById };
