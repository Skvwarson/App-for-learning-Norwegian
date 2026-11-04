// Text utilities for Norwegian (Bokmål): tokenising, answer checking,
// rough lemmatisation and language detection. Pure functions – no DOM.

const WORD_RE = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;

export function normalize(s) {
  return String(s ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»„"]/g, '')
    .replace(/[.,!?;:…()[\]{}¡¿/\\*_~]+/g, ' ')
    .replace(/\s[-–—]+\s/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** æ→ae, ø→o, å→a, é→e … so we can recognise "almost right, check the letters". */
export function foldDiacritics(s) {
  return s
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .normalize('NFD').replace(/\p{M}/gu, '');
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Word-level edit distance (for whole sentences). */
function tokenDistance(a, b) {
  const x = a.split(' '), y = b.split(' ');
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      const same = x[i - 1] === y[j - 1] || levenshtein(x[i - 1], y[j - 1]) <= (y[j - 1].length > 5 ? 1 : 0);
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (same ? 0 : 1));
    }
    prev = cur;
  }
  return { dist: prev[y.length], len: Math.max(x.length, y.length) };
}

/** "takk (skal du ha)" → ["takk skal du ha", "takk"] */
export function expandOptional(s) {
  const m = s.match(/\(([^()]*)\)/);
  if (!m) return [s];
  const withPart = s.replace(m[0], m[1]);
  const without = s.replace(m[0], '');
  return [...expandOptional(withPart), ...expandOptional(without)];
}

const ARTICLES = /^(en|ei|et|å)\s+/;

/** All acceptable normalised forms for an expected answer (+ alternatives). */
export function answerVariants(expected, alts = []) {
  const set = new Set();
  for (const raw of [expected, ...alts]) {
    for (const opt of String(raw).split('|')) {
      for (const v of expandOptional(opt)) {
        const n = normalize(v);
        if (!n) continue;
        set.add(n);
        set.add(n.replace(ARTICLES, ''));
      }
    }
  }
  return [...set];
}

/**
 * Compare a learner's answer with the expected one.
 * verdict: 'correct' | 'almost' | 'wrong'
 */
export function checkAnswer(input, expected, alts = []) {
  const given = normalize(input);
  const variants = answerVariants(expected, alts);
  if (!given) return { verdict: 'wrong', note: '' };
  const givenBare = given.replace(ARTICLES, '');
  if (variants.includes(given) || variants.includes(givenBare)) {
    return { verdict: 'correct', note: '' };
  }
  // Same apart from æ/ø/å or accents?
  const fGiven = foldDiacritics(givenBare);
  for (const v of variants) {
    if (foldDiacritics(v) === fGiven) {
      return { verdict: 'almost', note: 'Nearly! Check the special letters æ, ø, å.' };
    }
  }
  let best = Infinity, bestV = variants[0] ?? '';
  for (const v of variants) {
    const d = levenshtein(fGiven, foldDiacritics(v));
    if (d < best) { best = d; bestV = v; }
  }
  const len = bestV.length;
  const tolerance = len >= 12 ? 2 : len >= 4 ? 1 : 0;
  if (best <= tolerance) return { verdict: 'almost', note: 'Small spelling slip – compare carefully.' };
  if (bestV.includes(' ')) {
    const { dist, len: tl } = tokenDistance(fGiven, foldDiacritics(bestV));
    if (tl >= 4 && dist / tl <= 0.2) return { verdict: 'almost', note: 'Very close – one word differs.' };
  }
  return { verdict: 'wrong', note: '' };
}

/** Similarity 0–1 between two sentences (used for speaking/role-play). */
export function similarity(a, b) {
  const x = foldDiacritics(normalize(a)), y = foldDiacritics(normalize(b));
  if (!x || !y) return 0;
  if (x === y) return 1;
  const { dist, len } = tokenDistance(x, y);
  const tokenSim = 1 - dist / len;
  const charSim = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  return Math.max(tokenSim, charSim);
}

/** Split text into renderable tokens: {t, word:boolean}. */
export function tokenize(text) {
  const out = [];
  let last = 0;
  for (const m of String(text).matchAll(WORD_RE)) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), word: false });
    out.push({ t: m[0], word: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), word: false });
  return out;
}

export function words(text) {
  return (String(text).match(WORD_RE) ?? []).map((w) => w.toLowerCase());
}

