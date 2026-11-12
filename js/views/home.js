// Today: one big button. The app decides what comes next (review → learn →
// read → speak); every finish screen leads straight to the next step.

import { h, ring, add } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { todayPlan } from '../core/today.js';
import { raceSnapshot } from '../core/social.js';
import { currentUnit, lesson, unitMastery, UNITS } from '../core/course.js';
import { streak, todayXp } from '../core/gamify.js';
import { settings } from '../core/store.js';
import { voicesReady, canSpeakNorwegian, deviceTip } from '../core/speech.js';

const STEP_ICONS = { reviews: 'review', lesson: 'learn', story: 'read', speak: 'speak' };

function greeting() {
  const hr = new Date().getHours();
  return hr < 10 ? 'God morgen' : hr < 17 ? 'God dag' : 'God kveld';
}

export function homeView(root) {
  const name = settings().name;
  const plan = todayPlan();
  const nextIdx = plan.findIndex((i) => !i.done);
  const next = plan[nextIdx];
  const doneCount = plan.filter((i) => i.done).length;
  const st = streak();

  const steps = h('div.today-steps', ...plan.map((p, i) => h('a.tstep', {
    href: p.href,
    class: p.done ? 'done' : i === nextIdx ? 'next' : '',
  }, h('span.tstep-dot', p.done ? icon('check', 20) : icon(STEP_ICONS[p.id], 20)), h('span.tstep-label', p.label))));

  const action = next
    ? h('a.btn.primary.big.cta.start-btn', { href: next.href },
      h('span.start-label', icon('play', 20), todayXp() > 0 ? 'Continue' : 'Start'),
      h('span.cta-sub', `Step ${nextIdx + 1} of ${plan.length} · ${next.sub}`))
    : h('div.stack.center-col.all-done',
      h('div.done-badge', icon('check', 30)),
      h('div.strong', 'Done for today!'),
      h('p.small.muted', 'Come back tomorrow to keep your streak.'),
      h('a.btn.ghost', { href: '#/review/quick' }, 'Practise a bit more'));

  const unit = currentUnit();
  const ul = lesson(unit.id);
  const m = unitMastery(unit);

  // Without a Norwegian voice, say so here, once, plainly.
  const voiceSlot = h('div');
  voicesReady().then(() => {
    if (canSpeakNorwegian()) return;
    add(voiceSlot, h('div.card.voice-card', h('div.strong', '🔇 No Norwegian voice on this device'), h('p.small.muted', deviceTip())));
  });

  add(root, h('div.home.stack',
    h('div.page-head',
      h('h1', `${greeting()}${name ? `, ${name}` : ''}!`),
      h('p.muted', st ? `${st}-day streak. Keep it going!` : 'About 10 minutes a day is all it takes.')),
    h('div.card.today-card',
      h('div.row.between', h('div.kicker', 'Today'), h('span.small.muted', `${doneCount}/${plan.length} done`)),
      steps,
      action),
    voiceSlot,
    raceCard(),
    h('a.card.list-row.unit-now', { href: `#/lesson/${unit.id}/${ul.step || 'intro'}` },
      ring(m, { size: 48, stroke: 5, label: `${Math.round(m * 100)}%`, animate: true }),
      h('div.list-main', h('div.small.muted', `Unit ${UNITS.indexOf(unit) + 1} of ${UNITS.length}`), h('div.strong', unit.title)),
      icon('chevron', 20, 'muted'))));
}

/** A small "you vs friend" teaser that links to the race. */
function raceCard() {
  const { players } = raceSnapshot();
  const me = players.find((p) => p.you);
  const ranked = [...players].sort((a, b) => b.xpWeek - a.xpWeek);
  const leader = ranked[0];
  return h('a.card.race-card', { href: '#/friends' },
    h('div.row.between', h('div.kicker', 'This week’s race'), icon('chevron', 20, 'muted')),
    h('div.race-mini', ...ranked.map((p, i) => h('div.race-mini-row', { class: p.you ? 'me' : '' },
      h('span.race-mini-rank', String(i + 1)),
      h('span.strong', p.you ? 'You' : p.name),
      h('span.race-mini-xp', `${p.xpWeek} XP`)))),
    h('div.small.muted', leader.you ? 'You’re in the lead!' : `${leader.name} is ${leader.xpWeek - me.xpWeek} XP ahead.`));
}
