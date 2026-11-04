// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler, newSrsState, Rating, State, DAY, MINUTE, retrievability } from '../js/core/fsrs.js';
import {
  checkAnswer, normalize, lemmaCandidates, detectLanguage, splitSentences, makeCloze, tokenize, similarity, expandOptional,
} from '../js/core/text.js';

const T0 = Date.UTC(2026, 0, 1, 10);

test('retrievability is 90% after exactly S days', () => {
  assert.ok(Math.abs(retrievability(10, 10) - 0.9) < 1e-9);
  assert.ok(retrievability(1, 10) > 0.9);
  assert.ok(retrievability(30, 10) < 0.9);
});

test('new card: Again → 1 min learning step, Good → 10 min step, Easy → graduates', () => {
  const s = createScheduler({ fuzz: false });
  const again = s.review(newSrsState(T0), Rating.Again, T0);
  assert.equal(again.state, State.Learning);
  assert.equal(again.due - T0, 1 * MINUTE);
  const good = s.review(newSrsState(T0), Rating.Good, T0);
  assert.equal(good.state, State.Learning);
  assert.equal(good.due - T0, 10 * MINUTE);
  const easy = s.review(newSrsState(T0), Rating.Easy, T0);
  assert.equal(easy.state, State.Review);
  assert.ok(easy.due - T0 >= 10 * DAY, 'easy first answer should give a long interval');
});

test('graduation and growing intervals on successive Good answers', () => {
  const s = createScheduler({ fuzz: false });
  let c = s.review(newSrsState(T0), Rating.Good, T0);
  let now = T0 + 10 * MINUTE;
  c = s.review(c, Rating.Good, now);
  assert.equal(c.state, State.Review);
  const intervals = [];
  for (let i = 0; i < 5; i++) {
    const ivl = Math.round((c.due - now) / DAY);
    intervals.push(ivl);
    now = c.due;
    c = s.review(c, Rating.Good, now);
  }
  for (let i = 1; i < intervals.length; i++) assert.ok(intervals[i] > intervals[i - 1], `intervals grow: ${intervals}`);
  assert.ok(intervals[0] >= 2 && intervals[0] <= 6, `first interval ~4d, got ${intervals[0]}`);
});

test('lapse sends a review card to relearning and lowers stability', () => {
  const s = createScheduler({ fuzz: false });
  let c = s.review(newSrsState(T0), Rating.Easy, T0);
  const before = c.s;
  c = s.review(c, Rating.Again, c.due);
  assert.equal(c.state, State.Relearning);
  assert.equal(c.lapses, 1);
  assert.ok(c.s < before);
});

test('button previews are ordered Again < Hard < Good < Easy for review cards', () => {
  const s = createScheduler();
  let c = s.review(newSrsState(T0), Rating.Good, T0);
  c = s.review(c, Rating.Good, T0 + 10 * MINUTE);
  const p = s.preview(c, c.due, 'card-1');
  assert.ok(p[1].delayMs < p[2].delayMs && p[2].delayMs < p[3].delayMs && p[3].delayMs < p[4].delayMs,
    JSON.stringify(Object.values(p).map((x) => x.delayMs / DAY)));
});

test('higher desired retention → shorter intervals', () => {
  const lo = createScheduler({ retention: 0.8, fuzz: false });
  const hi = createScheduler({ retention: 0.95, fuzz: false });
  assert.ok(lo.intervalDays(20) > hi.intervalDays(20));
});

test('answer checking: exact, articles, å-infinitive, optional parts, alternatives', () => {
  assert.equal(checkAnswer('Hei!', 'hei').verdict, 'correct');
  assert.equal(checkAnswer('bil', 'en bil').verdict, 'correct');
  assert.equal(checkAnswer('å snakke', 'snakke').verdict, 'correct');
  assert.equal(checkAnswer('takk', 'takk (skal du ha)').verdict, 'correct');
  assert.equal(checkAnswer('takk skal du ha', 'takk (skal du ha)').verdict, 'correct');
  assert.equal(checkAnswer('halla', 'hei', ['halla', 'hallo']).verdict, 'correct');
  assert.equal(checkAnswer('kaffe|te', 'te|kaffe').verdict, 'wrong'); // pipe is not user syntax
  assert.equal(checkAnswer('te', 'te|kaffe').verdict, 'correct');
});

