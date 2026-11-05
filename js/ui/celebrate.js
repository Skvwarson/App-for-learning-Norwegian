// Big moments: the daily streak and a completed day. Shown at the *end* of a
// session (peak-end rule) – never in the middle of an exercise.

import { h, add, confetti, sfx, haptic, toast } from './dom.js';
import { nextStep } from '../core/today.js';
import { getGame } from '../core/gamify.js';
import { update, dayKey } from '../core/store.js';

const pending = [];
const inFocus = () => document.body.classList.contains('focus');

export function queueCelebration(kind, data) {
  pending.push({ kind, data });
  if (!inFocus()) flushCelebrations();
}

/** Show anything that was held back during a session. Call from finish screens. */
export function flushCelebrations() {
  while (pending.length) {
    const { kind, data } = pending.shift();
    if (kind === 'streak') streakPop(data);
  }
}

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function streakPop({ streak, week }) {
  let timer = null;
  const close = () => { clearTimeout(timer); el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  const el = h('div.streak-pop', { role: 'status', onclick: (e) => { if (e.target === el) close(); } },
    h('div.streak-pop-card',
      h('div.streak-flame', { 'aria-hidden': 'true' }, '🔥'),
      h('div.streak-num', String(streak)),
      h('div.streak-label', streak === 1 ? 'day streak – day one!' : 'day streak!'),
      h('div.week.pop-week', ...week.map((d, i) => h('div.day', { class: `${d.xp >= 10 ? 'on' : d.frozen ? 'frozen' : ''} ${i === week.length - 1 ? 'today' : ''}` },
        h('span', DAY_NAMES[new Date(d.k + 'T12:00').getDay()])))),
      h('p.small.muted', streak === 1 ? 'Come back tomorrow to make it two.' : 'Come back tomorrow to keep the fire going.'),
      h('button.btn.primary', { type: 'button', onclick: close }, 'Fortsett ▸')));
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  sfx.goal(); haptic([20, 40, 20]); confetti(90);
  timer = setTimeout(close, 5000);
}

/**
 * "What's next?" for finish screens: a big button to the next unfinished part of
 * today's plan – or, when everything is done, a small celebration (once a day).
 */
export function nextStepBlock(except = null) {
  const n = nextStep(except);
  if (n) {
    return h('a.btn.primary.big.cta.next-step', { href: n.href },
      h('span', `Next: ${n.cta} ▸`), h('span.cta-sub', n.sub));
  }
  const today = dayKey();
  if (getGame().dayDone !== today) {
    update(() => { getGame().dayDone = today; });
    setTimeout(() => {
      confetti(140); sfx.levelUp(); haptic([20, 40, 20, 40, 60]);
      toast(h('span', h('b', 'Dagens plan er fullført! 🎉'), h('br'), h('span.small', 'Everything for today is done. Extra practice is a bonus.')), { icon: '🏁', kind: 'gold', ms: 4500 });
    }, 300);
  }
  return add(h('div.card.day-done.stack.center-col'),
    h('div.big-emoji', '🏁'),
    h('div.strong', 'Today’s plan is complete!'),
    h('p.small.muted', 'Your reviews will be ready again tomorrow. Anything more today is a bonus – read, chat, or learn ahead.'),
    h('div.row.wrap.center', h('a.btn', { href: '#/read' }, '📖 Read more'), h('a.btn', { href: '#/' }, 'Home')));
}
