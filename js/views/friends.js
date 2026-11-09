// "Kappløpet" – the race between you and your friend(s).

import { h, add, clear, progressBar } from '../ui/dom.js';
import { raceSnapshot, raceFeed } from '../core/social.js';

const COLORS = ['#ba0c2f', '#00205b', '#23845a', '#b7790a', '#7a3db8', '#0f7c8c'];
const colorFor = (name) => COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const avatar = (p, size = 40) => h('div.avatar', { style: { width: `${size}px`, height: `${size}px`, background: colorFor(p.name), fontSize: `${size * 0.42}px` } }, p.name.charAt(0).toUpperCase());
const ago = (t, now) => { const hrs = Math.round((now - t) / 3600_000); return hrs < 1 ? 'just now' : hrs < 24 ? `${hrs} h ago` : `${Math.round(hrs / 24)} d ago`; };
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const METRICS = {
  week: { label: 'This week', value: (p) => p.xpWeek, unit: 'XP' },
  total: { label: 'All time', value: (p) => p.xpTotal, unit: 'XP' },
  streak: { label: 'Streak', value: (p) => p.streak, unit: 'days' },
  words: { label: 'Words', value: (p) => p.wordsKnown, unit: 'words' },
};

export function friendsView(root) {
  let metric = (() => { try { return localStorage.getItem('nn.raceMetric') || 'week'; } catch { return 'week'; } })();
  if (!METRICS[metric]) metric = 'week';
  const now = Date.now();
  const { players, demo } = raceSnapshot(now);
  const me = players.find((p) => p.you);
  const board = h('div.stack.tight');
  const tabs = h('div.chips.race-tabs');

  const renderBoard = () => {
    const m = METRICS[metric];
    const ranked = [...players].sort((a, b) => m.value(b) - m.value(a));
    const top = Math.max(1, m.value(ranked[0]));
    clear(tabs);
    add(tabs, ...Object.entries(METRICS).map(([k, v]) => h('button.chip', { class: k === metric ? 'active' : '', onclick: () => { metric = k; try { localStorage.setItem('nn.raceMetric', k); } catch { /* */ } renderBoard(); } }, v.label)));
    clear(board);
    ranked.forEach((p, i) => {
      add(board, h('div.race-row', { class: p.you ? 'me' : '' },
        h('div.race-rank', ['🥇', '🥈', '🥉'][i] ?? `${i + 1}`),
        avatar(p),
        h('div.race-main',
          h('div.row.between', h('div.strong', p.you ? `${p.name} (you)` : p.name), h('div.race-val', `${m.value(p)} ${m.unit}`)),
          progressBar(m.value(p) / top, p.you ? '' : 'navy', { animate: true }),
          h('div.small.muted', `Level ${p.level} · 🔥 ${p.streak} · ${p.wordsKnown} words · ${p.unitsDone}/18 units`))));
    });
  };
  renderBoard();

  // Head-to-head with the closest rival.
  const rival = players.filter((p) => !p.you).sort((a, b) => Math.abs(a.xpWeek - me.xpWeek) - Math.abs(b.xpWeek - me.xpWeek))[0];
  const duel = rival && h('div.card.stack.duel',
    h('div.kicker', '⚔️ You vs ' + rival.name),
    h('div.duel-heads', h('div.duel-side', avatar(me, 52), h('b', me.name)), h('div.duel-vs', 'VS'), h('div.duel-side', avatar(rival, 52), h('b', rival.name))),
    ...[
      ['XP this week', me.xpWeek, rival.xpWeek],
      ['Streak 🔥', me.streak, rival.streak],
      ['Words known', me.wordsKnown, rival.wordsKnown],
      ['Units done', me.unitsDone, rival.unitsDone],
      ['Best combo', me.bestCombo, rival.bestCombo],
    ].map(([label, a, b]) => {
      const total = Math.max(1, a + b);
      return h('div.duel-row',
        h('div.row.between.small', h('b', { class: a >= b ? 'lead' : '' }, String(a)), h('span.muted', label), h('b', { class: b > a ? 'lead' : '' }, String(b))),
        h('div.duel-bar', h('div.duel-me', { style: { width: `${(a / total) * 100}%`, background: colorFor(me.name) } }), h('div.duel-them', { style: { background: colorFor(rival.name) } })));
    }),
    h('p.duel-msg', me.xpWeek >= rival.xpWeek
      ? `🏆 You're ahead by ${me.xpWeek - rival.xpWeek} XP this week. Keep it up!`
      : `📣 ${rival.name} is ${rival.xpWeek - me.xpWeek} XP ahead this week – about ${Math.max(1, Math.ceil((rival.xpWeek - me.xpWeek) / 120))} short session${Math.ceil((rival.xpWeek - me.xpWeek) / 120) > 1 ? 's' : ''} to catch up.`));

  // This week, day by day: one chart, each player's bar side by side per day.
  const max = Math.max(50, ...players.flatMap((q) => q.week));
  const niceMax = Math.ceil(max / 50) * 50;
  const weekCard = h('div.card.stack',
    h('div.row.between', h('div.kicker', '📅 This week, day by day'),
      h('div.legend', ...players.map((p) => h('span.legend-item', h('span.legend-dot', { style: { background: colorFor(p.name) } }), p.you ? 'You' : p.name)))),
    h('div.wchart',
      h('div.wchart-axis', h('span', String(niceMax)), h('span', String(niceMax / 2)), h('span', '0')),
      h('div.wchart-plot',
        h('div.wchart-grid', h('div'), h('div'), h('div')),
        h('div.wchart-days', ...Array.from({ length: 7 }, (_, i) => h('div.wchart-day',
          h('div.wchart-bars', ...players.map((p) => h('div.wchart-bar', {
            title: `${p.you ? 'You' : p.name}: ${p.week[i]} XP`,
            style: { height: `${(p.week[i] / niceMax) * 100}%`, background: colorFor(p.name) },
          }))),
          h('div.wk-d', i === 6 ? 'Today' : DAYS[new Date(now - (6 - i) * 86400_000).getDay()])))))),
    h('div.small.muted', `This week: ${players.map((p) => `${p.you ? 'you' : p.name} ${p.xpWeek} XP`).join(' · ')}`));

  const feed = raceFeed(players, now);
  add(root, h('div.stack',
    h('div.page-head', h('h1', 'The race'), h('p.muted', 'Who learns more Norwegian this week?')),
    demo ? h('div.card.tip.small', h('b', '👀 Demo: '), 'your own numbers are real, but “Ola” is made-up practice data. Once Firebase is connected, your friend’s real progress appears here.') : null,
    tabs, board, duel, weekCard,
    feed.length ? h('div.card.stack', h('div.kicker', '📣 Latest'),
      ...feed.map((f) => h('div.feed-row', h('span.feed-icon', f.icon), h('span', f.text), h('span.small.muted', ago(f.at, now))))) : null));
}
