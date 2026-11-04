// Reading = comprehensible input. Stories and your imported textbooks, with
// every word tappable and coloured by what you already know.

import { h, clear, toast, progressBar, modal, confirmModal, sfx, add } from '../ui/dom.js';
import { tappable, speakBtn } from '../ui/components.js';
import { coverage, knowledgeMap, addCard } from '../core/deck.js';
import { speak } from '../core/speech.js';
import { addXp, unlock } from '../core/gamify.js';
import { getState, update, docs } from '../core/store.js';
import { externalLinks } from '../core/lexicon.js';
import { words } from '../core/text.js';
import { STORIES, storyById } from '../../data/stories.js';
import { UNITS } from '../../data/units.js';
import { navigate } from '../ui/router.js';

const covClass = (p) => (p >= 0.95 ? 'easy' : p >= 0.85 ? 'ideal' : p >= 0.7 ? 'stretch' : 'hard');
const covLabel = (p) => (p >= 0.95 ? 'Easy read' : p >= 0.85 ? 'Ideal level' : p >= 0.7 ? 'A stretch' : 'Hard for now');

export function readHub(root) {
  const map = knowledgeMap();
  const s = getState();
  const list = h('div.stack');
  const withCov = STORIES.map((st) => ({ st, cov: coverage(st.sentences.map((x) => x[0]).join(' '), map).pct }));
  // Recommend the first unread story in the comprehensible zone (85–98 %)
  const rec = withCov.find((x) => !s.stories[x.st.id] && x.cov >= 0.85) ?? withCov.find((x) => !s.stories[x.st.id]);
  for (const { st, cov } of withCov) {
    const unitNo = UNITS.findIndex((u) => u.id === st.unit) + 1;
    add(list, h('a.card.story-item', { href: `#/read/story/${st.id}`, class: rec?.st === st ? 'recommended' : '' },
      h('div.row.between',
        h('div', h('div.strong', st.title), h('div.small.muted', `After unit ${unitNo} · ${st.level}${s.stories[st.id] ? ` · read ${s.stories[st.id].read}×` : ''}`)),
        h('div.cov', { class: covClass(cov) }, h('b', `${Math.round(cov * 100)}%`), h('span.small', covLabel(cov)))),
      rec?.st === st ? h('div.small.accent', '★ Recommended for you now') : null));
  }
  const docList = h('div.stack');
  docs.list().then((ds) => {
    if (!ds.length) add(docList, h('div.card.muted.small', 'No textbooks yet. Import a PDF (or paste text) and read it here with tap-to-translate.'));
    for (const d of ds) {
      add(docList, h('div.card.row.between',
        h('a', { href: `#/read/doc/${d.id}/${d.lastPage ?? 0}` }, h('div.strong', '📄 ' + d.title), h('div.small.muted', `${d.pageCount} pages · ${d.pairs?.length ?? 0} vocabulary pairs found · ${Math.round(((d.stats?.no ?? 0) / Math.max(1, d.stats?.lines ?? 1)) * 100)}% Norwegian lines`)),
        h('button.icon-btn', {
          'aria-label': 'Delete document',
          onclick: async () => { if (await confirmModal(`Delete “${d.title}”? (Cards you made from it stay.)`, { ok: 'Delete', danger: true })) { await docs.delete(d.id); navigate('#/read'); } },
        }, '🗑')));
    }
  }).catch(() => add(docList, h('div.card.small.muted', 'Document storage (IndexedDB) is not available in this browser mode.')));

  add(root, h('div.stack',
    h('div.page-head', h('h1', 'Les'), h('p.muted', 'Lots of easy reading is how vocabulary grows on its own.')),
    h('div.card.tip.small',
      h('b', 'Colours: '), h('span.w.w-known', 'known'), ' · ', h('span.w.w-learning', 'learning'), ' · ', h('span.w.w-new', 'new'),
      h('div', 'The % shows how much of a text you already know. Research suggests ~95 % makes reading enjoyable and lets you pick up new words from context. Tap any word for its meaning – and add it to your deck in one tap.')),
    h('h2', 'Short stories'), list,
    h('div.row.between', h('h2', 'Your textbooks & texts'), h('a.btn.primary.small', { href: '#/import' }, '＋ Import')),
    docList));
}

