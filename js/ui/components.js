// Reusable learning widgets: tappable Norwegian text with glosses, answer
// input with microphone, word tiles, multiple choice, rating buttons.

import { h, clear, modal, toast, sfx, haptic, add } from './dom.js';
import { tokenize, normalize, words, escapeHtml, similarity } from '../core/text.js';
import { speak, listen, listenBlocker, stopListening } from '../core/speech.js';
import { lookup, externalLinks } from '../core/lexicon.js';
import { addCard, wordStatus, knowledgeMap, markKnown, previewRatings, lemmaKey } from '../core/deck.js';
import { formatDelay } from '../core/fsrs.js';
import { getGame, unlock } from '../core/gamify.js';
import { update } from '../core/store.js';

export const speakBtn = (text, opts = {}) => h('button.icon-btn.speak', {
  type: 'button', title: 'Listen', 'aria-label': 'Listen',
  onclick: (e) => { e.stopPropagation(); speak(text, opts); },
}, '🔊');

/**
 * Norwegian text where every word can be tapped for a gloss.
 * Words are coloured by what you know (comprehensible input made visible).
 */
export function tappable(text, { sentence = text, translation = '', src = 'reader', mark = true, onChange } = {}) {
  const map = knowledgeMap();
  const wrap = h('span.tap-text');
  for (const tok of tokenize(text)) {
    if (!tok.word) { add(wrap, tok.t); continue; }
    const st = mark ? wordStatus(tok.t, map) : null;
    const el = h('span.w', {
      class: st ? `w-${st}` : (mark ? 'w-new' : ''), tabindex: '0', role: 'button',
      onclick: (e) => { e.stopPropagation(); wordSheet(tok.t, { sentence, translation, src, onChange }); },
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); wordSheet(tok.t, { sentence, translation, src, onChange }); } },
    }, tok.t);
    add(wrap, el);
  }
  return wrap;
}

/** Bottom sheet with the meaning of a word + "add to deck" (sentence mining). */
export function wordSheet(word, { sentence = '', translation = '', src = 'reader', onChange } = {}) {
  const info = lookup(word);
  speak(word);
  const lemmaDisplay = info.no || info.lemma;
  const meaning = h('input.input', { value: info.en, placeholder: 'Write the meaning in your own words', 'aria-label': 'Meaning' });
  const formNo = h('input.input', { value: info.source === 'none' ? word.toLowerCase() : lemmaDisplay, 'aria-label': 'Norwegian form to learn' });
  const st = wordStatus(word);
  let m;
  const body = h('div.sheet.stack',
    h('div.row.between',
      h('div', h('div.sheet-word', word), info.lemma !== word.toLowerCase() && info.source !== 'none' ? h('div.muted.small', `→ ${lemmaDisplay}`) : null),
      speakBtn(word)),
    info.en ? h('div.sheet-gloss', info.en) : h('div.muted', 'Not in the built-in glossary – look it up below and write the meaning yourself (writing it yourself helps you remember: the generation effect).'),
    sentence && sentence !== word ? h('div.sheet-context', h('span.muted.small', 'Context: '), h('span.no', sentence)) : null,
    info.card
      ? h('div.pill.ok', `✓ In your deck · ${info.card.srs.state === 2 ? 'known' : 'learning'}`)
      : h('div.stack.tight',
        h('label.small.muted', 'Learn as'), formNo,
        h('label.small.muted', 'Meaning'), meaning,
        h('button.btn.primary', {
          onclick: () => {
            if (!formNo.value.trim()) return;
            const { created } = addCard({
              no: formNo.value.trim(), en: meaning.value.trim(), g: info.g,
              ex: sentence && sentence !== word ? { no: sentence, en: translation } : null, src,
            });
            if (created) {
              update((s) => { s.game ??= {}; s.game.mined = (s.game.mined || 0) + 1; });
              if ((getGame().mined || 0) >= 10) unlock('miner');
              toast(`Added “${formNo.value.trim()}” – it will be introduced in your next session.`, { icon: '➕' });
              sfx.tap(); haptic(8);
            } else toast('Already in your deck.');
            m.close(); onChange?.();
          },
        }, '＋ Add to my deck')),
    h('div.row.wrap',
      h('button.btn.ghost.small', {
        onclick: () => { markKnown(info.lemma, st !== 'known'); m.close(); onChange?.(); },
      }, st === 'known' ? 'Mark as not known' : '✓ I already know this'),
      h('a.btn.ghost.small', { href: externalLinks(info.lemma).ordbokene, target: '_blank', rel: 'noopener' }, 'Ordbøkene ↗'),
      h('a.btn.ghost.small', { href: externalLinks(sentence || word).translate, target: '_blank', rel: 'noopener' }, 'Translate ↗')),
  );
  m = modal(body, { cls: 'bottom' });
}

