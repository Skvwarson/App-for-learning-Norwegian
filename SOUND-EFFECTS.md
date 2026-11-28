# Sound effects brief (ElevenLabs → Sound Effects)

Every effect in the app, what it should feel like, and a prompt to paste into
ElevenLabs. Until a recording is added, the app uses its built-in synthesized sound,
so you can add these one at a time.

## The feel of the whole set

One family of sounds: **warm, soft, wooden/glassy, a little musical, never harsh.**
Think of a calm Scandinavian app: felt, wood, glass, a soft marimba and a light
bell, no game-show buzzers, no 8-bit, no voices. All in the same key
(**G major**), so sounds that follow each other always fit together.

Rules that keep it satisfying instead of annoying:

- **The more often a sound plays, the shorter, quieter and plainer it must be.**
  Taps play hundreds of times a day, so they are almost subliminal. Level-up plays
  once a week, so it can be big.
- **Dry, close-up, no reverb tail, no music bed, no hiss.** Start immediately
  (sound at 0 ms).
- **No high, piercing frequencies** for frequent sounds (that's what made the old
  tick tiring).
- **Make 3–4 variants** of the frequent sounds (tap, tile, page, correct). The
  app plays a different one each time, so it never feels like a loop. ElevenLabs
  gives you 4 versions per generation; keep the ones that sound alike.

## How to generate

- Settings: **Duration** as below (shortest is 0.5 s; the script trims it),
  **Prompt influence** high (≈ 0.6–0.8) so it follows the prompt, **Loop** off.
- Download as MP3.
- Prepare and add them (trims silence, caps the length, levels the loudness,
  numbers the variants and lists them in `data/sfx.js`):

  ```bash
  python3 scripts/prepare-sfx.py tap ~/Downloads/tap*.mp3
  ```

- Bump the app version (`sw.js` + `js/core/version.js`), commit and push.
- Tap and page-change get a **"Recorded"** choice in Settings → Sound; the
  others replace the built-in sound automatically.

## The list

| # | File name | When it plays | Length | Variants | How often |
|---|---|---|---|---|---|
| 1 | `tap` | Pressing any button or link | ≤ 0.15 s | 4 | constantly |
| 2 | `tile` | Placing a word tile in a sentence-building answer | ≤ 0.2 s | 3–4 | very often |
| 3 | `page-right` | Bottom menu turns right (next page) | ≤ 0.4 s | 2–3 | often |
| 4 | `page-left` | Bottom menu turns left *(optional)* | ≤ 0.4 s | 2–3 | often |
| 5 | `correct` | Right answer (pitch rises a little during a combo) | ≤ 0.6 s | 3 | very often |
| 6 | `almost` | Nearly right (small typo / accent missing) | ≤ 0.6 s | 1–2 | sometimes |
| 7 | `wrong` | Wrong answer | ≤ 0.6 s | 2 | often |
| 8 | `bonus` | Surprise bonus XP in review | ≤ 1.2 s | 1 | rare |
| 9 | `step-done` | Finished a part: the words, a review session, a story, a number drill, a role-play | ≤ 1.5 s | 1–2 | daily |
| 10 | `streak` | Daily streak popup ("the fire keeps going") | ≤ 2 s | 1 | once a day |
| 11 | `lesson-done` | Finished a whole lesson | ≤ 2.5 s | 1 | a few a week |
| 12 | `level-up` | Reached a new level | ≤ 2.5 s | 1 | rare |
| 13 | `day-done` | Everything in today's plan is done | ≤ 3 s | 1 | once a day |

## Prompts

**1. tap**: the most important one. Satisfying = a short, soft, low "thock" you can
almost feel, like pressing a good key.
> Single soft tactile button press, a muted wooden "thock" like a premium mechanical keyboard key with soft felt dampening, very short, warm low-mid tone, close-up, dry, no reverb, no click, no high frequencies

Alternatives if you want another character:
> Single small water droplet "plip", soft and round, very short, close-up, dry, no splash, no reverb

> Tiny soft wooden tap on a marimba bar with a felt mallet, one short muted note, warm, dry, no reverb

**2. tile**: like placing a small wooden game piece (Scrabble tile) on a table.
> Small wooden game tile placed onto a wooden board, single soft click-clack, short, warm, close-up, dry, no reverb

**3. page-right / 4. page-left**: the menu is a dial that turns, so a
smooth, well-made mechanism: one notch and a soft glide. For left, the same prompt;
pick the variant that feels "backwards", or skip it.
> Smooth premium rotary dial turning one notch, a soft swish followed by a gentle muted click as it settles, satisfying, short, close-up, dry, no reverb

Alternative (airier):
> Quick soft swipe of a paper card sliding across a table, ending with a gentle tap, short, light, close-up, no reverb

**5. correct**: bright and rewarding but tiny: two rising notes.
> Two quick rising soft marimba notes, G then D, bright and happy, short success sound for a learning app, clean, warm, no reverb tail

**6. almost**: friendly "nearly!", not a failure.
> Two soft gentle marimba notes, the second only slightly higher, curious and friendly "almost" sound, short, warm, no reverb

**7. wrong**: soft and kind, never a buzzer. A learner hears this a lot.
> Soft low muted wooden "thunk", two gentle descending notes, kind and calm, not harsh, no buzzer, short, warm, dry

**8. bonus**: a little sparkle of surprise.
> Short magical sparkle, a quick rising run of tiny glass bell notes, light and delightful, surprise reward sound, clean, short tail

**9. step-done**: "part finished", satisfying, not over the top.
> Short warm completion chime, three ascending marimba and soft bell notes in G major ending on a bright note, satisfying, gentle, light reverb

**10. streak**: warmth: a fire that keeps going.
> Soft cozy whoosh of a small flame igniting followed by a warm gentle bell chime, comforting and rewarding, short

**11. lesson-done**: proper reward, a small fanfare.
> Joyful short celebration jingle, ascending marimba arpeggio in G major ending in a bright bell chord with soft sparkles, rewarding, warm, not loud, no drums

**12. level-up**: the biggest moment.
> Triumphant short level-up fanfare, bright rising arpeggio of bells and marimba in G major resolving on a full warm chord with sparkling shimmer, uplifting and magical, no drums, no voice

**13. day-done**: calm pride, the day is finished.
> Warm satisfying "all done" sound, a gentle rising harp and bell arpeggio in G major ending on a soft sustained chord, peaceful and proud, cozy

## Tips

- Generate, then listen to them **in a row on your phone at normal volume**: if one
  sticks out (too loud, too bright, too long), regenerate it. The script levels peaks,
  but the character must match.
- If a tap has any "attack click" or a long tail, regenerate. Taps must be clean.
- Keep the prompts you liked in this file, so you can make more of the same later.
