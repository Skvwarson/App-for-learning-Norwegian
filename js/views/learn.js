// Course: the unit you're on as one clear card, then the whole route as a
// calm timeline, grouped by level.

import { h, ring, confirmModal, add, progressBar } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { UNITS, lesson, isUnlocked, currentUnit, unitMastery, STEP_LABELS } from '../core/course.js';
import { navigate } from '../ui/router.js';

const LEVELS = [
  { name: 'A1', label: 'Beginner', from: 0, to: 12 },
  { name: 'A2', label: 'Elementary', from: 12, to: UNITS.length },
];

const open = async (u) => {
  const st = lesson(u.id);
  if (!isUnlocked(u) && !(await confirmModal('This unit builds on the ones before it. Jump ahead anyway?', { ok: 'Jump ahead' }))) return;
  navigate(`#/lesson/${u.id}/${st.done ? 'intro' : st.step || 'intro'}`);
};

export function learnView(root) {
  const cur = currentUnit();
  const curNo = UNITS.indexOf(cur) + 1;
  const curSt = lesson(cur.id);
  const doneCount = UNITS.filter((u) => lesson(u.id).done).length;
  const started = curSt.step && curSt.step !== 'intro' && !curSt.done;

  const hero = h('div.card.unit-hero',
    h('div.unit-hero-top',
      h('div',
        h('div.kicker', started ? 'Continue' : 'Up next'),
        h('div.unit-hero-no', `Unit ${curNo}`),
        h('div.unit-hero-title.no', cur.title),
        h('div.muted', cur.subtitle)),
      ring(unitMastery(cur), { size: 64, stroke: 6, label: `${Math.round(unitMastery(cur) * 100)}%`, animate: true })),
    h('button.btn.primary.big', { type: 'button', onclick: () => open(cur) },
      icon('play', 18), started ? `Continue · ${STEP_LABELS[curSt.step]}` : 'Start unit'));

  const row = (u) => {
    const i = UNITS.indexOf(u);
    const st = lesson(u.id);
    const isCur = u === cur && !st.done;
    const locked = !isUnlocked(u);
    const m = unitMastery(u);
    const state = st.done ? 'done' : isCur ? 'current' : locked ? 'locked' : 'open';
    return h('button.tl-row', { type: 'button', class: state, onclick: () => open(u) },
      h('span.tl-dot', st.done ? icon('check', 16) : String(i + 1)),
      h('span.tl-main',
        h('span.tl-title', u.title),
        h('span.tl-sub', u.subtitle)),
      h('span.tl-end',
        st.done ? h('span.tl-mem', `${Math.round(m * 100)}%`)
          : isCur ? h('span.tl-now', 'Now')
            : locked ? icon('lock', 16, 'muted') : icon('chevron', 18, 'muted')));
  };

  add(root, h('div.stack.course',
    h('div.page-head', h('h1', 'Course'), h('p.muted', `${doneCount} of ${UNITS.length} units done`)),
    progressBar(doneCount / UNITS.length, '', { animate: true }),
    hero,
    ...LEVELS.map((lv) => {
      const units = UNITS.slice(lv.from, lv.to);
      const done = units.filter((u) => lesson(u.id).done).length;
      return h('section.tl',
        h('div.tl-head', h('span.tl-level', lv.name), h('span.strong', lv.label), h('span.small.muted.tl-count', `${done}/${units.length}`)),
        h('div.tl-list', ...units.map(row)));
    }),
    h('h2.section-title', 'Practise more'),
    h('div.list-card',
      ...[['#/read', 'read', 'Stories', 'Easy reading, every word tappable'],
        ['#/speak', 'speak', 'Role-plays', 'Speak in real situations'],
        ['#/practice/numbers', 'numbers', 'Numbers', 'Prices, ages, phone numbers'],
        ['#/practice/time', 'clock', 'Telling the time', '“halv sju” and friends']]
        .map(([href, ic, t, sub]) => h('a.list-row', { href }, h('span.list-icon', icon(ic, 22)),
          h('div.list-main', h('div.strong', t), h('div.small.muted', sub)), icon('chevron', 20, 'muted'))))));
}
