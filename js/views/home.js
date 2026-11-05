// Home: one obvious next step, today's checklist, streak, goal ring, mission.

import { h, ring, progressBar, sfx, haptic, confetti, toast, add } from '../ui/dom.js';
import { speakBtn } from '../ui/components.js';
import { knowledgeMap } from '../core/deck.js';
import { todayPlan } from '../core/today.js';
import { currentUnit, lesson, unitMastery, UNITS } from '../core/course.js';
import { levelInfo, todayXp, dailyGoal, streak, getGame, todaysMission, completeMission, readiness, activity } from '../core/gamify.js';
import { settings } from '../core/store.js';
import { openPlanModal } from './onboarding.js';
import { voicesReady, canSpeakNorwegian, voiceStatus } from '../core/speech.js';
import { deviceTip } from './voice-settings.js';

function greeting() {
  const hr = new Date().getHours();
  return hr < 10 ? 'God morgen' : hr < 17 ? 'God dag' : 'God kveld';
}

export function homeView(root) {
  const name = settings().name;
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

  // The single best next action – no decision fatigue. Same plan as every finish screen.
  const plan = todayPlan();
  const next = plan.find((i) => !i.done);
  const scrollToMission = (e) => { e.preventDefault(); document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const cta = next
    ? { href: next.href, label: next.cta, sub: next.sub, onclick: next.id === 'mission' ? scrollToMission : null }
    : { href: '#/review/quick', label: 'Today’s plan is done – bonus round', sub: 'Everything extra today is a bonus 🎉' };

  const week = activity(7);
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const checklist = plan.map((i) => ({ ...i, onclick: i.id === 'mission' ? scrollToMission : null }));
  const doneCount = checklist.filter((c) => c.done).length;

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

  const habitPlan = g.plan;

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
          h('div.level-bar', progressBar(lv.pct, 'gold', { animate: true }), h('span.small.muted', `${lv.into}/${lv.span} XP`))),
        h('a.goal-ring', { href: '#/progress', title: 'Daily goal' },
          ring(xpToday / goal, { size: 76, stroke: 8, label: xpToday >= goal ? '✓' : `${Math.round((xpToday / goal) * 100)}%`, cls: xpToday >= goal ? 'complete' : '', animate: true }),
          h('div.small.muted.center', `${xpToday}/${goal} XP`))),
      h('div.streak-row',
        h('div.streak', { class: st > 0 ? 'on' : '' }, h('span.flame', '🔥'), h('b', String(st)), h('span.small', st === 1 ? ' day' : ' days')),
        g.freezes ? h('div.small.muted', { title: 'A streak freeze protects your streak if you miss a day. You earn one every 7 days.' }, `❄️ ×${g.freezes} streak freeze`) : null,
        h('div.week', ...week.map((d) => h('div.day', { class: d.xp >= 10 ? 'on' : d.frozen ? 'frozen' : '' },
          h('span', dayNames[new Date(d.k + 'T12:00').getDay()]))))),
      h('a.btn.primary.big.cta', { href: cta.href, onclick: cta.onclick }, h('span', cta.label, ' ▸'), h('span.cta-sub', cta.sub)),
      h('div.row.center.wrap',
        h('a.btn.ghost.small', { href: '#/review/quick' }, '⚡ Just 2 minutes'),
        h('a.btn.ghost.small', { href: '#/practice/numbers' }, '🔢 Number drill'),
        h('a.btn.ghost.small', { href: '#/chat' }, '🤖 Chat'))),

    h('div.card',
      h('div.row.between', h('div.kicker', '✅ Today’s plan'), h('span.small.muted', `${doneCount}/${checklist.length}`)),
      progressBar(doneCount / checklist.length, 'gold', { animate: true }),
      h('div.checklist', ...checklist.map((c) => h('a.check-item', { href: c.href, onclick: c.onclick, class: c.done ? 'done' : '' },
        h('span.check', c.done ? '✓' : ''), h('span.check-label', c.label), h('span.small.muted', c.note))))),

    voiceSlot,
    missionCard,

    h('a.card.unit-now', { href: `#/lesson/${unit.id}/${ul.step || 'intro'}` },
      h('div.row.between',
        h('div', h('div.kicker', `📍 Unit ${UNITS.indexOf(unit) + 1} of ${UNITS.length}`), h('div.strong', unit.title), h('div.small.muted', unit.subtitle)),
        ring(unitMastery(unit), { size: 52, stroke: 6, label: `${Math.round(unitMastery(unit) * 100)}%`, animate: true }))),

    h('a.card.readiness', { href: '#/progress' },
      h('div.kicker', '🗣️ Conversation readiness'),
      h('div.row.between', h('div.big-num', `≈${Math.round(ready.pct * 100)}%`),
        h('div.small.muted.right', `${known} words known`, h('br'), `${learning} in progress`)),
      progressBar(ready.pct, '', { animate: true }),
      h('div.small.muted', ready.next
        ? `≈ share of everyday spoken Norwegian you can recognise (words in progress count half). Next milestone: ${ready.next.label} at ${ready.next.at} words.`
        : 'You know the core vocabulary of everyday conversation!')),

    habitPlan
      ? h('div.card.plan', h('div.kicker', '🗓️ Your plan'), h('p', `After I ${habitPlan.cue || 'have my morning coffee'}, I practise Norwegian${habitPlan.time ? ` (around ${habitPlan.time})` : ''}.`),
        h('button.btn.ghost.small', { onclick: openPlanModal }, 'Edit plan / reminder'))
      : h('div.card.plan', h('div.kicker', '🗓️ Make it automatic'),
        h('p', 'People who decide exactly when and where they’ll practise are much more likely to keep going. Takes 20 seconds.'),
        h('button.btn.primary', { onclick: openPlanModal }, 'Make my plan')),

    h('div.row.center.wrap.small',
      h('a.btn.ghost.small', { href: '#/science' }, '🧠 How this app uses psychology'),
      h('a.btn.ghost.small', { href: '#/words' }, '📇 My words'))));
}