/** Text input with optional microphone. onSubmit(value, alternatives) */
/** expected: string or () => string – when given, a spoken answer also shows a % match. */
export function answerInput({ placeholder = 'Type in Norwegian…', onSubmit, mic = true, autofocus = true, expected } = {}) {
  const input = h('input.input.answer', {
    placeholder, autocomplete: 'off', autocapitalize: 'off', spellcheck: false, lang: 'nb',
    onkeydown: (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit(); } },
  });
  let alts = [];
  const submit = () => onSubmit?.(input.value, alts);
  const letters = h('div.letters', ...['æ', 'ø', 'å'].map((c) => h('button.key', {
    type: 'button', tabindex: '-1',
    onmousedown: (e) => e.preventDefault(),
    onclick: () => { const p = input.selectionStart ?? input.value.length; input.value = input.value.slice(0, p) + c + input.value.slice(input.selectionEnd ?? p); input.focus(); input.setSelectionRange(p + 1, p + 1); },
  }, c)));
  // What the microphone heard, and how close it was to the expected answer.
  const heard = h('div.heard.small', { 'aria-live': 'polite' });
  const micBtn = mic ? h('button.icon-btn.mic', {
    type: 'button', title: 'Answer by speaking', 'aria-label': 'Speak your answer',
    onclick: async () => {
      const blocker = listenBlocker();
      if (blocker) { clear(heard); add(heard, h('span.bad', blocker), ' ', h('a', { href: '#/settings' }, 'Open Settings')); return; }
      if (micBtn.classList.contains('live')) { stopListening(); return; } // second tap = done talking
      micBtn.classList.add('live');
      const state = (s) => {
        clear(heard);
        add(heard, h('span.listening', s === 'processing' ? '⏳ Checking what you said…' : '🎙 Listening… speak now (tap 🎙 again when done)'));
      };
      try {
        alts = await listen({ onState: state });
        clear(heard);
        if (alts.length) {
          const exp = typeof expected === 'function' ? expected() : expected;
          const score = exp ? Math.round(Math.max(...alts.map((a) => similarity(a, exp))) * 100) : null;
          add(heard, '🎙 Heard: ', h('b.no', `«${alts[0]}»`),
            score != null ? h('span.match', { class: score >= 85 ? 'good' : score >= 60 ? 'fair' : 'low' }, ` · ${score}% match`) : null);
          input.value = alts[0];
          submit();
        } else {
          add(heard, '🎙 I didn’t catch that – try again, a little louder and closer to the microphone.');
        }
      } catch (e) {
        clear(heard); add(heard, h('span.bad', e.message));
      }
      micBtn.classList.remove('live');
    },
  }, '🎙') : null;
  const el = h('div.answer-row', input, micBtn, h('button.btn.primary', { type: 'button', onclick: submit }, 'Check'));
  if (autofocus) {
    // Focus as soon as the caller has inserted the field – still inside the tap that led here,
    // so phones open the keyboard (iOS ignores focus() from a timer). The timer is a fallback.
    queueMicrotask(() => { if (input.isConnected) input.focus({ preventScroll: true }); });
    setTimeout(() => { if (input.isConnected && !input.disabled && document.activeElement !== input) input.focus({ preventScroll: true }); }, 60);
  }
  return { el: h('div.stack.tight', el, heard, letters), input, setDisabled: (d) => { input.disabled = d; el.querySelectorAll('button').forEach((b) => (b.disabled = d)); } };
}

