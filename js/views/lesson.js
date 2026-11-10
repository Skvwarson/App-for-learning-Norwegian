// A unit lesson: context → words (chunks of 5) → one grammar point →
// interleaved retrieval practice → role-play → done.

import { h, clear, toast, sfx, haptic, confetti, progressBar, add } from '../ui/dom.js';
import { tappable, speakBtn, answerInput, tilesWidget, choicesWidget, diffView, genderTag } from '../ui/components.js';
import { unitById, UNITS, STEPS, STEP_LABELS, lesson, setLesson, completeLesson, cardForWord, exampleFor } from '../core/course.js';
import { rateCard, allCards } from '../core/deck.js';
import { checkAnswer, makeCloze, shuffle, words as wordsOf } from '../core/text.js';
import { speak, stopSpeaking, canSpeakNorwegian, hasRecording, playFile } from '../core/speech.js';
import { addXp, createCombo } from '../core/gamify.js';
import { Rating, State } from '../core/fsrs.js';
import { settings } from '../core/store.js';
import { mountRoleplay } from './roleplay.js';
import { navigate } from '../ui/router.js';
import { nextStepBlock, flushCelebrations } from '../ui/celebrate.js';

const CHUNK = 5; // working-memory friendly chunk size

export function lessonView(root, { unitId, step }) {
  const unit = unitById(unitId);
  if (!unit) { add(root, h('p', 'Unit not found.')); return; }
  const st = lesson(unitId);
  const cur = step && STEPS.includes(step) ? step : st.step || 'intro';
  if (STEPS.indexOf(cur) > STEPS.indexOf(st.step) && !st.done) setLesson(unitId, { step: cur });

  const idx = UNITS.indexOf(unit) + 1;
  const go = (s) => navigate(`#/lesson/${unitId}/${s}`);
  const next = () => {
    const n = STEPS[STEPS.indexOf(cur) + 1];
    if (!lesson(unitId).done && STEPS.indexOf(n) > STEPS.indexOf(lesson(unitId).step)) setLesson(unitId, { step: n });
    go(n);
  };

  root.classList.add('focus-view');
  add(root, 
    h('div.lesson-head',
      h('a.icon-btn', { href: '#/learn', 'aria-label': 'Back to course' }, '✕'),
      h('div.lesson-title', h('div.small.muted', `Unit ${idx}`), h('div.strong', unit.title)),
      h('div.steps', ...STEPS.filter((s) => s !== 'done').map((s) => h('a.step-dot', {
        href: `#/lesson/${unitId}/${s}`,
        class: `${s === cur ? 'active' : ''} ${STEPS.indexOf(s) < STEPS.indexOf(lesson(unitId).step) || lesson(unitId).done ? 'done' : ''}`,
        title: STEP_LABELS[s],
      }, h('span', STEP_LABELS[s]))))),
  );
  const body = h('div.lesson-body');
  add(root, body);

  const views = { intro: introStep, listen: listenStep, words: wordsStep, grammar: grammarStep, practice: practiceStep, speak: speakStep, done: doneStep };
  return views[cur](body, unit, next, go);
}

function introStep(el, unit, next) {
  // Emma announces the unit ("Unit 3") – the same voice as the dialogues.
  const no = String(UNITS.indexOf(unit) + 1).padStart(2, '0');
  const announce = () => playFile(`audio/units/u${no}.mp3`);
  if (settings().autoplay) setTimeout(announce, 250);
  add(el, h('div.stack.center-col',
    h('button.unit-announce', { type: 'button', onclick: announce, 'aria-label': 'Play the unit title' },
      h('span.small.muted', `Unit ${UNITS.indexOf(unit) + 1}`), ' ', h('span', '🔊')),
    h('div.unit-badge', unit.title),
    h('h2', unit.subtitle),
    h('div.card.stack',
      h('div.kicker', '🎯 After this lesson you can'),
      h('p.lead', unit.goal)),
    h('div.card.stack',
      h('div.kicker', '🎬 The scene'),
      h('p', unit.scene),
      h('div.kicker', '👂 Listen for'),
      h('p', unit.focus.replace(/^Listen:\s*/, ''))),
    h('p.small.muted', 'About 10–15 minutes. Small steps, one at a time – you can pause after any step and continue later.'),
    h('button.btn.primary.big', { onclick: next }, 'Start ▸')));
}

