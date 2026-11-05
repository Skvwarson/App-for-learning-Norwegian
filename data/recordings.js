// Real recordings of dialogue lines (made with natural ElevenLabs voices).
// Files live in audio/<unit id>/<line number>.mp3 – e.g. audio/u01/01.mp3 is the
// first line of unit 1's dialogue. When you add recordings for another unit,
// upload them to audio/u02/ (01.mp3, 02.mp3 …) and add the unit below.

import { UNITS } from './units.js';

/** unit id → number of recorded lines (1 … n). */
export const RECORDED_UNITS = {
  u01: 12,
};

/** Dialogue text → audio file URL. */
export function recordingEntries() {
  const out = [];
  for (const [id, count] of Object.entries(RECORDED_UNITS)) {
    const unit = UNITS.find((u) => u.id === id);
    if (!unit) continue;
    unit.dialogue.slice(0, count).forEach(([, no], i) => {
      out.push([no, `audio/${id}/${String(i + 1).padStart(2, '0')}.mp3`]);
    });
  }
  return out;
}
