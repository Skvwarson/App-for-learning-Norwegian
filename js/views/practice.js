// Generated drills: numbers and telling the time, infinite, quick, great for flow.

import { h, clear, sfx, haptic, progressBar, confetti, add } from '../ui/dom.js';
import { nextStepBlock, flushCelebrations } from '../ui/celebrate.js';
import { answerInput, speakBtn } from '../ui/components.js';
import { checkAnswer, normalize } from '../core/text.js';
import { speak, stopSpeaking } from '../core/speech.js';
import { addXp, createCombo } from '../core/gamify.js';

const ONES = ['null', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten'];
const TENS = { 20: 'tjue', 30: 'tretti', 40: 'førti', 50: 'femti', 60: 'seksti', 70: 'sytti', 80: 'åtti', 90: 'nitti' };

export function numToNo(n) {
  if (n < 20) return ONES[n];
  if (n < 100) { const t = Math.floor(n / 10) * 10, o = n % 10; return TENS[t] + (o ? ONES[o] : ''); }
  if (n < 1000) { const hh = Math.floor(n / 100), r = n % 100; return (hh === 1 ? 'hundre' : `${ONES[hh]} hundre`) + (r ? ` og ${numToNo(r)}` : ''); }
  if (n === 1000) return 'tusen';
  return String(n);
}

function numAlts(n) {
  const base = numToNo(n);
  const alts = [base.replace(/^hundre/, 'ett hundre'), base.replace(/sju/g, 'syv'), base.replace(/^tjue/, 'tyve')];
  if (n === 1) alts.push('ett');
  return [...new Set(alts)];
}

const HOUR = (x) => (x === 1 ? 'ett' : ONES[x]);
export function timeToNo(h24, m) {
  const hh = ((h24 + 11) % 12) + 1, nx = (hh % 12) + 1;
  return {
    0: HOUR(hh), 5: `fem over ${HOUR(hh)}`, 10: `ti over ${HOUR(hh)}`, 15: `kvart over ${HOUR(hh)}`,
    20: `ti på halv ${HOUR(nx)}`, 25: `fem på halv ${HOUR(nx)}`, 30: `halv ${HOUR(nx)}`, 35: `fem over halv ${HOUR(nx)}`,
    40: `ti over halv ${HOUR(nx)}`, 45: `kvart på ${HOUR(nx)}`, 50: `ti på ${HOUR(nx)}`, 55: `fem på ${HOUR(nx)}`,
  }[m];
}

const squash = (s) => normalize(s).replace(/^(klokka|klokken)\s+(er\s+)?/, '').replace(/\s+/g, '');

export function practiceView(root, { kind }) {
  root.classList.add('focus-view');
  const isTime = kind === 'time';
  const rounds = 10;
  let i = 0, right = 0, level = 0;
  const combo = createCombo();
  const head = h('div.lesson-head', h('a.icon-btn', { href: '#/learn', 'aria-label': 'Back' }, '✕'),
    h('div.lesson-title', h('div.strong', isTime ? 'Hva er klokka?' : 'Tall (numbers)')));
  const body = h('div.lesson-body');
  add(root, head, body);

  const makeTask = () => {
    if (isTime) {
      const hr = Math.floor(Math.random() * 24), mm = [0, 15, 30, 45, 0, 30, 5, 10, 20, 25, 35, 40, 50, 55][Math.floor(Math.random() * (level > 4 ? 14 : 6))];
      const ans = timeToNo(hr, mm);
      const alts = mm === 20 ? [`tjue over ${HOUR(((hr + 11) % 12) + 1)}`] : mm === 40 ? [`tjue på ${HOUR((((hr + 11) % 12) + 1) % 12 + 1)}`] : [];
      return { prompt: `${String(hr).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, ans, alts, mode: 'read' };
    }
    const max = level < 3 ? 20 : level < 6 ? 100 : 1000;
    const n = Math.floor(Math.random() * (max + 1));
    const mode = Math.random() < 0.5 ? 'read' : 'hear';
    return { n, prompt: String(n), ans: numToNo(n), alts: numAlts(n), mode };
  };

  const run = () => {
    clear(body);
    if (i >= rounds) {
      const xp = addXp(20 + right * 3, 'drill');
      if (right >= 9) confetti(70);
      sfx.goal();
      add(body, h('div.stack.center-col', h('div.big-emoji', right >= 9 ? '🏆' : '👍'), h('h2', `${right} / ${rounds}`), h('div.pill.xp', `+${xp} XP`),
        nextStepBlock(),
        h('div.row.wrap.center', h('button.btn', { onclick: () => { i = 0; right = 0; run(); } }, 'Again ▸'), h('a.btn', { href: '#/' }, 'Home'))));
      flushCelebrations();
      return;
    }
    const t = makeTask();
    const fb = h('div.feedback');
    const done = (ok, given) => {
      if (ok) { right++; level++; combo.hit(); sfx.correct(combo.value); haptic(10); addXp(3 * combo.multiplier(), 'drill'); add(fb, h('div.good', `✓ ${t.mode === 'hear' ? t.n : t.ans}`)); }
      else { combo.miss(); level = Math.max(0, level - 2); sfx.wrong(); add(fb, h('div.bad', 'Answer: ', h('b.no', t.mode === 'hear' ? `${t.n} (${t.ans})` : t.ans), ' ', speakBtn(t.ans)), given ? h('div.small.muted', `You wrote: ${given}`) : null); }
      speak(t.ans);
      const c = h('button.btn.primary', { onclick: () => { i++; run(); } }, 'Continue ▸');
      add(body, h('div.row.end', c));
      setTimeout(() => c.focus(), 30);
    };
    let inp;
    if (t.mode === 'hear') {
      inp = answerInput({ placeholder: 'Type the number in digits…', onSubmit: (v) => { inp.setDisabled(true); done(Number(v.trim()) === t.n, v); } });
      inp.input.inputMode = 'numeric';
      add(body, h('div.chunk-head', h('div.small.muted', `${i + 1} / ${rounds}`), progressBar(i / rounds), combo.value >= 3 ? h('div.combo', `🔥 ×${combo.value}`) : null),
        h('div.prompt', h('div.small.muted', 'Listen: which number?'), h('button.btn.big.listen-btn', { onclick: () => speak(t.ans) }, '🔊 Play')), inp.el, fb);
      setTimeout(() => speak(t.ans), 200);
    } else {
      inp = answerInput({
        placeholder: isTime ? 'e.g. halv sju' : 'Write it in Norwegian…',
        expected: t.ans,
        onSubmit: (v, alts) => {
          inp.setDisabled(true);
          const ok = [v, ...(alts || [])].some((x) => [t.ans, ...t.alts].some((a) => squash(x) === squash(a) || checkAnswer(squash(x), squash(a)).verdict === 'correct'));
          done(ok, v);
        },
      });
      add(body, h('div.chunk-head', h('div.small.muted', `${i + 1} / ${rounds}`), progressBar(i / rounds), combo.value >= 3 ? h('div.combo', `🔥 ×${combo.value}`) : null),
        h('div.prompt', h('div.small.muted', isTime ? 'Hva er klokka? Say it the Norwegian way' : 'Say this number in Norwegian'), h('div.prompt-big.digits', t.prompt)),
        inp.el, fb);
    }
  };
  run();
  return () => stopSpeaking();
}
