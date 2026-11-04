// Review session in "focus mode": one card at a time, instant feedback,
// combo + XP, and a flow controller that keeps you near ~85 % success by
// easing or stretching the exercise type.

import { h, clear, sfx, haptic, floatXp, confetti, progressBar, toast, add } from '../ui/dom.js';
import { tappable, speakBtn, answerInput, tilesWidget, ratingBar, diffView, genderTag, posHint } from '../ui/components.js';
import { buildQueue, getCard, rateCard, markSeen, chooseExercise, deckStats, forecast, knowledgeMap } from '../core/deck.js';
import { checkAnswer, makeCloze, shuffle, words as wordsOf } from '../core/text.js';
import { speak, canSpeakNorwegian, stopSpeaking } from '../core/speech.js';
import { addXp, createCombo, maybeBonus, reviewXp, unlock, checkWordAchievements, todayXp, dailyGoal } from '../core/gamify.js';
import { State, Rating } from '../core/fsrs.js';
import { settings, bump } from '../core/store.js';
import { PRAISE, ENCOURAGE } from '../../data/habits.js';
import { navigate } from '../ui/router.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function reviewView(root, params = {}) {
  root.classList.add('focus-view', 'session');
  const quick = params.mode === 'quick';
  const q = buildQueue();
  const reviewIds = q.reviews.map((c) => c.id);
  const freshIds = q.fresh.map((c) => c.id);
  const learningNow = q.learning.filter((c) => c.srs.due <= Date.now() + 20 * 60_000).length;
  const available = reviewIds.length + freshIds.length + learningNow;
  const target = quick ? Math.min(5, Math.max(available, 1)) : Math.min(Math.max(available, 1), 40);

  const combo = createCombo();
  const recent = []; // flow window of last answers (true/false)
  const doneIds = new Set();
  let seen = 0, correct = 0, firstMisses = 0, xpEarned = 0;
  const startedAt = Date.now();
  let cleanupKeys = null, autoTimer = null, lastId = null;

  const head = h('div.session-head');
  const stage = h('div.session-stage');
  add(root, head, stage);

  const flowBias = () => {
    const w = recent.slice(-8);
    if (w.length < 4) return 0;
    const acc = w.filter(Boolean).length / w.length;
    return acc < 0.7 ? -1 : acc > 0.92 && w.length >= 6 ? 1 : 0;
  };

  const renderHead = () => {
    const bias = flowBias();
    const zone = recent.length >= 4 ? (bias === 0 ? '🎯 In the zone' : bias < 0 ? '🌱 Easing off' : '🚀 Stretching') : '';
    add(clear(head), 
      h('a.icon-btn', { href: '#/', 'aria-label': 'End session', onclick: () => { if (seen) logTime(); } }, '✕'),
      h('div.session-progress', progressBar(seen / target)),
      combo.value >= 2 ? h('div.combo', { class: combo.value >= 10 ? 'hot' : '' }, `🔥 ×${combo.value}`) : null,
      h('div.session-xp', `${xpEarned} XP`),
      zone ? h('div.zone.small', { title: 'The app adjusts difficulty so you succeed about 85 % of the time – the sweet spot for learning and flow.' }, zone) : null,
    );
  };

  const logTime = () => bump('ms', Date.now() - startedAt);

  function nextCard() {
    const now = Date.now();
    const all = buildQueue(now);
    const dueLearning = all.learning.find((c) => c.srs.due <= now && !(doneIds.has(c.id) && c.srs.due > now));
    if (dueLearning) return { card: dueLearning, intro: false };
    while (reviewIds.length) {
      const id = reviewIds.shift();
      const c = getCard(id);
      if (c && c.srs.state === State.Review && !doneIds.has(id)) return { card: c, intro: false };
    }
    while (freshIds.length) {
      const c = getCard(freshIds.shift());
      if (c && c.srs.state === State.New && !c.seen) return { card: c, intro: true };
    }
    // Learn ahead a little at the end – but never re-show a card seconds after you saw it.
    const ahead = all.learning.find((c) => c.srs.due <= now + 20 * 60_000 && c.id !== lastId && now - c.srs.last >= 90_000);
    if (ahead) return { card: ahead, intro: false };
    return null;
  }

  function adjust(type, card) {
    const bias = flowBias();
    const hasCloze = card.ex?.no && makeCloze(card.ex.no, card.no.split('|')[0]);
    if (bias < 0) {
      if (type === 'produce') return hasCloze ? 'cloze' : 'recognize';
      if (type === 'listen') return 'recognize';
    }
    if (bias > 0 && type === 'recognize' && card.srs.state === State.Review) return hasCloze && Math.random() < 0.5 ? 'cloze' : 'produce';
    return type;
  }

  function show() {
    cleanupKeys?.(); cleanupKeys = null; clearTimeout(autoTimer);
    renderHead();
    clear(stage);
    if (seen >= target) return finish();
    const nxt = nextCard();
    if (!nxt) return finish();
    const { card, intro } = nxt;
    lastId = card.id;
    if (intro) return showIntro(card);
    const ttsOk = canSpeakNorwegian();
    const type = adjust(chooseExercise(card, { ttsOk }), card);
    const t0 = Date.now();
    const ex = { recognize, produce, cloze, listen: listenEx, tiles }[type] ?? recognize;
    ex(card, (result) => answered(card, { ...result, ms: Date.now() - t0, type }));
  }

  // ---- New card introduction (encoding before retrieval) ----
  function showIntro(card) {
    add(stage, h('div.card-face.stack',
      h('div.tag.new', '✨ New word'),
      h('div.face-no.no', card.no, ' ', genderTag(card.g)),
      h('div.face-en', card.en || h('span.muted', '(no meaning saved – edit it in Words)')),
      card.note ? h('div.small.muted', card.note) : null,
      card.ex?.no ? h('div.face-ex', h('div.no', tappable(card.ex.no, { mark: false })), card.ex.en ? h('div.small.muted', card.ex.en) : null) : null,
      h('div.row.center', speakBtn(card.no)),
      h('p.small.muted', 'Say it out loud once. It’ll come back in a minute for you to recall.'),
      h('button.btn.primary.big', { onclick: go }, 'Got it ▸')));
    if (settings().autoplay) speak(card.no);
    function go() { markSeen(card.id); doneIds.add(card.id); show(); }
    keys({ Enter: go, ' ': go });
  }

  // ---- Exercise types ----
  function recognize(card, done) {
    const answer = h('div.reveal.hidden',
      h('div.face-en', card.en),
      card.note ? h('div.small.muted', card.note) : null,
      card.ex?.en ? h('div.small.muted', card.ex.en) : null);
    const showBtn = h('button.btn.primary.big', { onclick: reveal }, 'Show answer');
    add(stage, h('div.card-face.stack',
      h('div.small.muted', 'What does this mean? Answer in your head first.'),
      h('div.face-no.no', card.no, ' ', speakBtn(card.no)),
      card.ex?.no ? h('div.face-ex.no', tappable(card.ex.no, { mark: false })) : null,
      answer, showBtn));
    if (settings().autoplay) speak(card.no);
    keys({ ' ': reveal, Enter: reveal });
    function reveal() {
      answer.classList.remove('hidden'); showBtn.remove();
      done({ verdict: 'self' });
    }
  }

  function produce(card, done) {
    let hints = 0;
    const target = card.no.split('|')[0].replace(/\s*…\s*/g, ' … ').trim();
    const hintEl = h('div.hint');
    const inp = answerInput({
      onSubmit: (v, alts) => {
        const cands = [v, ...(alts || [])];
        const results = cands.map((x) => ({ x, r: checkAnswer(x, card.no, card.alt) }));
        const best = results.find((r) => r.r.verdict === 'correct') ?? results.find((r) => r.r.verdict === 'almost') ?? results[0];
        inp.setDisabled(true);
        done({ verdict: best.r.verdict, given: best.x, expected: target, note: best.r.note, hinted: hints > 0 });
      },
    });
    const autoHint = flowBias() < 0;
    const giveHint = () => { hints++; const n = Math.min(target.length, hints * 2); hintEl.textContent = '💡 ' + target.slice(0, n) + (n < target.length ? '…' : ''); };
    add(stage, h('div.card-face.stack',
      h('div.small.muted', 'Say it in Norwegian'),
      h('div.face-en', card.en),
      posHint(card) ? h('div.small.muted', posHint(card)) : null,
      inp.el,
      h('div.row', h('button.btn.ghost.small', { onclick: giveHint }, '💡 Hint')), hintEl));
    if (autoHint) giveHint();
  }

  function cloze(card, done) {
    const cz = makeCloze(card.ex.no, card.no.split('|')[0]);
    if (!cz) return produce(card, done);
    const inp = answerInput({
      onSubmit: (v, alts) => {
        let r = checkAnswer(v, cz.answer);
        let given = v;
        for (const a of alts || []) { const ra = checkAnswer(a, cz.answer); if (ra.verdict === 'correct') { r = ra; given = a; break; } }
        if (r.verdict === 'wrong' && checkAnswer(given, card.no, card.alt).verdict === 'correct') {
          r = { verdict: 'almost', note: `Right word! In this sentence it takes the form “${cz.answer}”.` };
        }
        inp.setDisabled(true);
        done({ verdict: r.verdict, given, expected: cz.answer, note: r.note, sentence: card.ex.no });
      },
    });
    add(stage, h('div.card-face.stack',
      h('div.small.muted', 'Fill the gap'),
      h('div.cloze.no', cz.before, h('span.gap', '_____'), cz.after),
      card.ex.en ? h('div.small.muted', card.ex.en) : null,
      h('div.small', h('span.muted', 'Hint: '), card.en),
      inp.el));
  }

  function listenEx(card, done) {
    const target = card.no.split('|')[0];
    const inp = answerInput({
      placeholder: 'Type what you hear…',
      onSubmit: (v) => { inp.setDisabled(true); const r = checkAnswer(v, card.no, card.alt); done({ verdict: r.verdict, given: v, expected: target, note: r.note }); },
    });
    add(stage, h('div.card-face.stack',
      h('div.small.muted', 'Listen and type'),
      h('div.row.center',
        h('button.btn.big.listen-btn', { onclick: () => speak(target) }, '🔊 Play'),
        h('button.btn.ghost', { onclick: () => speak(target, { rate: 0.6 }) }, '🐢 Slow')),
      inp.el));
    setTimeout(() => speak(target), 250);
  }

  function tiles(card, done) {
    const target = card.no.split('|')[0].replace(/[.!?…]+$/, '').trim();
    const parts = target.split(/\s+/);
    if (parts.length < 3) return produce(card, done);
    const tw = tilesWidget(parts, { shuffleFn: shuffle, onCheck: (v) => { tw.disable(); const r = checkAnswer(v, target); done({ verdict: r.verdict, given: v, expected: card.no }); } });
    add(stage, h('div.card-face.stack', h('div.small.muted', 'Build it in Norwegian'), h('div.face-en', card.en), tw.el));
  }

  // ---- After an answer ----
  function answered(card, res) {
    const fb = h('div.feedback');
    let suggested = 0;
    if (res.verdict !== 'self') {
      if (res.verdict === 'correct') {
        suggested = res.hinted ? Rating.Hard : Rating.Good;
        sfx.correct(combo.value + 1); haptic(10);
        add(fb, h('div.good.big', `✓ ${pick(PRAISE)}`), res.expected && res.given && res.given.trim() !== res.expected ? h('div.no', res.expected) : null);
      } else if (res.verdict === 'almost') {
        suggested = Rating.Hard; sfx.almost(); haptic([10, 20, 10]);
        add(fb, h('div.almost', `≈ ${res.note || 'Almost!'}`), h('div', 'Correct: ', diffView(res.given, res.expected)));
      } else {
        suggested = Rating.Again; sfx.wrong(); haptic([30, 30, 30]);
        add(fb, h('div.bad', pick(ENCOURAGE)), h('div', 'Answer: ', h('b.no', res.expected), ' ', speakBtn(res.expected)),
          res.given ? h('div.small.muted', `You wrote: ${res.given}`) : null);
      }
      add(fb, h('div.small.muted', card.en), card.ex?.no && res.type !== 'cloze' ? h('div.small.no', card.ex.no) : null);
      speak(res.expected);
    }
    const rate = (g) => {
      clearTimeout(autoTimer); cleanupKeys?.(); cleanupKeys = null;
      const wasFirstSee = !doneIds.has(card.id);
      rateCard(card.id, g, { verdict: res.verdict, ms: res.ms });
      doneIds.add(card.id);
      seen++;
      const ok = g >= Rating.Hard;
      recent.push(ok);
      if (ok) { correct++; combo.hit(); } else { combo.miss(); if (wasFirstSee) firstMisses++; }
      if (res.verdict === 'self') ok ? sfx.correct(combo.value) : sfx.wrong();
      let xp = reviewXp(g, combo);
      const bonus = ok ? maybeBonus() : 0;
      xpEarned += addXp(xp, 'review');
      floatXp(Math.round(xp), stage.querySelector('.rate.r' + g) ?? head);
      if (bonus) {
        xpEarned += addXp(bonus, 'bonus');
        sfx.bonus();
        toast(h('span', h('b', `🎁 Surprise bonus! +${bonus} XP`)), { kind: 'gold', ms: 1800 });
      }
      show();
    };
    const bar = ratingBar(card, { suggested, onRate: rate });
    add(stage, fb, h('div.rate-help.small.muted', res.verdict === 'self' ? 'How well did you remember?' : 'Enter = accept the highlighted choice'), bar);
    const map = { 1: () => rate(1), 2: () => rate(2), 3: () => rate(3), 4: () => rate(4) };
    if (suggested) map.Enter = () => rate(suggested);
    // Flow: correct typed answers move on by themselves.
    if (settings().autoAdvance && res.verdict === 'correct' && suggested === Rating.Good) {
      const timerBar = h('div.auto-bar');
      add(stage, timerBar);
      requestAnimationFrame(() => timerBar.classList.add('run'));
      autoTimer = setTimeout(() => rate(Rating.Good), 1400);
      bar.addEventListener('pointerenter', () => { clearTimeout(autoTimer); timerBar.remove(); }, { once: true });
    }
    setTimeout(() => keys(map), 60);
    stage.scrollIntoView({ block: 'start' });
  }

  function keys(map) {
    cleanupKeys?.();
    const fn = (e) => {
      if (e.target.tagName === 'INPUT' && e.key !== 'Enter') return;
      if (e.target.tagName === 'INPUT' && !e.target.disabled) return;
      const f = map[e.key];
      if (f) { e.preventDefault(); f(); }
    };
    document.addEventListener('keydown', fn);
    cleanupKeys = () => document.removeEventListener('keydown', fn);
  }

  function finish() {
    cleanupKeys?.(); clearTimeout(autoTimer);
    renderHead();
    clear(stage);
    if (!seen) {
      const fresh = buildQueue();
      add(stage, h('div.stack.center-col',
        h('div.big-emoji', '🌿'),
        h('h2', 'All caught up!'),
        h('p', fresh.learning.length ? 'Some cards are waiting a few minutes to be spaced out – come back soon.' : 'No reviews due right now. That’s spacing working for you.'),
        h('div.row.wrap.center',
          h('a.btn.primary', { href: '#/learn' }, '📚 Learn new words'),
          h('a.btn', { href: '#/read' }, '📖 Read'),
          h('a.btn', { href: '#/speak' }, '🗣️ Speak'))));
      return;
    }
    logTime();
    const acc = seen ? correct / seen : 0;
    unlock('first-session');
    if (seen >= 10 && firstMisses === 0) unlock('perfect');
    const known = [...knowledgeMap().values()].filter((v) => v === 'known').length;
    checkWordAchievements(known);
    const left = buildQueue();
    const remaining = left.reviews.length + left.fresh.length + left.learning.filter((c) => c.srs.due <= Date.now()).length;
    const mins = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    const goalPct = Math.min(1, todayXp() / dailyGoal());
    if (acc >= 0.9 && seen >= 5) confetti(70);
    sfx.goal();
    const fc = forecast(2)[1];
    add(stage, h('div.stack.center-col.summary',
      h('div.big-emoji', acc >= 0.9 ? '🏆' : acc >= 0.7 ? '🔥' : '💪'),
      h('h2', acc >= 0.9 ? 'Strålende!' : acc >= 0.7 ? 'Bra jobba!' : 'Godt jobba – that was real effort!'),
      h('div.stat-row',
        h('div.stat', h('div.stat-n', String(seen)), h('div.stat-l', 'cards')),
        h('div.stat', h('div.stat-n', `${Math.round(acc * 100)}%`), h('div.stat-l', 'recalled')),
        h('div.stat', h('div.stat-n', `+${xpEarned}`), h('div.stat-l', 'XP')),
        h('div.stat', h('div.stat-n', `×${combo.best}`), h('div.stat-l', 'best combo')),
        h('div.stat', h('div.stat-n', `${mins}m`), h('div.stat-l', 'time'))),
      h('div.card.stack.tight', h('div.small.muted', `Daily goal: ${todayXp()} / ${dailyGoal()} XP`), progressBar(goalPct, 'gold')),
      h('p.small.muted', `Every card you just recalled is now scheduled further out. Tomorrow: ~${fc} reviews.`),
      h('div.row.wrap.center',
        remaining ? h('button.btn.primary', { onclick: () => navigate('#/review') }, `Keep going (${remaining} more) ▸`) : null,
        h('a.btn', { href: '#/read' }, '📖 Read a story'),
        h('a.btn', { href: '#/' }, 'Home'))));
  }

  show();
  return () => { cleanupKeys?.(); clearTimeout(autoTimer); stopSpeaking(); };
}

export function deckSummary() { return deckStats(); }
