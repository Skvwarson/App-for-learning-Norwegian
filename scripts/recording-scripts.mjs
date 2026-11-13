// Writes recording scripts for everything a unit says aloud that has no real voice yet:
// one 'Teacher' voice (words, grammar, practice, model answers) and one file per role-play partner.
// usage: node scripts/recording-scripts.mjs <repo dir> <output dir>
import fs from 'node:fs';
const R = process.argv[2], OUT = process.argv[3];
const { UNITS } = await import(`${R}/data/units.js`);
const { recordingEntries } = await import(`${R}/data/recordings.js`);
const { normalize, makeCloze } = await import(`${R}/js/core/text.js`);
const { exampleFor } = await import(`${R}/js/core/course.js`);
// Only whole recorded dialogue lines count as done: words cut out of dialogues are a stopgap,
// and the Teacher voice should say every word, example and answer.
const have = new Set(recordingEntries().map(([t]) => t).map(normalize));
// Write each item so it reads naturally but still matches what the app plays.
const tidy = (t) => t.replace(/\s*…\s*/g, ' ').replace(/\s*\/\s*/g, ', ').replace(/[()]/g, '').replace(/\s+/g, ' ').trim()
;
const seen = new Set(have);
const teacher = [];  // [unit, text]
const partners = {}; // name -> [text]
const add = (list, t) => { if (!t || t.includes('{') || /\s[?.!,]/.test(tidy(t))) return; const k = normalize(t); if (!k || seen.has(k)) return; seen.add(k); list.push(tidy(t)); };
for (const u of UNITS) {
  const items = [];
  for (const w of u.words) {
    add(items, w.no);
    const ex = exampleFor(u, w);
    const cz = ex && makeCloze(ex.no, w.no);
    if (cz) add(items, cz.answer);
  }
  for (const [no] of u.grammar.examples ?? []) add(items, no);
  for (const d of u.grammar.drills ?? []) if (typeof d.a === 'string') add(items, d.a);
  for (const l of u.roleplay.lines) if (l.who === 'you') add(items, l.model);
  teacher.push(...items.map((t) => [u.id, t]));
  const p = u.roleplay.partner;
  for (const l of u.roleplay.lines) if (l.who !== 'you') add((partners[p] ??= []), l.no);
}
fs.mkdirSync(OUT, { recursive: true });
// Split the teacher voice into parts of ~4000 characters, at unit boundaries.
const parts = []; let cur = [], len = 0, lastUnit = null;
for (const [u, t] of teacher) {
  if (len > 3600 && u !== lastUnit) { parts.push(cur); cur = []; len = 0; }
  cur.push([u, t]); len += t.length + 2; lastUnit = u;
}
if (cur.length) parts.push(cur);
const summary = [];
parts.forEach((p, i) => {
  const name = `Teacher part ${i + 1} (units ${+p[0][0].slice(1)}-${+p[p.length - 1][0].slice(1)}).txt`;
  fs.writeFileSync(`${OUT}/${name}`, p.map(([, t]) => t).join('\n\n') + '\n');
  summary.push(`${name}: ${p.length} lines, ${p.reduce((n, [, t]) => n + t.length, 0)} chars`);
});
for (const [p, list] of Object.entries(partners)) {
  if (!list.length) continue;
  fs.writeFileSync(`${OUT}/Role-play ${p}.txt`, list.join('\n\n') + '\n');
  summary.push(`Role-play ${p}.txt: ${list.length} lines, ${list.reduce((n, t) => n + t.length, 0)} chars`);
}
fs.writeFileSync(`${OUT}/teacher-order.json`, JSON.stringify(teacher));
fs.writeFileSync(`${OUT}/partners.json`, JSON.stringify(partners));
console.log(summary.join('\n'));
console.log('teacher total', teacher.length);
