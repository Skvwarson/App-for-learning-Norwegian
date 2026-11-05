// App bootstrap: routes, top bar (streak · XP · goal), tab bar, celebrations.

import { load, subscribe, settings, getState } from './core/store.js';
import { route, start, navigate, current } from './ui/router.js';
import { h, $, clear, toast, confetti, sfx, modal, ring, haptic, add } from './ui/dom.js';
import * as G from './core/gamify.js';
import { cardsReadyNow } from './core/today.js';
import { homeView } from './views/home.js';
import { learnView } from './views/learn.js';
import { lessonView } from './views/lesson.js';
import { reviewView } from './views/review.js';
import { readHub, storyView, docView } from './views/read.js';
import { importView } from './views/import.js';
import { speakView, chatView } from './views/speak.js';
import { roleplayView } from './views/roleplay.js';
import { practiceView } from './views/practice.js';
import { wordsView } from './views/words.js';
import { progressView } from './views/progress.js';
import { scienceView } from './views/science.js';
import { settingsView } from './views/settings.js';
import { maybeOnboard } from './views/onboarding.js';
import { onVoiceProblem } from './core/speech.js';
import { queueCelebration, flushCelebrations } from './ui/celebrate.js';

load();
G.reconcileStreak();

function applyTheme() {
  const t = settings().theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
applyTheme();

route('/', homeView);
// "Next: today's mission" lands on Home with the mission card in view.
route('/mission', (root) => {
  const cleanup = homeView(root);
  setTimeout(() => {
    const card = document.getElementById('mission');
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card?.classList.add('spotlight');
  }, 350);
  return cleanup;
});
route('/learn', learnView);
route('/lesson/:unitId/:step', lessonView);
route('/lesson/:unitId', lessonView);
route('/review', reviewView);
route('/review/:mode', reviewView);
route('/read', readHub);
route('/read/story/:id', storyView);
route('/read/doc/:id/:page', docView);
route('/import', importView);
route('/speak', speakView);
route('/chat', chatView);
route('/roleplay/:unitId', roleplayView);
route('/practice/:kind', practiceView);
route('/words', wordsView);
route('/progress', progressView);
route('/science', scienceView);
route('/settings', settingsView);

// ---------- Chrome ----------
const TABS = [
  ['/', '🏠', 'Hjem'],
  ['/learn', '📚', 'Lær'],
  ['/review', '🔁', 'Repeter'],
  ['/read', '📖', 'Les'],
  ['/speak', '🗣️', 'Snakk'],
];

function renderChrome() {
  const top = $('#topbar'), tabs = $('#tabbar');
  const st = G.streak();
  const lv = G.levelInfo();
  const xpToday = G.todayXp(), goal = G.dailyGoal();
  const ready = cardsReadyNow();
  add(clear(top), 
    h('a.brand', { href: '#/' }, h('span.flag', { 'aria-hidden': 'true' }), h('span', 'Norsk ', h('b', 'Nå'))),
    h('div.top-right',
      h('a.chip-streak', { href: '#/progress', title: `${st}-day streak`, class: st ? 'on' : '' }, '🔥', h('b', String(st))),
      h('a.xp-chip', { href: '#/progress', title: `Level ${lv.level} · ${xpToday}/${goal} XP today` },
        ring(xpToday / goal, { size: 30, stroke: 4, label: String(lv.level), cls: xpToday >= goal ? 'complete' : '' }),
        h('span.xp-num', `${lv.xp} XP`)),
      h('details.menu',
        h('summary.icon-btn', { 'aria-label': 'Menu' }, '☰'),
        h('div.menu-list',
          h('a', { href: '#/progress' }, '📈 Progress & achievements'),
          h('a', { href: '#/words' }, '📇 My words'),
          h('a', { href: '#/import' }, '📄 Import textbook'),
          h('a', { href: '#/practice/numbers' }, '🔢 Number drill'),
          h('a', { href: '#/practice/time' }, '🕒 Time drill'),
          h('a', { href: '#/science' }, '🧠 How it works'),
          h('a', { href: '#/settings' }, '⚙️ Settings')))));
  const path = current();
  add(clear(tabs), ...TABS.map(([p, icon, label]) => h('a.tab', {
    href: `#${p}`,
    class: (p === '/' ? path === '/' || path === '/mission' : path.startsWith(p)) ? 'active' : '',
  }, h('span.tab-icon', icon), h('span.tab-label', label),
  p === '/review' && ready ? h('span.badge', String(ready > 99 ? '99+' : ready)) : null)));
  top.querySelector('details.menu')?.addEventListener('click', (e) => { if (e.target.tagName === 'A') e.currentTarget.open = false; });
}

let chromeTimer = null;
subscribe(() => { clearTimeout(chromeTimer); chromeTimer = setTimeout(renderChrome, 120); });

// ---------- Celebrations ----------
// Level-ups celebrate without blocking – never break someone's flow mid-exercise.
G.on('levelup', (lv) => {
  sfx.levelUp(); haptic([20, 40, 20, 40, 60]); confetti(160);
  toast(h('span.levelup-toast', h('span.small', 'Nytt nivå!'), h('b', ` Level ${lv.level} · ${lv.title}`), h('br'), h('span.small', lv.titleEn)),
    { icon: '⬆️', kind: 'gold', ms: 4200 });
});
G.on('achievement', (a) => { sfx.bonus(); toast(h('span', h('b', `${a.title}`), h('br'), h('span.small', a.desc)), { icon: a.icon, kind: 'gold', ms: 3800 }); });
G.on('streak', (data) => queueCelebration('streak', data));
G.on('goal', () => { sfx.goal(); confetti(120); toast(h('span', h('b', 'Daily goal reached! 🎯'), h('br'), h('span.small', 'Everything from here is a bonus.')), { icon: '🏁', kind: 'gold', ms: 4000 }); });
G.on('freeze', ({ freezes }) => toast(`7 days in a row! You earned a streak freeze ❄️ (${freezes} in the bank).`, { icon: '❄️', ms: 4500 }));
G.on('comeback', ({ days }) => {
  setTimeout(() => {
    const m = modal(h('div.stack.center-col',
      h('div.big-emoji', '🌈'),
      h('h2', 'Velkommen tilbake!'),
      h('p', `It’s been ${days} days – and that’s completely fine. Coming back is what matters. Your memory model already knows which words need a refresh.`),
      h('p.small.muted', 'Tip: start with “Just 2 minutes”. Momentum does the rest.'),
      h('div.row.wrap.center', h('a.btn.primary', { href: '#/review/quick', onclick: () => m.close() }, '⚡ 2-minute restart'), h('button.btn', { onclick: () => m.close() }, 'Close'))));
    G.unlock('comeback');
  }, 600);
});

// ---------- Voice problems ----------
const voiceWarned = new Set();
onVoiceProblem(({ kind, message }) => {
  const key = kind === 'cloud' ? `cloud:${message}` : kind;
  if (voiceWarned.has(key)) return;
  voiceWarned.add(key);
  const fix = h('a', { href: '#/settings', style: { color: 'inherit', fontWeight: '700', textDecoration: 'underline' } }, 'Fix it in Settings → Voice');
  if (kind === 'no-voice') {
    toast(h('span', h('b', 'No Norwegian voice on this device.'), h('br'), 'Audio is muted so you don’t learn wrong pronunciation. ', fix), { icon: '🔇', kind: 'warn', ms: 7000 });
  } else {
    toast(h('span', h('b', 'Premium voice failed: '), message, h('br'), fix), { icon: '🔇', kind: 'warn', ms: 8000 });
  }
});

// ---------- Start ----------
start($('#view'), {
  changed: () => {
    const focus = $('#view').classList.contains('focus-view');
    document.body.classList.toggle('focus', focus);
    if (!focus) flushCelebrations();
    renderChrome();
  },
});
setTimeout(maybeOnboard, 300);

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.hostname.match(/^(localhost|127\.)/)) {
  // When an update is installed, switch to it right away – but never in the middle of a lesson or review.
  const hadController = !!navigator.serviceWorker.controller;
  let pendingReload = false;
  const reloadWhenIdle = () => {
    if (!document.body.classList.contains('focus')) location.reload();
    else if (!pendingReload) { pendingReload = true; addEventListener('hashchange', reloadWhenIdle); }
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) reloadWhenIdle(); });
  navigator.serviceWorker.register('./sw.js').then((reg) => reg.update()).catch(() => { /* offline support is optional */ });
}

// Ask the browser to keep our data (prevents eviction on some platforms).
navigator.storage?.persist?.().catch(() => {});

export { navigate, getState };
