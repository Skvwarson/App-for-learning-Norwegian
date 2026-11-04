// Progress: everything that makes growth visible.

import { h, progressBar, ring, add } from '../ui/dom.js';
import { deckStats, forecast, knowledgeMap } from '../core/deck.js';
import { levelInfo, streak, getGame, activity, readiness, achievementList, todayXp, dailyGoal, xpForLevel } from '../core/gamify.js';
import { UNITS, lesson } from '../core/course.js';
import { getState } from '../core/store.js';

export function progressView(root) {
  const lv = levelInfo();
  const g = getGame();
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
  const ach = achievementList();
  const totalMin = Math.round(Object.values(getState().stats.days).reduce((n, d) => n + (d.ms || 0), 0) / 60_000);
  const unitsDone = UNITS.filter((u) => lesson(u.id).done).length;

  const heat = h('div.heat');
  act.forEach((d) => add(heat, h('div.heat-cell', {
    title: `${d.k}: ${d.xp} XP${d.frozen ? ' (streak freeze)' : ''}`,
    class: d.frozen && !d.xp ? 'frozen' : '',
    style: { opacity: d.xp ? String(0.25 + 0.75 * Math.min(1, d.xp / maxXp)) : '' , background: d.xp ? 'var(--accent)' : '' },
  })));

  add(root, h('div.stack',
    h('div.page-head', h('h1', 'Fremgang'), h('p.muted', 'Your progress – proof that small daily steps add up.')),
    h('div.card.level-card',
      h('div.row.between',
        h('div', h('div.kicker', `Nivå ${lv.level}`), h('div.level-title', lv.title), h('div.small.muted', lv.titleEn)),
        ring(lv.pct, { size: 84, stroke: 9, label: `${lv.level}` })),
      progressBar(lv.pct, 'gold'),
      h('div.small.muted', `${lv.xp} XP total · ${lv.span - lv.into} XP to level ${lv.level + 1}`)),
    h('div.stat-row',
      h('div.stat', h('div.stat-n', `🔥 ${st}`), h('div.stat-l', 'day streak')),
      h('div.stat', h('div.stat-n', `❄️ ${g.freezes || 0}`), h('div.stat-l', 'freezes')),
      h('div.stat', h('div.stat-n', `${todayXp()}/${dailyGoal()}`), h('div.stat-l', 'XP today')),
      h('div.stat', h('div.stat-n', `×${g.bestCombo || 0}`), h('div.stat-l', 'best combo')),
      h('div.stat', h('div.stat-n', `${totalMin}m`), h('div.stat-l', 'total time'))),
    h('div.card', h('div.kicker', 'Last 12 weeks'), heat, h('div.small.muted', 'Don’t break the chain – but if you do, just start again. A missed day barely affects habit formation; giving up does.')),
    h('div.card.stack',
      h('div.kicker', '🗣️ Conversation readiness'),
      h('div.row.between', h('div.big-num', `≈${Math.round(ready.pct * 100)}%`), h('div.small.muted.right', `${known} known · ${learningN} in progress`, h('br'), `${unitsDone}/${UNITS.length} units`)),
      progressBar(ready.pct),
      h('div.milestones', ...ready.milestones.map((m) => h('div.milestone', { class: known >= m.at ? 'reached' : '' }, h('b', known >= m.at ? '✓ ' : '○ '), `${m.label} – ${m.at} words`))),
      h('div.small.muted', 'Estimate of how much of everyday spoken Norwegian is made of words you know (based on word-frequency research). Around 1,000 well-known words cover most of a casual conversation.')),
    h('div.card',
      h('div.kicker', '🧠 Memory'),
      h('div.deck-bars',
        bar('New', ds.new, ds.total, 'new'), bar('Learning', ds.learning, ds.total, 'learning'),
        bar('Known', ds.young, ds.total, 'known'), bar('Long-term (21+ days)', ds.mature, ds.total, 'mature')),
      h('div.small.muted', ds.retention != null ? `Your recall rate (30 days): ${Math.round(ds.retention * 100)}% · target ${Math.round(getState().settings.retention * 100)}%` : 'Recall rate appears after your first reviews.')),
    h('div.card',
      h('div.kicker', '📅 Reviews coming up'),
      h('div.forecast', ...fc.map((n, i) => h('div.fc-col', h('div.fc-bar', { style: { height: `${Math.round((n / fcMax) * 100)}%` } }), h('div.fc-n.small', String(n)), h('div.fc-d.small.muted', i === 0 ? 'today' : i === 1 ? 'tmrw' : `+${i}`))))),
    h('div.card',
      h('div.kicker', `🏅 Achievements · ${ach.filter((a) => a.unlocked).length}/${ach.length}`),
      h('div.badges', ...ach.map((a) => h('div.badge', { class: a.unlocked ? 'on' : '', title: a.desc }, h('div.badge-icon', a.unlocked ? a.icon : '🔒'), h('div.badge-t', a.title), h('div.badge-d', a.desc))))),
    h('div.row.center', h('a.btn.ghost', { href: '#/words' }, '📇 Browse my words'), h('a.btn.ghost', { href: '#/science' }, '🧠 How it works'))));
}

function bar(label, n, total, cls) {
  return h('div.deck-bar', h('div.row.between.small', h('span', label), h('b', String(n))), progressBar(total ? n / total : 0, cls));
}

export { xpForLevel };
