// Profile ("Me") and the detailed progress page.

import { h, progressBar, ring, add } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { deckStats, forecast, knowledgeMap } from '../core/deck.js';
import { levelInfo, streak, activity, readiness, xpForLevel } from '../core/gamify.js';
import { UNITS, lesson } from '../core/course.js';
import { getState } from '../core/store.js';

export function progressView(root) {
  const lv = levelInfo();
  const st = streak();
  const ds = deckStats();
  const km = knowledgeMap();
  const known = [...km.values()].filter((v) => v === 'known').length;
  const learningN = [...km.values()].filter((v) => v === 'learning').length;
  const ready = readiness(known + learningN * 0.5);
  const act = activity(84);
  const maxXp = Math.max(50, ...act.map((d) => d.xp));
  const fc = forecast(7);
  const fcMax = Math.max(1, ...fc);
  const totalMin = Math.round(Object.values(getState().stats.days).reduce((n, d) => n + (d.ms || 0), 0) / 60_000);
  const unitsDone = UNITS.filter((u) => lesson(u.id).done).length;

  const heat = h('div.heat');
  act.forEach((d) => add(heat, h('div.heat-cell', {
    title: `${d.k}: ${d.xp} XP${d.frozen ? ' (streak freeze)' : ''}`,
    class: d.frozen && !d.xp ? 'frozen' : '',
    style: { opacity: d.xp ? String(0.25 + 0.75 * Math.min(1, d.xp / maxXp)) : '' , background: d.xp ? 'var(--accent)' : '' },
  })));

  add(root, h('div.stack',
    h('div.page-head', h('a.back-link', { href: '#/me' }, '‹ Me'), h('h1', 'Progress')),
    h('div.card.level-card',
      h('div.row.between',
        h('div', h('div.kicker', `Level ${lv.level}`), h('div.level-title', lv.title), h('div.small.muted', lv.titleEn)),
        ring(lv.pct, { size: 84, stroke: 9, label: `${lv.level}`, animate: true })),
      progressBar(lv.pct, 'gold', { animate: true }),
      h('div.small.muted', `${lv.xp} XP total · ${lv.span - lv.into} XP to level ${lv.level + 1}`)),
    h('div.stat-row',
      h('div.stat', h('div.stat-n', `${st}`), h('div.stat-l', 'day streak')),
      h('div.stat', h('div.stat-n', `${known}`), h('div.stat-l', 'words known')),
      h('div.stat', h('div.stat-n', `${totalMin}m`), h('div.stat-l', 'total time'))),
    h('div.card', h('div.kicker', 'Last 12 weeks'), heat),
    h('div.card.stack',
      h('div.kicker', 'Conversation readiness'),
      h('div.row.between', h('div.big-num', `≈${Math.round(ready.pct * 100)}%`), h('div.small.muted.right', `${known} known · ${learningN} in progress`, h('br'), `${unitsDone}/${UNITS.length} units`)),
      progressBar(ready.pct, '', { animate: true }),
      h('div.milestones', ...ready.milestones.map((m) => h('div.milestone', { class: known >= m.at ? 'reached' : '' }, h('b', known >= m.at ? '✓ ' : '○ '), `${m.label}, ${m.at} words`))),
      h('div.small.muted', 'How much of everyday spoken Norwegian uses words you know.')),
    h('div.card',
      h('div.kicker', 'Memory'),
      h('div.deck-bars',
        bar('New', ds.new, ds.total, 'new'), bar('Learning', ds.learning, ds.total, 'learning'),
        bar('Known', ds.young, ds.total, 'known'), bar('Long-term (21+ days)', ds.mature, ds.total, 'mature')),
      h('div.small.muted', ds.retention != null ? `Your recall rate (30 days): ${Math.round(ds.retention * 100)}% · target ${Math.round(getState().settings.retention * 100)}%` : 'Recall rate appears after your first reviews.')),
    h('div.card',
      h('div.kicker', 'Reviews coming up'),
      h('div.forecast', ...fc.map((n, i) => h('div.fc-col', h('div.fc-bar', { style: { height: `${Math.round((n / fcMax) * 100)}%` } }), h('div.fc-n.small', String(n)), h('div.fc-d.small.muted', i === 0 ? 'today' : i === 1 ? 'tmrw' : `+${i}`)))))));
}

function bar(label, n, total, cls) {
  return h('div.deck-bar', h('div.row.between.small', h('span', label), h('b', String(n))), progressBar(total ? n / total : 0, cls, { animate: true }));
}

export { xpForLevel };

export function meView(root) {
  const { name } = getState().settings;
  const lv = levelInfo();
  const known = [...knowledgeMap().values()].filter((v) => v === 'known').length;
  const unitsDone = UNITS.filter((u) => lesson(u.id).done).length;
  const row = (href, ic, label, sub) => h('a.list-row', { href }, h('span.list-icon', icon(ic, 22)),
    h('div.list-main', h('div.strong', label), sub ? h('div.small.muted', sub) : null), icon('chevron', 20, 'muted'));
  add(root, h('div.stack.me',
    h('div.me-head',
      h('div.me-avatar', name ? name.charAt(0).toUpperCase() : icon('user', 34)),
      h('div', h('h1', name || 'You'), h('div.muted', `Level ${lv.level} · ${lv.titleEn}`))),
    h('div.card.stack.tight',
      h('div.row.between.small', h('span.muted', `Level ${lv.level}`), h('span.muted', `${lv.span - lv.into} XP to level ${lv.level + 1}`)),
      progressBar(lv.pct, 'gold', { animate: true })),
    h('div.stat-row',
      h('div.stat', h('div.stat-n', String(streak())), h('div.stat-l', 'day streak')),
      h('div.stat', h('div.stat-n', String(known)), h('div.stat-l', 'words known')),
      h('div.stat', h('div.stat-n', `${unitsDone}/${UNITS.length}`), h('div.stat-l', 'units'))),
    h('div.list-card',
      row('#/progress', 'chart', 'Progress', 'Your activity, memory and readiness'),
      row('#/words', 'words', 'My words', 'Every word you’re learning'),
      row('#/settings', 'settings', 'Settings', 'Name, voice, sound, backup'))));
}