/** Word-order tiles. onCheck(string) */
export function tilesWidget(tilesIn, { onCheck, shuffleFn } = {}) {
  const tiles = shuffleFn ? shuffleFn(tilesIn) : tilesIn;
  const answer = h('div.tile-answer', { 'aria-label': 'Your sentence' });
  const pool = h('div.tile-pool');
  const chosen = [];
  const render = () => {
    clear(answer); clear(pool);
    chosen.forEach((i, pos) => add(answer, h('button.tile.in', { type: 'button', onclick: () => { chosen.splice(pos, 1); sfx.tap(); render(); } }, tiles[i])));
    tiles.forEach((t, i) => { if (!chosen.includes(i)) add(pool, h('button.tile', { type: 'button', onclick: () => { chosen.push(i); sfx.tap(); render(); } }, t)); });
    if (!chosen.length) add(answer, h('span.muted.small', 'Tap the words in the right order'));
  };
  render();
  const check = h('button.btn.primary', { type: 'button', onclick: () => onCheck?.(chosen.map((i) => tiles[i]).join(' ')) }, 'Check');
  return { el: h('div.stack', answer, pool, h('div.row.end', check)), disable: () => { check.disabled = true; answer.querySelectorAll('button').forEach((b) => (b.disabled = true)); pool.querySelectorAll('button').forEach((b) => (b.disabled = true)); } };
}

/** Multiple choice. onPick(option, index) */
export function choicesWidget(options, { onPick, render = (o) => o } = {}) {
  const el = h('div.choices');
  const buttons = options.map((o, i) => h('button.choice', {
    type: 'button',
    onclick: () => { buttons.forEach((b) => (b.disabled = true)); onPick?.(o, i, buttons[i]); },
  }, h('span.choice-key', String(i + 1)), h('span', render(o))));
  add(el, ...buttons);
  const key = (e) => { const n = Number(e.key); if (n >= 1 && n <= options.length && !buttons[n - 1].disabled) { buttons[n - 1].click(); } };
  document.addEventListener('keydown', key);
  return { el, buttons, destroy: () => document.removeEventListener('keydown', key) };
}

/** Again / Hard / Good / Easy buttons showing the next interval. onRate(rating) */
export function ratingBar(card, { suggested = 0, onRate, now = Date.now() } = {}) {
  const p = previewRatings(card, now);
  const labels = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
  const el = h('div.rate-bar');
  for (const g of [1, 2, 3, 4]) {
    add(el, h('button.rate', {
      type: 'button', class: `r${g}${g === suggested ? ' suggested' : ''}`,
      onclick: () => onRate(g),
    }, h('span.rate-label', labels[g]), h('span.rate-ivl', formatDelay(p[g].delayMs)), h('span.rate-key', String(g))));
  }
  return el;
}

/** Word-level diff: highlights words that differ from the expected answer. */
export function diffView(given, expected) {
  const a = normalize(given).split(' ').filter(Boolean);
  const bRaw = String(expected).split('|')[0].replace(/[()]/g, '').split(/\s+/).filter(Boolean);
  const b = bRaw.map((w) => normalize(w));
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const keep = new Set();
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) { keep.add(j); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return h('span.diff', ...bRaw.map((w, j) => [h('span', { class: keep.has(j) ? 'same' : 'changed' }, w), ' ']));
}

export function genderTag(g) {
  return g ? h('span.gender', { class: `g-${g}` }, g) : null;
}

export function posHint(card) {
  const bits = [];
  if (card.pos && !['phrase', 'word'].includes(card.pos)) bits.push(card.pos);
  if (card.g) bits.push(`${card.g}-word`);
  return bits.join(' · ');
}

export function htmlSafe(s) { return escapeHtml(s); }
export { words, lemmaKey };
