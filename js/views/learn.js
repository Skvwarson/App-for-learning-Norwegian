// The course as a journey map – every unit is a stop; progress is visible.

import { h, ring, confirmModal, add } from '../ui/dom.js';
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
    h('div.page-head', h('h1', 'Reisen'), h('p.muted', `Your journey to conversational Norwegian · ${doneCount}/${UNITS.length} stops`)),
    h('div.card.tip.small', 'Each unit: listen to a real-life scene → learn its words in small groups → one grammar idea → mixed practice → a role-play where you speak. ~15 minutes. One unit a day is a great pace; reviews keep everything fresh.'),
    path,
    h('div.page-head', h('h2', 'Extra practice')),
    h('div.grid2',
      h('a.card.tile-link', { href: '#/practice/numbers' }, h('div.big-emoji', '🔢'), h('div.strong', 'Numbers'), h('div.small.muted', 'Prices, ages, phone numbers')),
      h('a.card.tile-link', { href: '#/practice/time' }, h('div.big-emoji', '🕒'), h('div.strong', 'Telling the time'), h('div.small.muted', '“halv sju” and friends')),
      h('a.card.tile-link', { href: '#/import' }, h('div.big-emoji', '📄'), h('div.strong', 'Your textbook'), h('div.small.muted', 'Import a PDF and learn from it')),
      h('a.card.tile-link', { href: '#/speak' }, h('div.big-emoji', '🎭'), h('div.strong', 'Role-plays'), h('div.small.muted', 'Speak in real situations')))));
}