export function storyView(root, { id }) {
  const st = storyById(id);
  if (!st) return;
  const text = st.sentences.map((x) => x[0]).join(' ');
  let cov = coverage(text);
  let playing = false;
  const covEl = h('div.cov-head');
  const renderCov = () => {
    cov = coverage(text);
    add(clear(covEl), h('div.row.between', h('span.small.muted', `You know ${Math.round(cov.pct * 100)}% of the words`), h('span.cov.small', { class: covClass(cov.pct) }, covLabel(cov.pct))), progressBar(cov.pct));
  };
  const lines = h('div.story');
  const renderLines = () => {
    clear(lines);
    st.sentences.forEach(([no, en], i) => {
      const enEl = h('div.line-en.hidden', en);
      add(lines, h('div.story-line', { dataset: { i } },
        h('div.no', tappable(no, { sentence: no, translation: en, src: `story:${st.id}`, onChange: () => { renderLines(); renderCov(); } })),
        h('div.story-tools', speakBtn(no), h('button.link.small', { onclick: () => enEl.classList.toggle('hidden') }, 'EN')),
        enEl));
    });
  };
  renderLines(); renderCov();
  const playBtn = h('button.btn', {
    onclick: async () => {
      if (playing) { playing = false; speechSynthesis?.cancel(); playBtn.textContent = '▶ Read aloud'; return; }
      playing = true; playBtn.textContent = '■ Stop';
      const rows = [...lines.children];
      for (let i = 0; i < st.sentences.length && playing; i++) {
        rows.forEach((r) => r.classList.toggle('playing', r === rows[i]));
        await speak(st.sentences[i][0]);
      }
      rows.forEach((r) => r.classList.remove('playing'));
      playing = false; playBtn.textContent = '▶ Read aloud';
    },
  }, '▶ Read aloud');
  add(root, h('div.stack.reader',
    h('div.row.between', h('a.btn.ghost.small', { href: '#/read' }, '← Stories'), h('span.small.muted', st.level)),
    h('h1', st.title), covEl,
    h('div.row.wrap', playBtn, h('button.btn.ghost', { onclick: () => lines.querySelectorAll('.line-en').forEach((e) => e.classList.toggle('hidden')) }, 'Show/hide English')),
    h('p.small.muted', 'Try to get the gist first. Tap only the words that stop you from understanding.'),
    lines,
    h('button.btn.primary.big', {
      onclick: () => {
        const first = !getState().stories[st.id];
        update((s) => { const r = s.stories[st.id] ?? { read: 0 }; r.read++; r.last = Date.now(); s.stories[st.id] = r; });
        const xp = addXp(first ? 30 : 15, 'story');
        if (Object.keys(getState().stories).length >= 3) unlock('reader');
        sfx.goal();
        toast(`Ferdig! +${xp} XP`, { icon: '📖' });
        navigate('#/read');
      },
    }, 'Finished reading ✓')));
  return () => { playing = false; speechSynthesis?.cancel(); };
}

