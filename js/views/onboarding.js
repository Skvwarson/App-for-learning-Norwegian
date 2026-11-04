// First-run onboarding and the habit plan (implementation intention + calendar reminder).

import { h, modal, download, toast, confetti, add } from '../ui/dom.js';
import { update, settings } from '../core/store.js';
import { getGame, setPlan, planIcs } from '../core/gamify.js';
import { navigate } from '../ui/router.js';

const GOALS = [
  { xp: 50, label: 'Tiny', note: '≈ 5 min · perfect for busy days' },
  { xp: 100, label: 'Regular', note: '≈ 10 min · recommended' },
  { xp: 200, label: 'Serious', note: '≈ 20 min' },
  { xp: 300, label: 'Intense', note: '≈ 30 min · fast track' },
];

const CUES = ['have my morning coffee', 'sit down on the bus/train', 'eat lunch', 'get home from work', 'brush my teeth at night'];

export function maybeOnboard() {
  if (getGame().onboarded) return;
  let step = 0;
  const data = { name: settings().name || '', goal: settings().dailyGoalXp || 100, cue: CUES[0], time: '08:00' };
  let m;
  const body = h('div.onboard.stack');
  const render = () => {
    body.replaceChildren();
    if (step === 0) {
      add(body, 
        h('div.big-emoji', '🇳🇴'),
        h('h2', 'Velkommen! Welcome to Norsk Nå'),
        h('p', 'Learn to speak Norwegian with methods from memory research: spaced repetition, active recall, small chunks, real context and lots of easy input.'),
        h('p.small.muted', 'Everything stays private in this browser. No account needed.'),
        h('label.small.muted', 'What should we call you? (used in role-plays)'),
        h('input.input#ob-name', { value: data.name, placeholder: 'Your first name', oninput: (e) => { data.name = e.target.value; } }),
        h('button.btn.primary.big', { onclick: () => { step = 1; render(); } }, 'Next ▸'));
    } else if (step === 1) {
      add(body, 
        h('h2', 'Pick a daily goal'),
        h('p.small.muted', 'Small and daily beats big and rare. You can change it any time – and on a busy day, even 2 minutes keeps your streak.'),
        h('div.stack.tight', ...GOALS.map((g) => h('button.choice', {
          class: data.goal === g.xp ? 'selected' : '',
          onclick: () => { data.goal = g.xp; render(); },
        }, h('span.choice-key', g.label[0]), h('span', h('b', `${g.label} – ${g.xp} XP`), h('span.small.muted', ` ${g.note}`))))),
        h('button.btn.primary.big', { onclick: () => { step = 2; render(); } }, 'Next ▸'));
    } else {
      add(body, ...planForm(data, () => {
        update((s) => { s.settings.name = data.name.trim(); s.settings.dailyGoalXp = data.goal; });
        setPlan({ cue: data.cue, time: data.time, minutes: Math.round(data.goal / 10) });
        m.close();
        confetti(80);
        navigate('#/lesson/u01/intro');
      }, 'Start my first lesson ▸'));
    }
  };
  render();
  m = modal(body, { dismissable: false });
}

function planForm(data, onSave, saveLabel) {
  const cueSel = h('select.input', { onchange: (e) => { data.cue = e.target.value; custom.hidden = e.target.value !== '__custom'; } },
    ...CUES.map((c) => h('option', { value: c, selected: c === data.cue }, c)), h('option', { value: '__custom' }, 'something else…'));
  const custom = h('input.input', { placeholder: 'e.g. walk the dog', hidden: true, oninput: (e) => { data.cue = e.target.value; } });
  if (!CUES.includes(data.cue)) { cueSel.value = '__custom'; custom.hidden = false; custom.value = data.cue; }
  return [
    h('h2', 'Make it a habit'),
    h('p.small.muted', 'Link Norwegian to something you already do every day (“habit stacking”). Research on implementation intentions shows that deciding exactly when you’ll act roughly doubles follow-through.'),
    h('div.plan-sentence', 'After I ', cueSel, custom, ' I will practise Norwegian.'),
    h('label.small.muted', 'Around what time?'),
    h('input.input', { type: 'time', value: data.time, onchange: (e) => { data.time = e.target.value; } }),
    h('button.btn.ghost', {
      onclick: () => { download('norsk-reminder.ics', planIcs({ cue: data.cue, time: data.time, minutes: Math.round((data.goal || 100) / 10) }), 'text/calendar'); toast('Open the file to add a daily reminder to your calendar.', { icon: '🗓️' }); },
    }, '🗓️ Add daily reminder to my calendar'),
    h('button.btn.primary.big', { onclick: onSave }, saveLabel),
  ];
}

export function openPlanModal() {
  const g = getGame();
  const data = { cue: g.plan?.cue || CUES[0], time: g.plan?.time || '08:00', goal: settings().dailyGoalXp };
  let m;
  m = modal(h('div.stack', ...planForm(data, () => { setPlan({ cue: data.cue, time: data.time, minutes: Math.round(data.goal / 10) }); m.close(); toast('Plan saved. See you then!', { icon: '✅' }); navigate('#/'); }, 'Save plan')));
}
