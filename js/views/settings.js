// Settings: the few things people actually change, plus backup. Learning
// tweaks sit folded away under "Advanced".

import { h, toast, download, confirmModal, add, clear } from '../ui/dom.js';
import { settings, update, exportData, importData, resetAll } from '../core/store.js';
import { voicesReady, voiceStatus, deviceTip, speak } from '../core/speech.js';
import { APP_VERSION } from '../core/version.js';
import { openPlanModal } from './onboarding.js';
import { navigate } from '../ui/router.js';

const TEST_SENTENCE = 'Hei! Vi sees i morgen.';

export function settingsView(root) {
  const s = settings();
  const set = (k, v) => update((st) => { st.settings[k] = v; });
  const field = (label, control, help) => h('label.field', h('span.field-label', label), control, help ? h('span.small.muted', help) : null);
  const toggle = (k, label) => h('label.toggle-row', h('span', label), h('input.switch', { type: 'checkbox', checked: !!s[k], onchange: (e) => set(k, e.target.checked) }));
  const num = (k, min, max, step = 1) => h('input.input', { type: 'number', min, max, step, value: s[k], onchange: (e) => set(k, Math.max(min, Math.min(max, Number(e.target.value) || s[k]))) });

  const applyTheme = (t) => {
    set('theme', t);
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  };
  const themeSeg = h('div.segmented', ...[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => h('button', {
    type: 'button', class: (s.theme || 'auto') === v ? 'on' : '',
    onclick: (e) => { applyTheme(v); themeSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); },
  }, l)));

  const voiceLine = h('div.small');
  const renderVoice = () => {
    const st = voiceStatus();
    add(clear(voiceLine), st.ok
      ? h('span', 'Voice: ', h('b', st.label))
      : h('span', h('b', st.label), h('br'), h('span.muted', deviceTip())));
  };
  renderVoice();
  voicesReady().then(renderVoice);

  const fileIn = h('input', {
    type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { importData(await f.text()); toast('Backup restored.', { icon: '✅' }); navigate('#/'); } catch (err) { toast(err.message, { kind: 'warn' }); }
    },
  });
  const retLabel = h('b', `${Math.round(s.retention * 100)}%`);

  add(root, h('div.stack.settings',
    h('div.page-head', h('a.back-link', { href: '#/me' }, '‹ Me'), h('h1', 'Settings')),
    h('div.card.stack',
      field('Your name', h('input.input', { value: s.name, onchange: (e) => set('name', e.target.value.trim()) })),
      field('Appearance', themeSeg),
      h('button.btn.ghost', { type: 'button', onclick: openPlanModal }, 'Daily reminder')),
    h('div.card.stack',
      h('div.kicker', 'Sound'),
      voiceLine,
      field('Speaking speed', h('input', { id: 'voice-rate', type: 'range', min: 0.6, max: 1.1, step: 0.05, value: s.ttsRate, onchange: (e) => set('ttsRate', Number(e.target.value)) })),
      h('button.btn', { type: 'button', onclick: () => speak(TEST_SENTENCE) }, '▶ Test voice'),
      toggle('autoplay', 'Play Norwegian automatically'),
      toggle('sound', 'Sound effects'),
      toggle('haptics', 'Vibration')),
    h('details.card.advanced',
      h('summary', h('b', 'Advanced')),
      h('div.stack',
        field('New words per day', num('newPerDay', 1, 60), '10–20 is a good range.'),
        field('Max reviews per day', num('maxReviews', 20, 1000, 10)),
        field(h('span', 'Target recall ', retLabel), h('input', { type: 'range', min: 0.8, max: 0.95, step: 0.01, value: s.retention, oninput: (e) => { retLabel.textContent = `${Math.round(e.target.value * 100)}%`; }, onchange: (e) => set('retention', Number(e.target.value)) }), 'Higher = more reviews, better memory. 90% is the sweet spot.'),
        field('Exercise style', h('select.input', { onchange: (e) => set('reviewMode', e.target.value) },
          h('option', { value: 'adaptive', selected: s.reviewMode === 'adaptive' }, 'Adaptive (recommended)'),
          h('option', { value: 'production', selected: s.reviewMode === 'production' }, 'Always type Norwegian (hardest)'),
          h('option', { value: 'recognition', selected: s.reviewMode === 'recognition' }, 'Multiple choice only (easiest)'))),
        toggle('autoAdvance', 'Move on automatically after a correct answer'))),
    h('div.card.stack',
      h('div.kicker', 'Your data'),
      h('p.small.muted', 'Progress is saved on this device. A backup moves it to another one.'),
      h('div.row.wrap',
        h('button.btn', { type: 'button', onclick: () => download(`norsk-backup-${new Date().toISOString().slice(0, 10)}.json`, exportData(), 'application/json') }, 'Download backup'),
        h('button.btn', { type: 'button', onclick: () => fileIn.click() }, 'Restore backup'), fileIn),
      h('button.btn.ghost.danger', { type: 'button', onclick: async () => { if (await confirmModal('Delete ALL progress on this device? This cannot be undone.', { ok: 'Delete everything', danger: true })) { resetAll(); location.hash = '#/'; location.reload(); } } }, 'Reset everything')),
    h('p.small.muted.center', `Norsk Nå · version ${APP_VERSION}`)));
}
