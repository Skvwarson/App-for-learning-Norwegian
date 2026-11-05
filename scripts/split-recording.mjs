#!/usr/bin/env node
// Cut one speaker's recording (all their lines of a unit, with pauses between)
// into one file per dialogue line: audio/<unit>/<NN>.mp3.
//
//   node scripts/split-recording.mjs u02 Emma path/to/emma.mp3 [--out audio/u02] [--dry]
//
// Finds the pauses between lines with ffmpeg's silencedetect, cuts in the middle
// of the longest pauses, and checks that each piece's length matches its sentence.
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

// Try progressively more sensitive settings until we find enough pauses between lines.
let gaps = [];
for (const [db, d] of [[-40, 0.5], [-35, 0.4], [-35, 0.3], [-30, 0.25], [-28, 0.2]]) {
  const all = detect(db, d);
  const inner = all.filter((s) => s.start > 0.05 && s.end < duration - 0.05);
  if (inner.length >= lines.length - 1) {
    gaps = inner.sort((a, b) => (b.end - b.start) - (a.end - a.start)).slice(0, lines.length - 1).sort((a, b) => a.start - b.start);
    break;
  }
}
if (gaps.length < lines.length - 1) {
  console.error(`Found only ${gaps.length} pauses but ${speaker} has ${lines.length} lines. Re-record with longer pauses between lines.`);
  process.exit(2);
}

// Speech boundaries: leading/trailing silence trimmed, cut inside each gap with a little padding.
const lead = detect(-40, 0.1).find((s) => s.start <= 0.05);
const trail = detect(-40, 0.1).find((s) => s.end >= duration - 0.05);
const PAD = 0.2; // seconds kept around speech so soft word endings are never clipped
const bounds = [];
let from = lead ? Math.max(0, lead.end - PAD) : 0;
for (const g of gaps) {
  bounds.push([from, Math.min(g.end, g.start + PAD)]);
  from = Math.max(g.start, g.end - PAD);
}
bounds.push([from, trail ? Math.min(duration, trail.start + PAD) : duration]);

// Sanity check: speaking time should roughly follow sentence length.
const chars = lines.map((l) => l.no.length);
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