export function docView(root, { id, page }) {
  const pi = Math.max(0, Number(page) || 0);
  const wrap = h('div.stack.reader');
  add(root, wrap);
  let hideEn = (() => { try { return localStorage.getItem('nn.hideEn') === '1'; } catch { return false; } })();
  docs.get(id).then((doc) => {
    if (!doc) { add(wrap, h('p', 'Document not found.')); return; }
    doc.lastPage = pi; docs.put(doc);
    const lines = doc.pages[pi] ?? [];
    const noText = lines.filter((l) => l.lang !== 'en').map((l) => l.t).join(' ');
    const cov = coverage(noText);
    const pagePairs = (doc.pairs ?? []).filter((p) => p.page === pi);
    const nav = h('div.row.between.page-nav',
      h('a.btn.small', { href: `#/read/doc/${id}/${Math.max(0, pi - 1)}`, class: pi === 0 ? 'disabled' : '' }, '←'),
      h('select.input.small', { onchange: (e) => navigate(`#/read/doc/${id}/${e.target.value}`) },
        ...doc.pages.map((_, i) => h('option', { value: i, selected: i === pi }, `Page ${i + 1} / ${doc.pages.length}`))),
      h('a.btn.small', { href: `#/read/doc/${id}/${Math.min(doc.pages.length - 1, pi + 1)}`, class: pi >= doc.pages.length - 1 ? 'disabled' : '' }, '→'));
    const body = h('div.doc-page');
    for (const l of lines) {
      if (l.lang === 'en') {
        if (!hideEn) add(body, h('div.doc-line.en-line', l.t));
        continue;
      }
      add(body, h('div.doc-line', { class: l.lang === 'no' ? 'no-line' : '' },
        h('span.no', tappable(l.t.replace(/\t/g, '   '), { sentence: l.t, src: `pdf:${id}`, onChange: () => navigate(`#/read/doc/${id}/${pi}`) })),
        l.lang === 'no' && words(l.t).length >= 3 ? h('span.line-tools',
          speakBtn(l.t),
          h('button.icon-btn.small', { title: 'Save this sentence as a card', onclick: () => saveSentence(l.t, id) }, '＋')) : null));
    }
    if (!lines.length) add(body, h('p.muted', 'This page has no extractable text. (Scanned pages need OCR first.)'));
    add(wrap, 
      h('div.row.between', h('a.btn.ghost.small', { href: '#/read' }, '← Library'), h('span.small.muted.ellipsis', doc.title)),
      h('div.cov-head', h('div.row.between', h('span.small.muted', `Page coverage: ${Math.round(cov.pct * 100)}% known`),
        h('label.small.row', h('input', { type: 'checkbox', checked: hideEn, onchange: (e) => { try { localStorage.setItem('nn.hideEn', e.target.checked ? '1' : '0'); } catch { /* */ } navigate(`#/read/doc/${id}/${pi}`); } }), ' Norwegian only')),
      progressBar(cov.pct)),
      nav,
      pagePairs.length ? pairsPanel(pagePairs, id) : null,
      body,
      cov.unknown.length ? h('details.card.small', h('summary', `Most frequent new words on this page (${cov.unknown.length})`),
        h('div.chips', ...cov.unknown.slice(0, 30).map((u) => h('span.chip', `${u.w}${u.n > 1 ? ` ×${u.n}` : ''}`)))) : null,
      nav.cloneNode(true));
    // cloned nav loses the select's listener – re-wire it
    const sel = wrap.querySelectorAll('.page-nav select')[1];
    sel?.addEventListener('change', (e) => navigate(`#/read/doc/${id}/${e.target.value}`));
  });
}

function pairsPanel(pairs, docId) {
  const rows = pairs.map((p) => {
    const cb = h('input', { type: 'checkbox', checked: true });
    return { p, cb, el: h('label.pair-row', cb, h('span.no', p.no), h('span.muted', ' – '), h('span', p.en)) };
  });
  return h('details.card.pairs', { open: true },
    h('summary', h('b', `📇 ${pairs.length} vocabulary pair${pairs.length > 1 ? 's' : ''} found on this page`)),
    h('div.stack.tight', ...rows.map((r) => r.el)),
    h('div.row.end', h('button.btn.primary.small', {
      onclick: (e) => {
        let n = 0;
        for (const r of rows) if (r.cb.checked) { if (addCard({ no: r.p.no, en: r.p.en, ex: r.p.ex ? { no: r.p.ex, en: '' } : null, src: `pdf:${docId}` }).created) n++; }
        toast(n ? `Added ${n} cards. They’ll be introduced a few per day.` : 'These are already in your deck.', { icon: '📇' });
        e.currentTarget.disabled = true;
      },
    }, 'Add selected to my deck')));
}

function saveSentence(sentence, docId) {
  const en = h('input.input', { placeholder: 'Meaning (optional – writing it yourself helps memory)' });
  let m;
  m = modal(h('div.stack',
    h('div.kicker', 'Save sentence'),
    h('div.no', sentence),
    en,
    h('a.small', { href: externalLinks(sentence).translate, target: '_blank', rel: 'noopener' }, 'Need help? Open in Google Translate ↗'),
    h('div.row.end', h('button.btn.ghost', { onclick: () => m.close() }, 'Cancel'),
      h('button.btn.primary', { onclick: () => { addCard({ no: sentence, en: en.value.trim(), src: `pdf:${docId}`, pos: 'sentence' }); toast('Sentence saved.', { icon: '＋' }); m.close(); } }, 'Save'))));
  setTimeout(() => en.focus(), 50);
}
