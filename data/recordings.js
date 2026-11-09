// Real recordings of dialogue lines (made with natural ElevenLabs voices).
// Files live in audio/<unit id>/<line number>.mp3 – e.g. audio/u01/01.mp3 is the
// first line of unit 1's dialogue. Each speaker is recorded once for the whole
// course and cut with:  node scripts/split-recording.mjs all <Speaker> <file.mp3>
// Then add the speaker below.

import { UNITS } from './units.js';

/** Speakers whose every line in every unit has a recording. */
export const RECORDED_SPEAKERS = ['Emma', 'Ahmed', 'Ekspeditøren', 'Jonas', 'Kvinnen'];

/** Single recorded lines of other speakers: unit id → line numbers. */
export const RECORDED_LINES = {
  u01: [1, 3, 5, 7, 9, 11], // Lars (first recording session)
};

/** Dialogue text → audio file URL. */
export function recordingEntries() {
  const out = [];
  for (const unit of UNITS) {
    unit.dialogue.forEach(([speaker, no], i) => {
      const n = i + 1;
      if (RECORDED_SPEAKERS.includes(speaker) || RECORDED_LINES[unit.id]?.includes(n)) {
        out.push([no, `audio/${unit.id}/${String(n).padStart(2, '0')}.mp3`]);
      }
    });
  }
  return out;
}
