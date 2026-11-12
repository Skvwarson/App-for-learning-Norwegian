// Role-plays: speak through everyday scenes from the course.

import { h, add } from '../ui/dom.js';
import { UNITS, lesson } from '../core/course.js';
import { roleplayBest } from './roleplay.js';

export function speakView(root) {
  add(root, h('div.stack',
    h('a.back-link.sticky-back', { href: '#/learn' }, '‹ Course'),
    h('div.page-head', h('h1', 'Role-plays'), h('p.muted', 'Say every answer out loud.')),
    h('div.list-card', ...UNITS.map((u, i) => {
      const best = roleplayBest(u.id);
      return h('a.list-row', { href: `#/roleplay/${u.id}` },
        h('div.list-main', h('div.strong', u.roleplay.title), h('div.small.muted', `Unit ${i + 1} · with ${u.roleplay.partner}${lesson(u.id).done ? ' · ✓' : ''}`)),
        best != null ? h('span.pill', `${Math.round(best * 100)}%`) : h('span.pill.ghost', 'Try'));
    }))));
}
