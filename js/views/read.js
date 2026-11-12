// Reading = comprehensible input. Short stories with every word tappable and
// coloured by what you already know.

import { h, clear, progressBar, sfx, add } from '../ui/dom.js';
import { tappable, speakBtn } from '../ui/components.js';
import { coverage, knowledgeMap } from '../core/deck.js';
import { speak, stopSpeaking } from '../core/speech.js';
import { addXp, unlock } from '../core/gamify.js';
import { getState, update } from '../core/store.js';
import { STORIES, storyById } from '../../data/stories.js';
import { UNITS } from '../../data/units.js';
import { nextStepBlock, flushCelebrations } from '../ui/celebrate.js';

const covClass = (p) => (p >= 0.95 ? 'easy' : p >= 0.85 ? 'ideal' : p >= 0.7 ? 'stretch' : 'hard');
const covLabel = (p) => (p >= 0.95 ? 'Easy read' : p >= 0.85 ? 'Ideal level' : p >= 0.7 ? 'A stretch' : 'Hard for now');

export function readHub(root) {
  const map = knowledgeMap();
  const s = getState();
  const list = h('div.stack');
  const withCov = STORIES.map((st) => ({ st, cov: coverage(st.sentences.map((x) => x[0]).join(' '), map).pct }));
  // Recommend the first unread story in the comprehensible zone (85-98 %)
  const rec = withCov.find((x) => !s.stories[x.st.id] && x.cov >= 0.85) ?? withCov.find((x) => !s.stories[x.st.id]);
  for (const { st, cov } of withCov) {
    const unitNo = UNITS.findIndex((u) => u.id === st.unit) + 1;
    add(list, h('a.card.story-item', { href: `#/read/story/${st.id}`, class: rec?.st === st ? 'recommended' : '' },
      h('div.row.between',
        h('div', h('div.strong', st.title), h('div.small.muted', `After unit ${unitNo} · ${st.level}${s.stories[st.id] ? ` · read ${s.stories[st.id].read}×` : ''}`)),
        h('div.cov', { class: covClass(cov) }, h('b', `${Math.round(cov * 100)}%`), h('span.small', covLabel(cov)))),
      rec?.st === st ? h('div.small.accent', '★ Recommended for you now') : null));
  }
  add(root, h('div.stack',
    h('a.back-link.sticky-back', { href: '#/learn' }, '‹ Course'),
    h('div.page-head', h('h1', 'Stories'), h('p.muted', 'The % is how much of the story you already know.')),
    list));
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
      if (playing) { playing = false; stopSpeaking(); playBtn.textContent = '▶ Read aloud'; return; }
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
    h('a.back-link.sticky-back', { href: '#/read' }, '‹ Stories'),
    h('div.small.muted', st.level),
    h('h1', st.title), covEl,
    h('div.row.wrap', playBtn, h('button.btn.ghost', { onclick: () => lines.querySelectorAll('.line-en').forEach((e) => e.classList.toggle('hidden')) }, 'Show/hide English')),
    h('p.small.muted', 'Try to get the gist first. Tap only the words that stop you from understanding.'),
    lines,
    h('button.btn.primary.big', {
      onclick: (e) => {
        const first = !getState().stories[st.id];
        update((s) => { const r = s.stories[st.id] ?? { read: 0 }; r.read++; r.last = Date.now(); s.stories[st.id] = r; });
        const xp = addXp(first ? 30 : 15, 'story');
        if (Object.keys(getState().stories).length >= 3) unlock('reader');
        sfx.goal();
        // Finish in place: celebrate, then offer the next part of today's plan.
        const done = h('div.card.stack.center-col.story-done',
          h('div.big-emoji', '📖'),
          h('h2', 'Ferdig!'),
          h('div.pill.xp', `+${xp} XP`),
          h('p.small.muted', `You read ${st.sentences.length} sentences of real Norwegian. Every story like this grows your vocabulary without flashcards.`),
          nextStepBlock('story'),
          h('div.row.wrap.center', h('a.btn', { href: '#/read' }, '← All stories'), h('a.btn', { href: '#/' }, 'Home')));
        e.currentTarget.replaceWith(done);
        done.scrollIntoView({ behavior: 'smooth', block: 'center' });
        flushCelebrations();
      },
    }, 'Finished reading ✓')));
  return () => { playing = false; stopSpeaking(); };
}
