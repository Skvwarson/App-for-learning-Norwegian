// App bootstrap: routes, top bar (streak · profile), three tabs, celebrations.

import { load, subscribe, settings, getState } from './core/store.js';
import { route, start, navigate, current } from './ui/router.js';
import { h, $, clear, toast, confetti, sfx, modal, haptic, add } from './ui/dom.js';
import { icon } from './ui/icons.js';
import * as G from './core/gamify.js';
import { homeView } from './views/home.js';
import { learnView } from './views/learn.js';
import { lessonView } from './views/lesson.js';
import { reviewView } from './views/review.js';
import { readHub, storyView } from './views/read.js';
import { speakView } from './views/speak.js';
import { roleplayView } from './views/roleplay.js';
import { practiceView } from './views/practice.js';
import { wordsView } from './views/words.js';
import { progressView, meView } from './views/progress.js';
import { friendsView } from './views/friends.js';
import { settingsView } from './views/settings.js';
import { maybeOnboard } from './views/onboarding.js';
import { onVoiceProblem, deviceTip } from './core/speech.js';
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
route('/learn', learnView);
route('/lesson/:unitId/:step', lessonView);
route('/lesson/:unitId', lessonView);
route('/review', reviewView);
route('/review/:mode', reviewView);
route('/read', readHub);
route('/read/story/:id', storyView);
route('/speak', speakView);
route('/roleplay/:unitId', roleplayView);
route('/practice/:kind', practiceView);
route('/words', wordsView);
route('/progress', progressView);
route('/friends', friendsView);
route('/me', meView);
route('/settings', settingsView);

// ---------- Chrome ----------
const TABS = [
  ['/', 'home', 'Today', (p) => p === '/' || p.startsWith('/review')],
  ['/learn', 'course', 'Course', (p) => /^\/(learn|lesson|read|speak|roleplay|practice)/.test(p)],
  ['/friends', 'race', 'Race', (p) => p.startsWith('/friends')],
];

function renderChrome() {
  const top = $('#topbar'), tabs = $('#tabbar');
  const st = G.streak();
  const name = getState().settings.name || '';
  const path = current();
  add(clear(top),
    h('a.brand', { href: '#/' }, h('span.flag', { 'aria-hidden': 'true' }), h('span', 'Norsk ', h('b', 'Nå'))),
    h('div.top-right',
      h('a.chip-streak', { href: '#/me', title: `${st}-day streak`, class: st ? 'on' : '' }, icon('flame', 18), h('b', String(st))),
      h('a.avatar-btn', { href: '#/me', 'aria-label': 'Profile', class: /^\/(me|progress|words|settings)/.test(path) ? 'active' : '' },
        name ? h('span', name.charAt(0).toUpperCase()) : icon('user', 18))));
  add(clear(tabs), ...TABS.map(([p, ic, label, isActive]) => h('a.tab', { href: `#${p}`, class: isActive(path) ? 'active' : '' },
    icon(ic, 24, 'tab-icon'), h('span.tab-label', label))));
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
G.on('streak', (data) => queueCelebration('streak', data));
G.on('comeback', ({ days }) => {
  setTimeout(() => {
    const m = modal(h('div.stack.center-col',
      h('div.big-emoji', '🌈'),
      h('h2', 'Velkommen tilbake!'),
      h('p', `It’s been ${days} days – that’s fine. Coming back is what matters.`),
      h('button.btn.primary.big', { onclick: () => m.close() }, 'Let’s go')));
    G.unlock('comeback');
  }, 600);
});

// ---------- Voice problems ----------
let voiceWarned = false;
onVoiceProblem(() => {
  if (voiceWarned) return;
  voiceWarned = true;
  toast(h('span', h('b', 'No Norwegian voice on this device.'), h('br'), deviceTip()), { icon: '🔇', kind: 'warn', ms: 8000 });
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
