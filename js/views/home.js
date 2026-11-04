// Home: one obvious next step, today's checklist, streak, goal ring, mission.

import { h, ring, progressBar, sfx, haptic, confetti, toast, add } from '../ui/dom.js';
import { speakBtn } from '../ui/components.js';
import { dueCount, knowledgeMap, newBudgetLeft } from '../core/deck.js';
import { currentUnit, lesson, unitMastery, UNITS } from '../core/course.js';
import { levelInfo, todayXp, dailyGoal, streak, getGame, todaysMission, completeMission, readiness, activity } from '../core/gamify.js';
import { settings, getState, dayKey } from '../core/store.js';
import { STORIES } from '../../data/stories.js';
import { openPlanModal } from './onboarding.js';
import { voicesReady, canSpeakNorwegian, voiceStatus } from '../core/speech.js';
import { deviceTip } from './voice-settings.js';

function greeting() {
  const hr = new Date().getHours();
  return hr < 10 ? 'God morgen' : hr < 17 ? 'God dag' : 'God kveld';
}

export function homeView(root) {
  const s = getState();
  const name = settings().name;
  const due = dueCount();
  const unit = currentUnit();
  const ul = lesson(unit.id);
  const lv = levelInfo();
  const xpToday = todayXp();
  const goal = dailyGoal();
  const st = streak();
  const g = getGame();
  const known = [...knowledgeMap().values()].filter((v) => v === 'known').length;
  const learning = [...knowledgeMap().values()].filter((v) => v === 'learning').length;
  const ready = readiness(known + learning * 0.5);
  const mission = todaysMission();
  const today = dayKey();
  const storyToday = Object.values(s.stories).some((x) => x.last && dayKey(x.last) === today);
  const lessonToday = (s.stats.days[today]?.lessons ?? 0) > 0;
  const reviewsDone = (s.stats.days[today]?.reviews ?? 0) > 0;

  // The single best next action – no decision fatigue.
  let cta;
  if (due.reviews + due.learning > 0) cta = { href: '#/review', label: `Start today’s session`, sub: `${due.reviews + due.learning} cards ready for review · ~${Math.max(1, Math.round((due.reviews + due.learning) * 0.15))} min` };
  else if (!ul.done && newBudgetLeft() > 0) cta = { href: `#/lesson/${unit.id}/${ul.step || 'intro'}`, label: ul.step && ul.step !== 'intro' ? `Continue: ${unit.title}` : `Next lesson: ${unit.title}`, sub: unit.subtitle };
  else if (due.fresh > 0) cta = { href: '#/review', label: 'Learn your saved words', sub: `${due.fresh} words from your reading` };
  else {
    const story = STORIES.find((x) => !s.stories[x.id]) ?? STORIES[0];
    cta = { href: `#/read/story/${story.id}`, label: `Read: ${story.title}`, sub: 'Comprehensible input – easy reading you mostly understand' };
  }

  const week = activity(7);
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const checklist = [
    { done: reviewsDone && due.reviews + due.learning === 0, label: 'Reviews', href: '#/review', note: due.reviews + due.learning ? `${due.reviews + due.learning} ready` : reviewsDone ? 'done' : 'nothing due' },
    { done: lessonToday || ul.done, label: 'New words', href: `#/lesson/${unit.id}/${ul.step || 'intro'}`, note: unit.title },
    { done: storyToday, label: 'Read something', href: '#/read', note: 'a short story' },
    { done: mission.done, label: 'Daily-life mission', href: null, note: '+25 XP', onclick: (e) => { e.preventDefault(); document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } },
  ];

  const missionCard = h('div.card.mission#mission', { class: mission.done ? 'done' : '' },
    h('div.row.between', h('div.kicker', `${mission.icon} Today’s mission – Norwegian in real life`), mission.done ? h('span.pill.ok', '✓ Done') : null),
    h('p', mission.text),
    h('div.row', h('div.no.mission-no', mission.no), speakBtn(mission.no)),
    mission.done ? null : h('button.btn.primary', {
      onclick: (e) => {
        completeMission(); sfx.goal(); haptic([10, 30, 10]); confetti(60);
        toast('Mission complete! +25 XP', { icon: '🧭' });
        e.currentTarget.replaceWith(h('span.pill.ok', '✓ Done'));
      },
    }, 'I did it ✓'));

  const plan = g.plan;

  // If this device can't pronounce Norwegian (or only with a basic voice), say so up front.
  const voiceSlot = h('div');
  voicesReady().then(() => {
    const st = voiceStatus();
    if (canSpeakNorwegian() && st.quality >= 3) return;
    add(voiceSlot, h('a.card.voice-card', { href: '#/settings' },
      h('div.kicker', st.ok ? '🔊 Upgrade your Norwegian voice' : '🔇 Set up a Norwegian voice'),
      h('p', st.ok
        ? `You’re hearing a basic voice (${st.label}). Natural voices make listening practice much more useful.`
        : 'This browser has no Norwegian voice, so audio is switched off rather than read by an English voice.'),
      h('p.small', deviceTip()),
      h('span.small.accent', 'Open voice settings ▸')));
  });

  add(root, h('div.home.stack',
    h('div.hero.card',
      h('div.hero-top',
        h('div',
          h('div.greet', `${greeting()}${name ? ', ' + name : ''}!`),
          h('div.small.muted', `Nivå ${lv.level} · ${lv.title} (${lv.titleEn})`),
          h('div.level-bar', progressBar(lv.pct, 'gold'), h('span.small.muted', `${lv.into}/${lv.span} XP`))),
        h('a.goal-ring', { href: '#/progress', title: 'Daily goal' },
          ring(xpToday / goal, { size: 76, stroke: 8, label: xpToday >= goal ? '✓' : `${Math.round((xpToday / goal) * 100)}%`, cls: xpToday >= goal ? 'complete' : '' }),
          h('div.small.muted.center', `${xpToday}/${goal} XP`))),
      h('div.streak-row',
        h('div.streak', { class: st > 0 ? 'on' : '' }, h('span.flame', '🔥'), h('b', String(st)), h('span.small', st === 1 ? ' day' : ' days')),
        g.freezes ? h('div.small.muted', { title: 'A streak freeze protects your streak if you miss a day. You earn one every 7 days.' }, `❄️ ×${g.freezes} streak freeze`) : null,
        h('div.week', ...week.map((d) => h('div.day', { class: d.xp >= 10 ? 'on' : d.frozen ? 'frozen' : '' },
          h('span', dayNames[new Date(d.k + 'T12:00').getDay()]))))),
      h('a.btn.primary.big.cta', { href: cta.href }, h('span', cta.label, ' ▸'), h('span.cta-sub', cta.sub)),
      h('div.row.center.wrap',
        h('a.btn.ghost.small', { href: '#/review/quick' }, '⚡ Just 2 minutes'),
        h('a.btn.ghost.small', { href: '#/practice/numbers' }, '🔢 Number drill'),
        h('a.btn.ghost.small', { href: '#/chat' }, '🤖 Chat'))),

    h('div.card',
      h('div.kicker', '✅ Today'),
      h('div.checklist', ...checklist.map((c) => h('a.check-item', { href: c.href ?? '#/', onclick: c.onclick, class: c.done ? 'done' : '' },
        h('span.check', c.done ? '✓' : ''), h('span.check-label', c.label), h('span.small.muted', c.note))))),

    voiceSlot,
    missionCard,

    h('a.card.unit-now', { href: `#/lesson/${unit.id}/${ul.step || 'intro'}` },
      h('div.row.between',
        h('div', h('div.kicker', `📍 Unit ${UNITS.indexOf(unit) + 1} of ${UNITS.length}`), h('div.strong', unit.title), h('div.small.muted', unit.subtitle)),
        ring(unitMastery(unit), { size: 52, stroke: 6, label: `${Math.round(unitMastery(unit) * 100)}%` }))),

    h('a.card.readiness', { href: '#/progress' },
      h('div.kicker', '🗣️ Conversation readiness'),
      h('div.row.between', h('div.big-num', `≈${Math.round(ready.pct * 100)}%`),
        h('div.small.muted.right', `${known} words known`, h('br'), `${learning} in progress`)),
      progressBar(ready.pct),
      h('div.small.muted', ready.next
        ? `≈ share of everyday spoken Norwegian you can recognise (words in progress count half). Next milestone: ${ready.next.label} at ${ready.next.at} words.`
        : 'You know the core vocabulary of everyday conversation!')),

    plan
      ? h('div.card.plan', h('div.kicker', '🗓️ Your plan'), h('p', `After I ${plan.cue || 'have my morning coffee'}, I practise Norwegian${plan.time ? ` (around ${plan.time})` : ''}.`),
        h('button.btn.ghost.small', { onclick: openPlanModal }, 'Edit plan / reminder'))
      : h('div.card.plan', h('div.kicker', '🗓️ Make it automatic'),
        h('p', 'People who decide exactly when and where they’ll practise are much more likely to keep going. Takes 20 seconds.'),
        h('button.btn.primary', { onclick: openPlanModal }, 'Make my plan')),

    h('div.row.center.wrap.small',
      h('a.btn.ghost.small', { href: '#/science' }, '🧠 How this app uses psychology'),
      h('a.btn.ghost.small', { href: '#/words' }, '📇 My words'))));
}
