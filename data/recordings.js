// Real recordings of dialogue lines (made with natural ElevenLabs voices).
// Files live in audio/<unit id>/<line number>.mp3, e.g. audio/u01/01.mp3 is the
// first line of unit 1's dialogue. Each speaker is recorded once for the whole
// course and cut with:  python3 scripts/align-recording.py <Speaker> <file.mp3> --write
// Then add the speaker below.

import { UNITS } from './units.js';

/** Speakers whose every line in every unit has a recording. */
export const RECORDED_SPEAKERS = ['Emma', 'Lars', 'Sofie', 'Servitøren', 'Ekspeditøren', 'Kvinnen', 'Jonas', 'Legen', 'Ahmed', 'Resepsjonisten'];

/** Extra single recorded lines (unit id → line numbers) for speakers not listed above. */
export const RECORDED_LINES = {};

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
