#!/usr/bin/env node
// Cut one speaker's recording (all their lines of a unit, with pauses between)
// into one file per dialogue line: audio/<unit>/<NN>.mp3.
//
//   node scripts/split-recording.mjs u02 Emma path/to/emma.mp3 [--out audio/u02] [--dry]
//
// Finds every pause with ffmpeg's silencedetect, then picks the cut points whose
// pieces best fit each line's text (pauses between lines are often as short as
// pauses between sentences), and reports each piece's length for checking.
// Needs ffmpeg and ffprobe on the PATH.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { UNITS } from '../data/units.js';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const dry = args.includes('--dry') ? (args.splice(args.indexOf('--dry'), 1), true) : false;
const outArg = flag('--out');
const [unitId, speaker, input] = args;
if (!unitId || !speaker || !input) {
  console.error('Usage: node scripts/split-recording.mjs <unit id> <speaker> <file> [--out dir] [--dry]');
  process.exit(1);
}

const unit = UNITS.find((u) => u.id === unitId);
if (!unit) throw new Error(`Unknown unit ${unitId}`);
const lines = unit.dialogue.map(([sp, no], i) => ({ n: i + 1, sp, no })).filter((l) => l.sp.toLowerCase() === speaker.toLowerCase());
if (!lines.length) throw new Error(`${speaker} has no lines in ${unitId}. Speakers: ${[...new Set(unit.dialogue.map((d) => d[0]))].join(', ')}`);
const outDir = outArg || join('audio', unitId);

const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input]).toString().trim());

/** Silence intervals found by ffmpeg (it reports them on stderr). */
function detect(noiseDb, minDur) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', input, '-af', `silencedetect=noise=${noiseDb}dB:d=${minDur}`, '-f', 'null', '-'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.slice(-300)}`);
  const err = r.stderr;
  const out = [];
  let start = null;
  for (const m of err.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    if (m[1] === 'start') start = Number(m[2]);
    else if (start != null) { out.push({ start, end: Number(m[2]) }); start = null; }
  }
  if (start != null) out.push({ start, end: duration });
  return out;
}

// 1. Every pause, then the stretches of speech between them.
const PAD = 0.2; // seconds kept around speech so soft word endings are never clipped
const pauses = detect(-35, 0.2);
const segs = [];
let cursor = 0;
for (const p of pauses) {
  if (p.start - cursor > 0.08) segs.push({ start: cursor, end: p.start });
  cursor = p.end;
}
if (duration - cursor > 0.08) segs.push({ start: cursor, end: duration });
if (segs.length < lines.length) {
  console.error(`Found only ${segs.length} stretches of speech but ${speaker} has ${lines.length} lines. Re-record with a clear pause between lines.`);
  process.exit(2);
}

// 2. Group consecutive stretches into lines so each line's length best fits its text.
//    Pauses between lines are often no longer than pauses between sentences, so we
//    can't just cut at the longest pauses – the text tells us where the lines end.
const sentenceCount = (t) => Math.max(1, (t.match(/[.!?…]+[»”"]*(\s|$)/g) ?? []).length);
const chars = lines.map((l) => l.no.length);
// Compare *speaking* time only – pauses vary wildly and would distort the fit.
const talk = (a, b) => segs.slice(a, b + 1).reduce((t, g) => t + (g.end - g.start), 0);
const perChar = talk(0, segs.length - 1) / chars.reduce((a, b) => a + b, 0);
const gapAfter = (k) => (k + 1 < segs.length ? segs[k + 1].start - segs[k].end : 1);
const lineCost = (j, a, b) => {
  const dur = talk(a, b);
  const fit = Math.log(dur / (chars[j] * perChar)) ** 2;           // length matches the text
  const sentences = Math.abs((b - a + 1) - sentenceCount(lines[j].no)) * 0.1; // pauses usually fall between sentences
  const boundary = -0.3 * Math.min(1, gapAfter(b));                 // prefer cutting at longer pauses
  return fit + sentences + boundary;
};
const S = segs.length, L = lines.length;
const best = Array.from({ length: L + 1 }, () => Array(S + 1).fill(Infinity));
const from = Array.from({ length: L + 1 }, () => Array(S + 1).fill(-1));
best[0][0] = 0;
for (let j = 1; j <= L; j++) {
  for (let b = j; b <= S - (L - j); b++) {
    for (let a = j - 1; a < b; a++) {
      if (best[j - 1][a] === Infinity) continue;
      const c = best[j - 1][a] + lineCost(j - 1, a, b - 1);
      if (c < best[j][b]) { best[j][b] = c; from[j][b] = a; }
    }
  }
}
const groups = [];
for (let j = L, b = S; j > 0; j--) { const a = from[j][b]; groups.unshift([a, b - 1]); b = a; }

// 3. Cut points: a little padding around the speech, never past the middle of a pause.
const bounds = groups.map(([a, b]) => {
  const prevMid = a > 0 ? (segs[a - 1].end + segs[a].start) / 2 : 0;
  const nextMid = b + 1 < S ? (segs[b].end + segs[b + 1].start) / 2 : duration;
  return [Math.max(prevMid, segs[a].start - PAD), Math.min(nextMid, segs[b].end + PAD)];
});

// Sanity check: speaking time should roughly follow sentence length.
const secs = bounds.map(([a, b]) => b - a);
const rate = secs.reduce((x, y) => x + y, 0) / chars.reduce((x, y) => x + y, 0);
let suspicious = 0;
console.log(`${speaker} in ${unitId}: ${lines.length} lines, ${duration.toFixed(1)} s`);
lines.forEach((l, i) => {
  const ratio = secs[i] / (chars[i] * rate);
  const flagged = ratio < 0.45 || ratio > 2.2;
  if (flagged) suspicious++;
  console.log(`${String(l.n).padStart(2, '0')}  ${secs[i].toFixed(2)} s  ${flagged ? '⚠️ ' : '   '}${l.no}`);
});
if (suspicious) console.log(`\n⚠️  ${suspicious} piece(s) are much shorter or longer than their sentence – check them before using.`);

if (!dry) {
  mkdirSync(outDir, { recursive: true });
  lines.forEach((l, i) => {
    const [a, b] = bounds[i];
    const len = b - a;
    const file = join(outDir, `${String(l.n).padStart(2, '0')}.mp3`);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', a.toFixed(3), '-t', len.toFixed(3), '-i', input,
      '-af', `afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, len - 0.04).toFixed(3)}:d=0.04`, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', file]);
  });
  console.log(`\nWrote ${lines.length} files to ${outDir}/`);
}
process.exit(suspicious ? 3 : 0);
