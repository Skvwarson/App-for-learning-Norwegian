// Recorded sound effects (made in ElevenLabs → Sound Effects). Files live in
// audio/sfx/<name>-<n>.mp3, e.g. audio/sfx/tap-1.mp3 … audio/sfx/tap-4.mp3.
// List a sound here with how many variants are in the folder; the app picks a
// different one each time, so it never sounds like a loop. Anything not listed
// (or a file that fails to load) uses the built-in synthesized sound.
//
//   tap         pressing any button or link          (Settings → Tapping things → Recorded)
//   tile        placing a word tile in an answer
//   page-right  bottom menu turns right               (Settings → Changing page → Recorded)
//   page-left   bottom menu turns left (optional: page-right is used if missing)
//   correct     right answer (pitch rises a little with a combo)
//   almost      nearly right (small typo)
//   wrong       wrong answer
//   bonus       surprise bonus XP in review
//   step-done   finished a part: words, review session, story, drill, role-play
//   streak      daily streak popup
//   lesson-done finished a whole lesson
//   level-up    reached a new level
//   day-done    everything in today's plan is done
export const SFX_FILES = {
  'page-right': 1,
};
