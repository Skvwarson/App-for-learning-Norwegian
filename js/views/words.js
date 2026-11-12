// Browse and edit your cards.

import { h, clear, modal, confirmModal, toast, add } from '../ui/dom.js';
import { speakBtn, genderTag } from '../ui/components.js';
import { allCards, editCard, deleteCard, addCard, sched } from '../core/deck.js';
import { State, newSrsState, formatDelay } from '../core/fsrs.js';
import { normalize } from '../core/text.js';

const statusOf = (c) => (c.suspended ? 'suspended' : c.srs.state === State.New ? 'new' : c.srs.state === State.Review ? (c.srs.s >= 21 ? 'mature' : 'known') : 'learning');

export function wordsView(root) {
  let filter = 'all', q = '';
  const list = h('div.word-rows');
  const counts = h('div.chips');
  const render = () => {
    const cards = allCards().sort((a, b) => b.created - a.created);
    const by = { all: cards.length, new: 0, learning: 0, known: 0, mature: 0, suspended: 0 };
    for (const c of cards) by[statusOf(c)]++;
    add(clear(counts), ...Object.entries(by).map(([k, n]) => h('button.chip', { class: filter === k ? 'active' : '', onclick: () => { filter = k; render(); } }, `${k} ${n}`)));
    const nq = normalize(q);
    const shown = cards.filter((c) => (filter === 'all' || statusOf(c) === filter) && (!nq || normalize(c.no).includes(nq) || normalize(c.en).includes(nq)));
    clear(list);
    if (!shown.length) add(list, h('div.muted.card', cards.length ? 'Nothing matches.' : 'No words yet. Start Unit 1, or tap words while reading to add them.'));
    const now = Date.now();
    for (const c of shown.slice(0, 500)) {
      const st = statusOf(c);
      const r = c.srs.state === State.New ? null : sched().retrievabilityNow(c.srs, now);
      add(list, h('button.word-row', { onclick: () => editModal(c, render) },
        h('span.dot', { class: st }),
        h('span.wr-no.no', c.no, ' ', genderTag(c.g)),
        h('span.wr-en.muted', c.en),
        h('span.wr-due.small.muted', c.srs.state === State.New ? 'new' : c.srs.due <= now ? 'due' : `in ${formatDelay(c.srs.due - now)}`),
        r != null ? h('span.wr-r.small', { title: 'Estimated chance you remember it right now' }, `${Math.round(r * 100)}%`) : h('span.wr-r')));
    }
  };
  const search = h('input.input', { placeholder: 'Search…', oninput: (e) => { q = e.target.value; render(); } });
  add(root, h('div.stack',
    h('div.page-head.row.between', h('div', h('a.back-link', { href: '#/me' }, '‹ Me'), h('h1', 'My words'), h('p.muted', 'The % is how likely you are to remember a word right now.')),
      h('button.btn.primary.small', { onclick: () => editModal(null, render) }, '＋ Add')),
    search, counts, list));
  render();
}

function editModal(card, onSave) {
  const no = h('input.input', { value: card?.no ?? '', placeholder: 'Norwegian (e.g. en bil, å spise)' });
  const en = h('input.input', { value: card?.en ?? '', placeholder: 'Meaning' });
  const exNo = h('input.input', { value: card?.ex?.no ?? '', placeholder: 'Example sentence in Norwegian (optional, context helps!)' });
  const exEn = h('input.input', { value: card?.ex?.en ?? '', placeholder: 'Example translation (optional)' });
  const note = h('input.input', { value: card?.note ?? '', placeholder: 'Note, e.g. verb forms (optional)' });
  let m;
  const save = () => {
    if (!no.value.trim()) return;
    const ex = exNo.value.trim() ? { no: exNo.value.trim(), en: exEn.value.trim() } : null;
    if (card) editCard(card.id, { no: no.value.trim(), en: en.value.trim(), ex, note: note.value.trim() });
    else { const r = addCard({ no: no.value.trim(), en: en.value.trim(), ex, note: note.value.trim(), src: 'manual' }); if (!r.created) toast('That word is already in your deck.'); }
    m.close(); onSave();
  };
  m = modal(h('div.stack',
    h('div.row.between', h('div.kicker', card ? 'Edit card' : 'New card'), card ? speakBtn(card.no) : null),
    no, en, exNo, exEn, note,
    card ? h('div.small.muted', `Reviews: ${card.srs.reps} · lapses: ${card.srs.lapses} · stability: ${card.srs.s ? card.srs.s.toFixed(1) + ' days' : '-'} · source: ${card.src}`) : null,
    h('div.row.wrap.between',
      card ? h('div.row.wrap',
        h('button.btn.ghost.small', { onclick: () => { editCard(card.id, { suspended: !card.suspended }); m.close(); onSave(); } }, card.suspended ? 'Unsuspend' : 'Suspend'),
        h('button.btn.ghost.small', { onclick: async () => { if (await confirmModal('Reset learning progress for this card?')) { editCard(card.id, { srs: newSrsState(), seen: 0 }); m.close(); onSave(); } } }, 'Reset'),
        h('button.btn.ghost.small.danger', { onclick: async () => { if (await confirmModal(`Delete “${card.no}”?`, { ok: 'Delete', danger: true })) { deleteCard(card.id); m.close(); onSave(); } } }, 'Delete')) : h('span'),
      h('button.btn.primary', { onclick: save }, 'Save'))));
  setTimeout(() => (card ? en : no).focus(), 50);
}
