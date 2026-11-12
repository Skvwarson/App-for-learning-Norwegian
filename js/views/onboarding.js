// First-run onboarding and the habit plan (implementation intention + calendar reminder).

import { h, modal, download, toast, confetti, add } from '../ui/dom.js';
import { update, settings } from '../core/store.js';
import { getGame, setPlan, planIcs } from '../core/gamify.js';
import { navigate } from '../ui/router.js';
import { startTour } from '../ui/tour.js';

const CUES = ['have my morning coffee', 'sit down on the bus/train', 'eat lunch', 'get home from work', 'brush my teeth at night'];

export function maybeOnboard() {
  if (getGame().onboarded) {
    // Already set up but never saw the tour (e.g. from before it existed): show it once on Today.
    if (!getGame().toured && (location.hash === '' || location.hash === '#/')) startTour();
    return;
  }
  let name = settings().name || '';
  let m;
  const start = () => {
    update((s) => { s.settings.name = name.trim(); });
    setPlan(getGame().plan);
    m.close();
    confetti(80);
    navigate('#/');
    setTimeout(() => startTour(), 500); // then a quick tour of Today
  };
  m = modal(h('div.onboard.stack',
    h('div.big-emoji', '🇳🇴'),
    h('h2', 'Welcome to Norsk Nå'),
    h('p', 'Learn to speak Norwegian in about 10 minutes a day. Press one button, and the app does the rest.'),
    h('label.small.muted', 'What’s your first name?'),
    h('input.input#ob-name', { value: name, placeholder: 'Your first name', oninput: (e) => { name = e.target.value; } }),
    h('button.btn.primary.big', { onclick: start }, 'Continue')), { dismissable: false });
}

function planForm(data, onSave, saveLabel) {
  const cueSel = h('select.input', { onchange: (e) => { data.cue = e.target.value; custom.hidden = e.target.value !== '__custom'; } },
    ...CUES.map((c) => h('option', { value: c, selected: c === data.cue }, c)), h('option', { value: '__custom' }, 'something else…'));
  const custom = h('input.input', { placeholder: 'e.g. walk the dog', hidden: true, oninput: (e) => { data.cue = e.target.value; } });
  if (!CUES.includes(data.cue)) { cueSel.value = '__custom'; custom.hidden = false; custom.value = data.cue; }
  return [
    h('h2', 'Daily reminder'),
    h('p.small.muted', 'Tie Norwegian to something you already do every day. It’s the easiest way to never forget.'),
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
