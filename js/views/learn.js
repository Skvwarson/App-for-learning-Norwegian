// The course as a journey map – every unit is a stop; progress is visible.

import { h, ring, confirmModal, add } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { UNITS, lesson, isUnlocked, currentUnit, unitMastery } from '../core/course.js';
import { navigate } from '../ui/router.js';
import { roleplayBest } from './roleplay.js';

const STOPS = ['✈️', '☕', '🎬', '🧇', '👨‍👩‍👧', '🚋', '🧥', '🚉', '🌲', '🌧️', '🏡', '💬', '🩺', '🛋️', '💼', '🌌', '📞', '💛'];

export function learnView(root) {
  const cur = currentUnit();
  const doneCount = UNITS.filter((u) => lesson(u.id).done).length;
  const path = h('div.path');
  UNITS.forEach((u, i) => {
    const st = lesson(u.id);
    const unlocked = isUnlocked(u);
    const isCur = u === cur && !st.done;
    const m = unitMastery(u);
    const node = h('button.node', {
      class: `${st.done ? 'done' : ''} ${isCur ? 'current' : ''} ${unlocked ? '' : 'locked'} ${i % 2 ? 'right' : 'left'}`,
      onclick: async () => {
        if (!unlocked && !(await confirmModal('This unit builds on the ones before it. Jump ahead anyway?', { ok: 'Jump ahead' }))) return;
        navigate(`#/lesson/${u.id}/${st.done ? 'intro' : st.step || 'intro'}`);
      },
    },
    h('div.node-icon', ring(st.done ? Math.max(m, 0.15) : m, { size: 64, stroke: 6, label: st.done ? '✓' : unlocked ? STOPS[i] : '🔒', animate: true })),
    h('div.node-text',
      h('div.small.muted', `Unit ${i + 1}`),
      h('div.strong', u.title),
      h('div.small.muted', u.subtitle),
      st.done ? h('div.small.ok', `Memory ${Math.round(m * 100)}%${roleplayBest(u.id) != null ? ` · 🗣️ ${Math.round(roleplayBest(u.id) * 100)}%` : ''}`) : isCur ? h('div.small.accent', st.step && st.step !== 'intro' ? `▶ Continue (${st.step})` : '▶ Start here') : null));
    add(path, node);
  });

  add(root, h('div.stack',
    h('div.page-head', h('h1', 'Course'), h('p.muted', `${doneCount} of ${UNITS.length} units done · about 15 minutes each`)),
    path,
    h('h2.section-title', 'Practise more'),
    h('div.list-card',
      ...[['#/read', 'read', 'Stories', 'Easy reading, every word tappable'],
        ['#/speak', 'speak', 'Role-plays', 'Speak in real situations'],
        ['#/practice/numbers', 'numbers', 'Numbers', 'Prices, ages, phone numbers'],
        ['#/practice/time', 'clock', 'Telling the time', '“halv sju” and friends']]
        .map(([href, ic, t, sub]) => h('a.list-row', { href }, h('span.list-icon', icon(ic, 22)),
          h('div.list-main', h('div.strong', t), h('div.small.muted', sub)), icon('chevron', 20, 'muted'))))));
}