export function splitSentences(text) {
  const parts = [];
  let buf = '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  for (let i = 0; i < s.length; i++) {
    buf += s[i];
    if (/[.!?…]/.test(s[i])) {
      const rest = s.slice(i + 1);
      const m = rest.match(/^["»”)]*\s+(?=["«“(]?[\p{Lu}\d–-])/u);
      if (m) {
        buf += m[0].replace(/\s+$/, '');
        i += m[0].length;
        parts.push(buf.trim());
        buf = '';
      }
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

/**
 * Candidate dictionary forms for an inflected Norwegian word.
 * Over-generates on purpose – the caller keeps the first one found in a dictionary.
 * bilene→bil, jenta→jente, snakket→snakke, spiste→spise, stort→stor, bor→bo …
 */
export function lemmaCandidates(word) {
  const w = word.toLowerCase().replace(/['’]s$/, '');
  const out = [w];
  const add = (x) => { if (x.length >= 2 && !out.includes(x)) out.push(x); };
  const rules = [
    ['ene', ['', 'e']], ['ane', ['', 'e']], ['ers', ['e', '']], ['ere', ['', 'e']], ['est', ['', 'e']],
    ['dde', ['']], ['tte', ['', 'e']], ['te', ['e', '']], ['de', ['e', '']], ['et', ['e', '']],
    ['en', ['', 'e']], ['er', ['e', '']], ['ne', ['']], ['a', ['e', '']], ['e', ['']],
    ['r', ['']], ['t', ['']], ['n', ['']], ['s', ['']],
  ];
  for (const [suf, repl] of rules) {
    if (w.length > suf.length + 1 && w.endsWith(suf)) {
      const stem = w.slice(0, -suf.length);
      for (const r of repl) add(stem + r);
      // doubled consonant: mannen → mann, kommer → komme, takket → takke
      if (/(.)\1$/.test(stem)) for (const r of repl) add(stem.slice(0, -1) + r);
    }
  }
  return out;
}

// --- Language detection --------------------------------------------------

const NO_COMMON = new Set(`og i jeg det er ikke på en et ei til med som har for av du vi de han hun den kan skal vil må så
hva hvor hvordan hvem hvorfor når meg deg seg oss dere dem min mitt mine din ditt dine sin sitt sine vår vårt våre også
bare veldig mye nå her der fra om men eller at nei ja takk hei liker heter bor kommer snakker går gjør var hadde blir ble
etter før under over mellom hos uten mot litt noen noe ingen alle hver godt god gode dag morgen kveld natt jobb hjemme
skole norsk norge engelsk spise drikke kaffe vann hus bil barn mann kvinne jente gutt by gate butikk penger klokka
klokken tid uke år måned flere mange får fikk sier sa tror synes vet kjenner ser så hører kanskje egentlig ganske
hvis fordi derfor likevel dessverre gjerne unnskyld hyggelig ha sees velkommen`.split(/\s+/));

const EN_COMMON = new Set(`the and is are of to in you it this that with on be as at by we they he she not what how where my
your have has was were will can a an or but from which word words exercise chapter lesson translate means meaning
example examples verb verbs noun nouns adjective grammar answer answers following sentence sentences write read listen
these those there their them his her its our would should could do does did been being into than then also only very
when who why use used using form forms please note page english norwegian dialogue vocabulary present past tense`.split(/\s+/));

/** Returns {lang: 'no'|'en'|'mixed'|'?', no, en} for a line of text. */
export function detectLanguage(line, dictHas = () => false) {
  const toks = String(line).match(WORD_RE) ?? [];
  let no = 0, en = 0;
  for (const raw of toks) {
    const t = raw.toLowerCase();
    if (/[æøå]/.test(t)) no += 2;
    if (raw === 'I') { en += 1; continue; }
    const isNo = NO_COMMON.has(t) || dictHas(t);
    const isEn = EN_COMMON.has(t);
    if (isNo && !isEn) no += 1;
    else if (isEn && !isNo) en += 1;
  }
  if (!toks.length || no + en === 0) return { lang: '?', no, en };
  if (no >= 1.5 * en && no >= 1) return { lang: 'no', no, en };
  if (en >= 1.5 * no && en >= 1) return { lang: 'en', no, en };
  return { lang: 'mixed', no, en };
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function slug(s) {
  return foldDiacritics(normalize(s)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

/** Build a cloze: replace the first occurrence of `target` (or its inflection) in `sentence`. */
export function makeCloze(sentence, target) {
  // "Det blir … kroner." / "Jeg synes (at) …" → test the fixed part before the slot.
  let t = String(target).split('|')[0];
  if (t.includes('…')) t = t.split('…')[0];
  t = t.replace(/\([^)]*\)/g, ' ');
  const tWords = words(t);
  // Only a *leading* article / infinitive marker is optional: "en bil" → bil, "å spise" → spise.
  if (tWords.length > 1 && ['en', 'ei', 'et', 'å'].includes(tWords[0])) tWords.shift();
  if (!tWords.length) return null;
  const toks = tokenize(sentence);
  // Multi-word target: find a contiguous run
  const wordIdx = toks.map((t, i) => (t.word ? i : -1)).filter((i) => i >= 0);
  const lowered = wordIdx.map((i) => toks[i].t.toLowerCase());
  const matches = (a, b) => a === b || lemmaCandidates(a).includes(b) || (a.length > 3 && b.length > 3 &&
    (a.startsWith(b.slice(0, Math.max(3, b.length - 2))) || b.startsWith(a.slice(0, Math.max(3, a.length - 2)))));
  for (let k = 0; k + tWords.length <= lowered.length; k++) {
    let ok = true;
    for (let j = 0; j < tWords.length; j++) if (!matches(lowered[k + j], tWords[j])) { ok = false; break; }
    if (ok) {
      const startTok = wordIdx[k], endTok = wordIdx[k + tWords.length - 1];
      const answer = toks.slice(startTok, endTok + 1).map((t) => t.t).join('');
      const before = toks.slice(0, startTok).map((t) => t.t).join('');
      const after = toks.slice(endTok + 1).map((t) => t.t).join('');
      return { before, answer, after };
    }
  }
  return null;
}

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
