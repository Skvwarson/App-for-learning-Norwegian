// Run with: node --test tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeLine } from '../js/views/roleplay.js';
import { numToNo, timeToNo } from '../js/views/practice.js';
import { levelInfo, xpForLevel, readiness, maybeBonus, createCombo } from '../js/core/gamify.js';
import { UNITS } from '../data/units.js';
import { STORIES } from '../data/stories.js';
import { DICTIONARY } from '../data/dictionary.js';
import { makeCloze } from '../js/core/text.js';
import { parseNumberWord } from '../js/core/lexicon.js';

test('role-play judging accepts wildcards, variants and near misses', () => {
  const line = { accept: ['hei jeg heter *', 'jeg heter *'], model: 'Hei! Jeg heter {name}.' };
  assert.equal(judgeLine('Hei! Jeg heter Kari.', line, 'Alex'), 'correct');
  assert.equal(judgeLine('jeg heter Ola Nordmann', line, 'Alex'), 'correct');
  assert.equal(judgeLine('hei jeg hete Kari', line, 'Alex'), 'almost');
  assert.equal(judgeLine('god morgen', line, 'Alex'), 'wrong');
  const fixed = { accept: ['kan jeg betale med kort'], model: 'Kan jeg betale med kort?' };
  assert.equal(judgeLine('Kan jeg betale med kort?', fixed, 'A'), 'correct');
  assert.equal(judgeLine('kan jeg betal med kort', fixed, 'A'), 'almost');
});

test('numbers and clock times in Norwegian', () => {
  assert.equal(numToNo(7), 'sju');
  assert.equal(numToNo(21), 'tjueen');
  assert.equal(numToNo(35), 'trettifem');
  assert.equal(numToNo(100), 'hundre');
  assert.equal(numToNo(120), 'hundre og tjue');
  assert.equal(numToNo(999), 'ni hundre og nittini');
  assert.equal(timeToNo(18, 30), 'halv sju');
  assert.equal(timeToNo(14, 15), 'kvart over to');
  assert.equal(timeToNo(9, 45), 'kvart på ti');
  assert.equal(timeToNo(6, 25), 'fem på halv sju');
  assert.equal(timeToNo(0, 0), 'tolv');
  assert.equal(timeToNo(13, 0), 'ett');
});

test('levels get progressively longer; readiness rises with vocabulary', () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(99).level, 1);
  assert.equal(levelInfo(100).level, 2);
  assert.ok(xpForLevel(11) - xpForLevel(10) > xpForLevel(3) - xpForLevel(2));
  assert.ok(readiness(1000).pct > readiness(300).pct && readiness(300).pct > readiness(50).pct);
  assert.ok(Math.abs(readiness(1000).pct - 0.82) < 0.01);
  assert.equal(readiness(0).pct, 0);
});

test('combo multiplier caps at ×2 and bonuses are occasional', () => {
  const c = createCombo();
  for (let i = 0; i < 40; i++) c.hit();
  assert.equal(c.multiplier(), 2);
  c.miss();
  assert.equal(c.multiplier(), 1);
  let n = 0;
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 10000; i++) if (maybeBonus(rnd)) n++;
  assert.ok(n > 500 && n < 1200, `bonus rate ${n / 100}%`);
});

test('course content is well-formed', () => {
  const ids = new Set();
  for (const u of UNITS) {
    assert.ok(!ids.has(u.id)); ids.add(u.id);
    assert.ok(u.dialogue.length >= 8, `${u.id} dialogue`);
    assert.ok(u.words.length >= 12 && u.words.length <= 21, `${u.id} has ${u.words.length} words`);
    assert.ok(u.grammar.drills.length >= 4);
    for (const d of u.grammar.drills) {
      const bare = (s) => s.replace(/[.!?]/g, '').split(' ').sort().join(' ');
      if (d.type === 'order') assert.equal(bare(d.tiles.join(' ')), bare(d.a), `${u.id} tiles ${d.a}`);
    }
    const you = u.roleplay.lines.filter((l) => l.who === 'you');
    assert.ok(you.length >= 3);
    for (const l of you) assert.ok(l.accept.length && l.model && l.cue, `${u.id} roleplay line`);
    // every model answer must be accepted by its own rules
    for (const l of you) assert.notEqual(judgeLine(l.model.replace('{name}', 'Alex'), l, 'Alex'), 'wrong', `${u.id}: “${l.model}” rejected`);
    // every word should have an example sentence (explicit or found in the dialogue)
    for (const w of u.words) {
      const found = w.ex || u.dialogue.some(([, no]) => makeCloze(no, w.no.split('|')[0]));
      assert.ok(found, `${u.id}: no example for “${w.no}”`);
    }
  }
  assert.equal(STORIES.length, UNITS.length);
});

test('glossary finds infinitives without “å” and reads compound numbers', () => {
  assert.equal(DICTIONARY.get('danse').en, 'to dance');
  assert.equal(DICTIONARY.get('danse').no, 'å danse');
  assert.ok(DICTIONARY.get('spise'));
  assert.equal(parseNumberWord('tjuefem'), 25);
  assert.equal(parseNumberWord('åttifire'), 84);
  assert.equal(parseNumberWord('tjue'), null);
  assert.equal(parseNumberWord('tirsdag'), null);
});

test('today’s plan leads from new words to reading and speaking', async () => {
  const { nextStep, todayPlan } = await import('../js/core/today.js');
  const { bump, update } = await import('../js/core/store.js');
  assert.deepEqual(todayPlan().map((i) => i.id), ['reviews', 'lesson', 'story', 'speak']);
  assert.equal(nextStep().id, 'lesson'); // nothing due yet → learn something new
  bump('lessons', 1);                     // finishing a lesson also counts as speaking (it ends with a role-play)
  update((s) => { s.lessons.u01 = { step: 'done', done: true }; });
  assert.equal(nextStep().id, 'story');
  assert.equal(nextStep().href, '#/read/story/s01');
  assert.equal(nextStep('story'), null); // speaking is done too → the day is complete
});
