// Word lookup for tap-to-translate: your own cards first, then course words,
// then the built-in glossary – trying inflected → dictionary forms.

import { DICTIONARY } from '../../data/dictionary.js';
import { UNITS } from '../../data/units.js';
import { allCards, lemmaKey } from './deck.js';
import { lemmaCandidates, words } from './text.js';

let courseIndex = null;
function course() {
  if (courseIndex) return courseIndex;
  courseIndex = new Map();
  for (const u of UNITS) {
    for (const w of u.words) {
      for (const variant of w.no.split('|')) {
        const k = lemmaKey(variant.replace(/…/g, '').trim());
        if (k && !courseIndex.has(k)) courseIndex.set(k, { ...w, unit: u.id });
      }
    }
  }
  return courseIndex;
}

export function dictHas(word) {
  return DICTIONARY.has(word) || course().has(word);
}

/**
 * @returns {{word, lemma, en, g, card, unit, source}|null}
 */
export function lookup(raw) {
  const word = String(raw).toLowerCase();
  const cards = allCards();
  const cardMap = new Map(cards.map((c) => [lemmaKey(c.no), c]));
  for (const cand of lemmaCandidates(word)) {
    const card = cardMap.get(cand);
    if (card) return { word, lemma: cand, en: card.en, g: card.g, card, unit: card.unit, source: 'card' };
    const cw = course().get(cand);
    if (cw) return { word, lemma: cand, en: cw.en, g: cw.g, card: null, unit: cw.unit, no: cw.no, source: 'course' };
    const d = DICTIONARY.get(cand);
    if (d) return { word, lemma: cand, en: d.en, g: d.g, card: null, source: 'dict', no: d.g ? `${d.g} ${d.no}` : d.no };
  }
  const n = parseNumberWord(word);
  if (n != null) return { word, lemma: word, en: `${n} (number)`, g: '', card: null, source: 'dict', no: word };
  return { word, lemma: word, en: '', g: '', card: null, source: 'none' };
}

export function lookupPhrase(text) {
  const ws = words(text);
  if (ws.length > 1) {
    const k = lemmaKey(text);
    const cw = course().get(k);
    if (cw) return { word: text, lemma: k, en: cw.en, source: 'course' };
    const d = DICTIONARY.get(k);
    if (d) return { word: text, lemma: k, en: d.en, source: 'dict' };
  }
  return lookup(ws[0] ?? text);
}

// Compound numbers are written as one word ("tjuefem" = 25, "åttifem" = 85).
const ONES = { en: 1, ett: 1, to: 2, tre: 3, fire: 4, fem: 5, seks: 6, sju: 7, syv: 7, åtte: 8, ni: 9 };
const TENS = { tjue: 20, tyve: 20, tretti: 30, førti: 40, femti: 50, seksti: 60, sytti: 70, åtti: 80, nitti: 90 };

/** "tjuefem" → 25, "åttifire" → 84; null if the word isn't a compound number. */
export function parseNumberWord(word) {
  const w = String(word).toLowerCase();
  for (const [t, tv] of Object.entries(TENS)) {
    if (w.startsWith(t) && w.length > t.length) {
      const rest = w.slice(t.length);
      if (ONES[rest]) return tv + ONES[rest];
    }
  }
  return null;
}

export const externalLinks = (word) => ({
  ordbokene: `https://ordbokene.no/nob/bm/${encodeURIComponent(word)}`,
  translate: `https://translate.google.com/?sl=no&tl=en&text=${encodeURIComponent(word)}&op=translate`,
});
