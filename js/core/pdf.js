// Import textbooks: extract text from PDFs (pdf.js, runs locally – your file
// never leaves your device), rebuild lines, detect Norwegian vs English and
// find glossary pairs like "et hus – a house" to turn into flashcards.

import { detectLanguage, makeCloze, words, normalize, lemmaCandidates } from './text.js';

let pdfjsPromise = null;
function pdfjs() {
  pdfjsPromise ??= import('../../vendor/pdfjs/pdf.min.mjs').then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    return lib;
  });
  return pdfjsPromise;
}

/** Group pdf.js text items into visual lines. Large horizontal gaps become tabs (table columns). */
export function itemsToLines(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4], y = it.transform[5];
    const hgt = Math.abs(it.transform[3]) || it.height || 10;
    let row = rows.find((r) => Math.abs(r.y - y) < Math.max(2, hgt * 0.45));
    if (!row) { row = { y, h: hgt, items: [] }; rows.push(row); }
    row.items.push({ x, w: it.width || it.str.length * hgt * 0.5, s: it.str, h: hgt });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    r.items.sort((a, b) => a.x - b.x);
    let out = '', prevEnd = null;
    for (const it of r.items) {
      if (prevEnd !== null) {
        const gap = it.x - prevEnd;
        if (gap > it.h * 1.1) out += '\t';
        else if (gap > it.h * 0.18 && !out.endsWith(' ') && !it.s.startsWith(' ')) out += ' ';
      }
      out += it.s;
      prevEnd = it.x + it.w;
    }
    return out.replace(/[  ]+/g, ' ').trim();
  }).filter(Boolean);
}

/** Join words hyphenated across line breaks: "spise-" + "rom" → "spiserom". */
export function dehyphenate(lines) {
  const out = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (prev && /[a-zæøå]-$/.test(prev) && /^[a-zæøå]/.test(l)) {
      const [first, ...rest] = l.split(' ');
      out[out.length - 1] = prev.slice(0, -1) + first;
      if (rest.length) out.push(rest.join(' '));
    } else out.push(l);
  }
  return out;
}

export async function extractPdf(file, onProgress = () => {}) {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await lib.getDocument({ data, isEvalSupported: false }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(dehyphenate(itemsToLines(tc.items)));
    page.cleanup?.();
    onProgress(p / doc.numPages, p, doc.numPages);
  }
  const meta = await doc.getMetadata().catch(() => null);
  await doc.destroy?.();
  return { pages, title: meta?.info?.Title || '' };
}

/** Plain text → pages of ~35 lines (for pasted text or .txt files). */
export function textToPages(text) {
  const lines = String(text).replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, ''));
  const pages = [];
  for (let i = 0; i < lines.length; i += 35) pages.push(lines.slice(i, i + 35).filter((l) => l.trim()));
  return pages.filter((p) => p.length);
}

const SEP = /\s*(?:\t+|\s[–—-]\s|\s=\s|\s{3,}|:\s)\s*/;
const STRIP_NUM = /^\s*(?:\(?\d{1,3}[.)]|[•·▪◦*-])\s*/;

function noScore(side, dictHas) {
  const has = (w) => lemmaCandidates(w).some(dictHas); // also recognise inflected forms: landet → land
  const d = detectLanguage(side, has);
  let s = d.no - d.en;
  if (/^(å|en|ei|et)\s/i.test(side.trim())) s += 1.5;
  if (/^(to|a|an|the)\s/i.test(side.trim())) s -= 1.5;
  return s;
}

/**
 * Find vocabulary pairs in lines such as:
 *   "et hus – a house", "å spise = to eat", "bilen: the car", "takk\tthanks"
 */
export function extractPairs(lines, dictHas = () => false) {
  const pairs = [];
  const seen = new Set();
  for (const raw of lines) {
    const line = raw.replace(STRIP_NUM, '');
    const total = words(line).length;
    if (total < 2 || total > 14) continue;
    const parts = line.split(SEP).map((p) => p.trim()).filter(Boolean);
    if (parts.length !== 2) continue;
    const [a, b] = parts;
    const wa = words(a).length, wb = words(b).length;
    if (!wa || !wb || wa > 6 || wb > 9) continue;
    if (/[.!?]\s*\S/.test(a)) continue; // looks like running text, not a glossary entry
    const sa = noScore(a, dictHas), sb = noScore(b, dictHas);
    if (sa === sb) continue;
    const [no, en] = sa > sb ? [a, b] : [b, a];
    if (Math.max(sa, sb) <= 0) continue; // one side must actually look Norwegian
    const key = normalize(no);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    pairs.push({ no: no.replace(/[,;]$/, ''), en: en.replace(/[,;]$/, '') });
  }
  return pairs;
}

/** Analyse imported pages: language per line, glossary pairs (+ example sentences from the same book). */
export function analyseDoc(pages, dictHas) {
  const outPages = pages.map((lines) => lines.map((t) => ({ t, lang: detectLanguage(t, dictHas).lang })));
  const noLines = [];
  outPages.forEach((p, pi) => p.forEach((l) => { if (l.lang === 'no' && words(l.t).length >= 4) noLines.push({ t: l.t, page: pi }); }));
  const pairs = [];
  outPages.forEach((p, pi) => {
    for (const pr of extractPairs(p.map((l) => l.t), dictHas)) {
      const exLine = noLines.find((l) => l.t !== pr.no && !l.t.includes(pr.en) && makeCloze(l.t, pr.no));
      pairs.push({ ...pr, page: pi, ex: exLine ? exLine.t : '' });
    }
  });
  const flat = outPages.flat();
  return {
    pages: outPages,
    pairs,
    stats: {
      lines: flat.length,
      no: flat.filter((l) => l.lang === 'no').length,
      en: flat.filter((l) => l.lang === 'en').length,
      chars: flat.reduce((n, l) => n + l.t.length, 0),
    },
  };
}
