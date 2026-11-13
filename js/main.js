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
  renderTabs(tabs, path);
  requestAnimationFrame(() => document.documentElement.style.setProperty('--topbar-h', `${top.offsetHeight}px`));
}

// The tabs are chambers of a revolver cylinder, seen from behind: three slots on
// a tilted ring. The current page is the chamber at the top (in the middle,
// raised). Tapping a side tab turns the cylinder one step: that tab rolls to
// the top, and the one on the far side rolls round underneath and comes back up
// on the other side.
let centerTab = 0;
let tabEls = null;
let spin = 0;          // cylinder rotation in steps (keeps counting, so turns always go the short way)
let shown = 0;         // the rotation currently drawn (animates towards `spin`)
let spinFrame = 0;
const STEP = 360 / TABS.length;
function placeTabs(rot) {
  const wide = Math.min(innerWidth, 440);
  const rx = (wide / 3) / Math.sin((STEP * Math.PI) / 180); // side tabs land a third of the bar from the middle
  tabEls.forEach((el, i) => {
    const a = ((i - rot) * STEP * Math.PI) / 180;         // 0 = top of the cylinder
    const depth = Math.cos(a);                            // 1 front/top … −1 underneath
    // Middle chamber raised; side ones centred in the bar (not resting on its bottom edge).
    const x = rx * Math.sin(a), y = 0.5 - 12.5 * (depth + 0.5) / 1.5;
    // Side slots (depth −0.5) are fully visible; only the chamber passing underneath shrinks and fades.
    const under = Math.max(0, Math.min(1, (depth + 1) / 0.5));
    el.style.transform = `translate(calc(-50% + ${x.toFixed(1)}px), ${y.toFixed(1)}px) scale(${(0.55 + 0.45 * under).toFixed(3)})`;
    el.style.opacity = under.toFixed(2);
    el.style.zIndex = String(Math.round((depth + 1) * 10));
  });
}
function turnTo(target) {
  cancelAnimationFrame(spinFrame);
  const from = shown, t0 = performance.now(), ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 520;
  const ease = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2; // ease-out with a small click into place
  const frame = (now) => {
    const t = ms ? Math.min(1, (now - t0) / ms) : 1;
    shown = from + (target - from) * ease(t);
    placeTabs(shown);
    if (t < 1) spinFrame = requestAnimationFrame(frame); else shown = target;
  };
  spinFrame = requestAnimationFrame(frame);
}
// Pages outside the three tabs: the middle slot shows them; hovering it reveals the tab
// you came from, and tapping goes back there.
const AWAY = [
  [/^\/settings/, 'settings', 'Settings'],
  [/^\/progress/, 'chart', 'Progress'],
  [/^\/words/, 'words', 'My words'],
  [/^\/me/, 'user', 'Me'],
];
let ctxEl = null;
function renderTabs(bar, path) {
  const hit = TABS.findIndex(([, , , isActive]) => isActive(path));
  const n = TABS.length;
  if (!tabEls) {
    tabEls = TABS.map(([p, ic, label]) => h('a.tab', { href: `#${p}`, 'aria-label': label },
      h('span.tab-bubble', icon(ic, 24, 'tab-icon')), h('span.tab-label', label)));
    ctxEl = h('div.tab.center.tab-ctx', { 'aria-hidden': 'true' });
    add(clear(bar), h('div.tab-track', ...tabEls, ctxEl));
    if (hit >= 0) centerTab = hit;
    spin = shown = centerTab;
    placeTabs(shown);
    addEventListener('resize', () => placeTabs(shown));
  } else if (hit >= 0 && hit !== centerTab) {
    // Turn one step the short way round (right tab → turn right, left tab → turn left).
    const diff = ((hit - centerTab + n) % n);
    spin += diff === 1 ? 1 : diff === n - 1 ? -1 : diff;
    centerTab = hit;
    sfx.spin();
    turnTo(spin);
  }
  const away = hit < 0 && AWAY.find(([re]) => re.test(path));
  bar.classList.toggle('away', !!away);
  if (away) {
    const [, ic, label] = away;
    add(clear(ctxEl), h('span.tab-bubble', icon(ic, 24, 'tab-icon')), h('span.tab-label', label));
    tabEls[centerTab].setAttribute('aria-label', `Back to ${TABS[centerTab][2]}`);
  } else tabEls[centerTab].setAttribute('aria-label', TABS[centerTab][2]);
  tabEls.forEach((el, i) => {
    const isCenter = i === centerTab;
    el.classList.toggle('active', isCenter && hit >= 0);
    el.classList.toggle('center', isCenter);
    if (isCenter) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
}

// The top bar is see-through over the background glow, and solid once the page scrolls under it.
const markScrolled = () => $('#topbar')?.classList.toggle('scrolled', scrollY > 4);
addEventListener('scroll', markScrolled, { passive: true });
addEventListener('hashchange', () => requestAnimationFrame(markScrolled));

// A soft click for everything you press. Answers keep their own right/wrong sounds,
// and the bottom menu has its own revolver sound.
const PRESSABLE = 'button, a[href], [role="button"], summary, label.toggle-row, .tile';
const QUIET = '.tab, .answer-row .btn.primary, .choice, [data-quiet]';
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest?.(PRESSABLE);
  if (!el || el.closest(QUIET) || el.disabled) return;
  sfx.press();
}, { capture: true, passive: true });

let chromeTimer = null;
subscribe(() => { clearTimeout(chromeTimer); chromeTimer = setTimeout(renderChrome, 120); });

// ---------- Celebrations ----------
// Level-ups celebrate without blocking, never break someone's flow mid-exercise.
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
      h('p', `It’s been ${days} days. That’s fine: coming back is what matters.`),
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
  // When an update is installed, switch to it right away, but never in the middle of a lesson or review.
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
