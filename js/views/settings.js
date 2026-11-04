// Settings, backup and data management.

import { h, toast, download, confirmModal, add } from '../ui/dom.js';
import { settings, update, exportData, importData, resetAll } from '../core/store.js';
import { voiceCard } from './voice-settings.js';
import { MODELS } from '../core/tutor.js';
import { openPlanModal } from './onboarding.js';
import { navigate } from '../ui/router.js';

export function settingsView(root) {
  const s = settings();
  const set = (k, v) => update((st) => { st.settings[k] = v; });
  const field = (label, control, help) => h('label.field', h('span.field-label', label), control, help ? h('span.small.muted', help) : null);
  const num = (k, min, max, step = 1) => h('input.input', { type: 'number', min, max, step, value: s[k], onchange: (e) => set(k, Math.max(min, Math.min(max, Number(e.target.value) || s[k]))) });
  const check = (k) => h('input', { type: 'checkbox', checked: !!s[k], onchange: (e) => set(k, e.target.checked) });

  const retention = h('input', { type: 'range', min: 0.8, max: 0.95, step: 0.01, value: s.retention, oninput: (e) => { retLabel.textContent = `${Math.round(e.target.value * 100)}%`; }, onchange: (e) => set('retention', Number(e.target.value)) });
  const retLabel = h('b', `${Math.round(s.retention * 100)}%`);
  const fileIn = h('input', {
    type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { importData(await f.text()); toast('Backup restored.', { icon: '✅' }); navigate('#/'); } catch (err) { toast(err.message, { kind: 'warn' }); }
    },
  });

  add(root, h('div.stack.settings',
    h('div.page-head', h('h1', 'Innstillinger'), h('p.muted', 'Settings')),
    h('div.card.stack',
      h('div.kicker', '👤 You'),
      field('Your name', h('input.input', { value: s.name, onchange: (e) => set('name', e.target.value.trim()) }), 'Used in role-plays and by the AI partner.'),
      field('Daily goal', h('select.input', { onchange: (e) => set('dailyGoalXp', Number(e.target.value)) },
        ...[[50, 'Tiny – 50 XP (~5 min)'], [100, 'Regular – 100 XP (~10 min)'], [200, 'Serious – 200 XP (~20 min)'], [300, 'Intense – 300 XP (~30 min)']].map(([v, l]) => h('option', { value: v, selected: s.dailyGoalXp === v }, l)))),
      h('button.btn.ghost', { onclick: openPlanModal }, '🗓️ My habit plan & calendar reminder')),
    h('div.card.stack',
      h('div.kicker', '🧠 Learning'),
      field('New words per day', num('newPerDay', 1, 60), 'Keeps the load manageable. 10–20 is a good range; each new word adds future reviews.'),
      field('Max reviews per day', num('maxReviews', 20, 1000, 10)),
      field(h('span', 'Target recall ', retLabel), retention, 'Higher = more frequent reviews and better retention. 90% is the sweet spot for most people.'),
      field('Exercise style', h('select.input', { onchange: (e) => set('reviewMode', e.target.value) },
        h('option', { value: 'adaptive', selected: s.reviewMode === 'adaptive' }, 'Adaptive – gets harder as memories strengthen (recommended)'),
        h('option', { value: 'production', selected: s.reviewMode === 'production' }, 'Always produce Norwegian (hardest, best for speaking)'),
        h('option', { value: 'recognition', selected: s.reviewMode === 'recognition' }, 'Recognition only (easiest)'))),
      h('label.row', check('autoAdvance'), ' Flow mode: move on automatically after a correct typed answer'),
      h('label.row', check('autoplay'), ' Play audio automatically')),
    voiceCard({ s, set, field, check }),
    h('div.card.stack',
      h('div.kicker', '🤖 AI conversation partner (optional)'),
      field('Claude API key', h('input.input', { type: 'password', value: s.aiKey, placeholder: 'sk-ant-…', autocomplete: 'off', onchange: (e) => set('aiKey', e.target.value.trim()) }),
        'Stored only in this browser and sent only to api.anthropic.com. Not included in backups.'),
      field('Model', h('select.input', { onchange: (e) => set('aiModel', e.target.value) }, ...MODELS.map((m) => h('option', { value: m.id, selected: m.id === s.aiModel }, m.label))))),
    h('div.card.stack',
      h('div.kicker', '💾 Your data'),
      h('p.small.muted', 'Everything is saved in this browser only. Make a backup now and then – and use it to move your progress to another device.'),
      h('div.row.wrap',
        h('button.btn', { onclick: () => download(`norsk-backup-${new Date().toISOString().slice(0, 10)}.json`, exportData(), 'application/json') }, '⬇ Download backup'),
        h('button.btn', { onclick: () => fileIn.click() }, '⬆ Restore backup'), fileIn,
        h('button.btn.danger', { onclick: async () => { if (await confirmModal('Delete ALL progress, cards and settings in this browser? This cannot be undone.', { ok: 'Delete everything', danger: true })) { resetAll(); location.hash = '#/'; location.reload(); } } }, 'Reset everything'))),
    h('p.small.muted.center', 'Norsk Nå · open source · works offline once loaded')));
}