test('answer checking: diacritics and typos are "almost"', () => {
  const r = checkAnswer('pa', 'på');
  assert.equal(r.verdict, 'almost');
  assert.match(r.note, /æ, ø, å/);
  assert.equal(checkAnswer('hyggelig', 'hyggelig').verdict, 'correct');
  assert.equal(checkAnswer('hygelig', 'hyggelig').verdict, 'almost');
  assert.equal(checkAnswer('katt', 'hund').verdict, 'wrong');
  assert.equal(checkAnswer('', 'hund').verdict, 'wrong');
});

test('sentence answers tolerate one wrong word in long sentences', () => {
  assert.equal(checkAnswer('jeg kommer fra norge og jeg bor i oslo', 'Jeg kommer fra Norge, og jeg bor i Bergen.').verdict, 'almost');
  assert.equal(checkAnswer('Jeg kommer fra Norge, og jeg bor i Bergen', 'Jeg kommer fra Norge, og jeg bor i Bergen.').verdict, 'correct');
});

test('expandOptional handles nested choices', () => {
  assert.deepEqual(expandOptional('ha det (bra)').sort(), ['ha det ', 'ha det bra'].sort());
});

test('lemma candidates cover common inflections', () => {
  const has = (w, lemma) => assert.ok(lemmaCandidates(w).includes(lemma), `${w} → ${lemma}: ${lemmaCandidates(w)}`);
  has('bilene', 'bil');
  has('bilen', 'bil');
  has('jenta', 'jente');
  has('jentene', 'jente');
  has('snakker', 'snakke');
  has('snakket', 'snakke');
  has('spiste', 'spise');
  has('prøvde', 'prøve');
  has('bodde', 'bo');
  has('bor', 'bo');
  has('stort', 'stor');
  has('store', 'stor');
  has('mannen', 'mann');
  has('kaffen', 'kaffe');
  has('Olas', 'ola');
});

test('language detection separates Norwegian and English lines', () => {
  assert.equal(detectLanguage('Jeg heter Kari, og jeg bor i Bergen.').lang, 'no');
  assert.equal(detectLanguage('Translate the following sentences into English.').lang, 'en');
  assert.equal(detectLanguage('Hvor kommer du fra?').lang, 'no');
  assert.equal(detectLanguage('Chapter 3: The present tense of verbs').lang, 'en');
});

test('sentence splitting keeps dialogue punctuation', () => {
  assert.deepEqual(splitSentences('Hei! Hvordan går det? Bra, takk. Og du?'), ['Hei!', 'Hvordan går det?', 'Bra, takk.', 'Og du?']);
  assert.deepEqual(splitSentences('Det koster 30 kr. Takk.'), ['Det koster 30 kr.', 'Takk.']);
});

test('cloze finds inflected forms and multi-word targets', () => {
  const c1 = makeCloze('Jeg snakker litt norsk.', 'å snakke');
  assert.equal(c1.answer, 'snakker');
  const c2 = makeCloze('Kan jeg få en kaffe, takk?', 'kan jeg få');
  assert.equal(c2.answer, 'Kan jeg få');
  assert.equal(c2.after, ' en kaffe, takk?');
  assert.equal(makeCloze('Hei på deg', 'bil'), null);
});

test('tokenize keeps æøå words intact', () => {
  const toks = tokenize('Blåbær-syltetøy på brødskiva!').filter((t) => t.word).map((t) => t.t);
  assert.deepEqual(toks, ['Blåbær-syltetøy', 'på', 'brødskiva']);
});

test('similarity for speaking practice', () => {
  assert.equal(similarity('Jeg heter Ola', 'jeg heter ola.'), 1);
  assert.ok(similarity('jeg heter ola nordmann', 'Jeg heter Ola') > 0.6);
  assert.ok(similarity('god morgen', 'Jeg kommer fra Spania') < 0.4);
  assert.equal(normalize('  «Hei»,  sa   hun. '), 'hei sa hun');
});