function listenStep(el, unit, next) {
  const speakers = [...new Set(unit.dialogue.map((d) => d[0]))];
  const pitch = (sp) => [1, 1.15, 0.9, 1.25][speakers.indexOf(sp) % 4];
  let playing = false;
  const lines = unit.dialogue.map(([sp, no, en], i) => {
    const enEl = h('div.line-en.hidden', en);
    const row = h('div.line', {
      class: `sp-${speakers.indexOf(sp) % 4}`,
      // In audio-only mode a tap reveals the line; otherwise it shows the English.
      onclick: () => (dialogue.classList.contains('audio-only') ? row.classList.toggle('peek') : enEl.classList.toggle('hidden')),
    },
      h('div.line-sp', sp),
      h('div.line-main', h('div.line-no.no', tappable(no, { sentence: no, translation: en, src: `course:${unit.id}`, mark: false })), enEl),
      h('div.line-actions', speakBtn(no, { pitch: pitch(sp) })));
    row.dataset.i = i;
    return row;
  });
  const playAll = h('button.btn', {
    onclick: async () => {
      if (playing) { playing = false; stopSpeaking(); playAll.textContent = '▶ Play conversation'; return; }
      playing = true; playAll.textContent = '■ Stop';
      for (let i = 0; i < unit.dialogue.length && playing; i++) {
        lines.forEach((l) => l.classList.toggle('playing', l === lines[i]));
        lines[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        await speak(unit.dialogue[i][1], { pitch: pitch(unit.dialogue[i][0]) });
        await new Promise((r) => setTimeout(r, 350));
      }
      lines.forEach((l) => l.classList.remove('playing'));
      playing = false; playAll.textContent = '▶ Play conversation';
    },
  }, '▶ Play conversation');
  const showAll = h('button.btn.ghost', { onclick: () => el.querySelectorAll('.line-en').forEach((e) => e.classList.toggle('hidden')) }, 'Show/hide English');
  const dialogue = h('div.dialogue', ...lines);
  // Listening without reading trains the ear for real conversations.
  const audioOnly = h('button.btn.ghost', {
    'aria-pressed': 'false',
    onclick: () => {
      const on = dialogue.classList.toggle('audio-only');
      audioOnly.classList.toggle('on', on);
      audioOnly.setAttribute('aria-pressed', String(on));
      lines.forEach((r) => r.classList.remove('peek'));
      if (on) toast('🎧 Audio only: listen first, then tap a line to check it.', { ms: 3000 });
    },
  }, '🎧 Audio only');
  add(el, h('div.stack',
    h('div.card.tip', h('b', '👂 '), unit.focus.replace(/^Listen:\s*/, 'Listen for this: '),
      h('div.small.muted', 'Listen first without reading the English. Tap a line to check it.')),
    h('div.row.wrap', playAll, audioOnly, showAll),
    unit.dialogue.every(([, no]) => hasRecording(no)) ? h('div.pill.ok.small', '🎧 Natural voice recordings') : null,
    dialogue,
    h('div.row.end', h('button.btn.primary.big', { onclick: () => { addXp(10, 'listen'); next(); } }, 'I’ve listened ▸'))));
  return () => { playing = false; stopSpeaking(); };
}

function wordsStep(el, unit, next) {
  const chunks = [];
  for (let i = 0; i < unit.words.length; i += CHUNK) chunks.push(unit.words.slice(i, i + CHUNK));
  let ci = Math.min(lesson(unit.id).wordsDone ?? 0, chunks.length);
  const combo = createCombo();

  const render = () => {
    clear(el);
    if (ci >= chunks.length) {
      add(el, h('div.stack.center-col',
        h('div.big-emoji', '🧠'),
        h('h2', `${unit.words.length} new words & phrases`),
        h('p', 'They are now in your memory deck. They will come back in about 10 minutes, then tomorrow, then in a few days – each time just before you would forget them.'),
        h('button.btn.primary.big', { onclick: next }, 'Next: grammar ▸')));
      return;
    }
    const chunk = chunks[ci];
    study(chunk);
  };

  const header = () => h('div.chunk-head',
    h('div.small.muted', `Group ${ci + 1} of ${chunks.length}`),
    progressBar((ci) / chunks.length));

  // 1) Study a small group of words with audio + example (encoding)
  const study = (chunk) => {
    chunk.forEach((w) => cardForWord(unit, w));
    const items = chunk.map((w) => {
      const ex = exampleFor(unit, w);
      return h('div.word-card',
        h('div.row.between',
          h('div', h('span.no.word-no', w.no), ' ', genderTag(w.g)),
          speakBtn(w.no)),
        h('div.word-en', w.en),
        w.forms ? h('div.small.muted', w.forms) : null,
        ex ? h('div.word-ex', h('span.no', tappable(ex.no, { sentence: ex.no, translation: ex.en, mark: false })), h('div.small.muted', ex.en)) : null);
    });
    add(el, header(),
      h('div.card.tip.small', '📖 Read each one out loud, and imagine yourself saying it. Then you’ll be asked to recall them – that recall is what moves them into long-term memory.'),
      h('div.word-list', ...items),
      h('div.row.end', h('button.btn.primary.big', { onclick: () => quiz(chunk) }, 'I’m ready – test me ▸')));
    if (settings().autoplay) speak(chunk[0].no);
  };

  // 2) Immediate retrieval: EN → pick the Norwegian (first FSRS rating)
  const quiz = (chunk) => {
    const queue = shuffle(chunk.map((w) => ({ w, first: true })));
    const pool = unit.words;
    const ask = () => {
      clear(el);
      if (!queue.length) {
        ci++; setLesson(unit.id, { wordsDone: ci });
        sfx.goal(); haptic([10, 40, 10]);
        render();
        return;
      }
      const item = queue.shift();
      const { w } = item;
      const opts = shuffle([w, ...shuffle(pool.filter((x) => x !== w)).slice(0, 3)]);
      const fb = h('div.feedback');
      const ch = choicesWidget(opts, {
        render: (o) => o.no,
        onPick: (o, i, btn) => {
          ch.destroy();
          const ok = o === w;
          const card = cardForWord(unit, w);
          if (item.first && card.srs.state === State.New) rateCard(card.id, ok ? Rating.Good : Rating.Again, { verdict: ok ? 'correct' : 'wrong' });
          btn.classList.add(ok ? 'right' : 'wrong');
          if (!ok) {
            ch.buttons[opts.indexOf(w)].classList.add('right');
            combo.miss(); sfx.wrong(); haptic([30, 30, 30]);
            queue.push({ w, first: false }); // try again at the end of this group
            add(fb, h('div.bad', 'Not quite – ', h('b.no', w.no), ' = ', w.en));
          } else {
            combo.hit(); sfx.correct(combo.value); haptic(10);
            addXp(8 * combo.multiplier(), 'new word');
            add(fb, h('div.good', '✓ ', w.no));
          }
          speak(w.no);
          setTimeout(ask, ok ? 900 : 1900);
        },
      });
      add(el, header(),
        h('div.prompt', h('div.small.muted', 'How do you say…'), h('div.prompt-big', w.en)),
        ch.el, fb);
    };
    ask();
  };

  render();
}

function grammarStep(el, unit, next) {
  const g = unit.grammar;
  const drills = g.drills.map((d) => ({ ...d }));
  let i = 0, correct = 0;
  const area = h('div.stack');
  const runDrill = () => {
    clear(area);
    if (i >= drills.length) {
      add(area, h('div.card.center-col.stack', h('div.big-emoji', correct === drills.length ? '🌟' : '👍'),
        h('p', `${correct} of ${drills.length} right on the first try.`),
        h('button.btn.primary.big', { onclick: () => { addXp(15 + correct * 3, 'grammar'); next(); } }, 'Next: practice ▸')));
      return;
    }
    const d = drills[i];
    const fb = h('div.feedback');
    const done = (ok, shown) => {
      add(fb, ok ? h('div.good', '✓ ', h('span.no', d.a)) : h('div.bad', 'Answer: ', h('b.no', d.a)), h('div.small.muted', d.en));
      if (ok) { correct += d.firstTry === false ? 0 : 1; sfx.correct(); haptic(10); } else { sfx.wrong(); d.firstTry = false; drills.push({ ...d, firstTry: false }); }
      speak(d.a);
      add(area, h('div.row.end', h('button.btn.primary', { onclick: () => { i++; runDrill(); }, autofocus: true }, 'Continue ▸')));
      setTimeout(() => area.querySelector('.row.end .btn')?.focus(), 30);
    };
    add(area, h('div.small.muted', `Exercise ${Math.min(i + 1, g.drills.length)} of ${g.drills.length}`));
    if (d.type === 'order') {
      const t = tilesWidget(d.tiles.map((x) => x.replace(/[.!?]+$/, '')), { shuffleFn: shuffle, onCheck: (v) => { t.disable(); done(checkAnswer(v, d.a).verdict !== 'wrong'); } });
      add(area, h('div.prompt', h('div.prompt-big', d.en)), t.el, fb);
    } else {
      const inp = answerInput({ onSubmit: (v) => { inp.setDisabled(true); done(checkAnswer(v, d.a).verdict !== 'wrong'); } });
      add(area, h('div.prompt', h('div.prompt-big.no', d.q)), inp.el, fb);
    }
  };
  add(el, h('div.stack',
    h('div.card.grammar', h('h3', g.title), h('div', { html: g.body }),
      h('div.examples', ...g.examples.map(([no, en]) => h('div.example', speakBtn(no), h('div', h('div.no', no), h('div.small.muted', en)))))),
    h('h3', 'Try it'),
    area));
  runDrill();
}

/** Interleaved retrieval practice: this unit + a few older cards. */
function practiceStep(el, unit, next) {
  const tasks = [];
  const unitWords = shuffle(unit.words);
  // Cloze from dialogue lines (context!)
  for (const w of unitWords.slice(0, 4)) {
    const ex = exampleFor(unit, w);
    const cz = ex && makeCloze(ex.no, w.no);
    if (cz) tasks.push({ type: 'cloze', cz, ex, w });
  }
  // Translate a key phrase
  for (const w of unitWords.filter((x) => wordsOf(x.no).length >= 2).slice(0, 3)) tasks.push({ type: 'produce', w });
  // Order a dialogue line
  const lines = shuffle(unit.dialogue.filter(([, no]) => wordsOf(no).length >= 3 && wordsOf(no).length <= 8)).slice(0, 2);
  for (const [, no, en] of lines) tasks.push({ type: 'tiles', no, en });
  // Listening
  if (canSpeakNorwegian()) for (const w of unitWords.slice(4, 6)) tasks.push({ type: 'listen', w });
  // Interleaving: older cards from earlier units
  const older = shuffle(allCards().filter((c) => c.unit && c.unit < unit.id && c.srs.state === State.Review)).slice(0, 3);
  for (const c of older) tasks.push({ type: 'produce', w: { no: c.no, en: c.en, alt: c.alt }, old: true });

  const list = shuffle(tasks);
  let i = 0, right = 0;
  const combo = createCombo();
  const run = () => {
    clear(el);
    if (i >= list.length) {
      const pct = list.length ? right / list.length : 1;
      add(el, h('div.stack.center-col', h('div.big-emoji', pct > 0.85 ? '🔥' : '💪'),
        h('h2', `${right} / ${list.length}`),
        h('p', pct > 0.85 ? 'Excellent recall!' : 'Mistakes here are good: effortful recall is what builds memory (“desirable difficulty”).'),
        h('button.btn.primary.big', { onclick: () => { addXp(20, 'practice'); next(); } }, 'Next: speak ▸')));
      return;
    }
    const t = list[i];
    const fb = h('div.feedback');
    const after = (ok, expected, given) => {
      if (ok) { right++; combo.hit(); sfx.correct(combo.value); haptic(10); addXp(5 * combo.multiplier(), 'practice'); add(fb, h('div.good', '✓ ', h('span.no', expected))); }
      else { combo.miss(); sfx.wrong(); haptic([30, 30, 30]); add(fb, h('div.bad', 'Answer: ', diffView(given ?? '', expected))); }
      speak(expected);
      const cont = h('button.btn.primary', { onclick: () => { i++; run(); } }, 'Continue ▸');
      add(el, h('div.row.end', cont));
      setTimeout(() => cont.focus(), 30);
    };
    add(el, h('div.chunk-head', h('div.small.muted', `${i + 1} / ${list.length}${t.old ? ' · from an earlier unit' : ''}`), progressBar(i / list.length),
      combo.value >= 3 ? h('div.combo', `🔥 ×${combo.value}`) : null));
    if (t.type === 'cloze') {
      const inp = answerInput({ expected: t.cz.answer, onSubmit: (v) => { inp.setDisabled(true); const r = checkAnswer(v, t.cz.answer); after(r.verdict !== 'wrong', t.cz.answer, v); } });
      add(el, h('div.prompt', h('div.small.muted', 'Fill the gap'),
        h('div.cloze.no', t.cz.before, h('span.gap', '_____'), t.cz.after),
        h('div.small.muted', `${t.ex.en} · (${t.w.en})`)), inp.el, fb);
    } else if (t.type === 'produce') {
      const inp = answerInput({ expected: t.w.no, onSubmit: (v, alts) => { inp.setDisabled(true); const best = [v, ...(alts || [])].find((x) => checkAnswer(x, t.w.no, t.w.alt).verdict !== 'wrong'); after(!!best, t.w.no, best ?? v); } });
      add(el, h('div.prompt', h('div.small.muted', 'Say it in Norwegian'), h('div.prompt-big', t.w.en)), inp.el, fb);
    } else if (t.type === 'tiles') {
      const tw = tilesWidget(t.no.replace(/[.!?]$/, '').split(/\s+/), { shuffleFn: shuffle, onCheck: (v) => { tw.disable(); after(checkAnswer(v, t.no).verdict !== 'wrong', t.no, v); } });
      add(el, h('div.prompt', h('div.small.muted', 'Build the sentence'), h('div.prompt-big', t.en)), tw.el, fb);
    } else if (t.type === 'listen') {
      const inp = answerInput({ placeholder: 'Type what you hear…', expected: t.w.no, onSubmit: (v) => { inp.setDisabled(true); after(checkAnswer(v, t.w.no, t.w.alt).verdict !== 'wrong', t.w.no, v); } });
      add(el, h('div.prompt', h('div.small.muted', 'Listen and type'), h('button.btn.big.listen-btn', { onclick: () => speak(t.w.no) }, '🔊 Play again')), inp.el, fb);
      setTimeout(() => speak(t.w.no), 200);
    }
  };
  run();
}

function speakStep(el, unit, next) {
  add(el, h('div.card.tip', h('b', '🗣️ Your turn to talk. '), 'Read the situation and type your answer. Don’t aim for perfect – aim to be understood.'));
  const host = h('div');
  add(el, host);
  return mountRoleplay(host, unit, { onDone: () => next(), embedded: true });
}

function doneStep(el, unit, next, go) {
  const gained = completeLesson(unit.id);
  const i = UNITS.indexOf(unit);
  const nextUnit = UNITS[i + 1];
  if (gained) { confetti(); sfx.levelUp(); }
  add(el, h('div.stack.center-col',
    h('div.big-emoji', '🎉'),
    h('h2', `Unit ${i + 1} complete!`),
    gained ? h('div.pill.xp', `+${gained} XP`) : null,
    h('p.lead', `You can now: ${unit.goal.charAt(0).toLowerCase() + unit.goal.slice(1)}`),
    h('div.card.stack',
      h('div.kicker', '⏰ What happens next'),
      h('p', 'Your new words come back in your daily review – in about 10 minutes, tomorrow, and then at growing intervals. Five minutes a day keeps them forever.'),
      h('p', 'Meanwhile, read the short story for this unit – you’ll know almost every word.')),
    nextStepBlock('lesson'),
    h('div.row.wrap.center',
      nextUnit ? h('a.btn', { href: `#/lesson/${nextUnit.id}/intro` }, `Next unit: ${nextUnit.title}`) : h('a.btn', { href: '#/speak' }, 'Practise speaking'),
      h('a.btn', { href: '#/' }, 'Home'))));
  flushCelebrations();
}
