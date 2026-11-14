# 🇳🇴 Norsk Nå – learn conversational Norwegian

A web app (installable on your phone, works offline) for getting to **conversational Norwegian (Bokmål)** quickly. It is built around research on how memory and language learning work, and it turns studying into a small daily habit that's hard to break.

No account, no server and no build step. Your progress stays in your browser.

## What's inside

The whole app is three tabs: **Today**, **Course** and **Race**. Your profile (progress, words, settings) is behind the round button top right.

| | |
|---|---|
| ▶️ **One button a day** | **Today** has one big Start button. It takes you through the day in the order that works best – review → learn → read → speak – and every finish screen leads straight to the next step. |
| 📚 **18-unit course (A1 → A2)** | Original dialogues from real situations: meeting people, cafés, shops, directions, family, daily routine, weather, the weekend, opinions, the doctor, renting a flat, work, travel, phone calls and changing plans, feelings. Each unit goes: listen → words in groups of 5 → one grammar idea → mixed practice → role-play. |
| 🔁 **Spaced repetition (FSRS-5)** | Each word is scheduled just before you'd forget it. Exercises get harder as a memory gets stronger: recognition → fill the gap in context → type or say it → listening → word order. |
| 📖 **Stories, role-plays, drills** | One short story per unit (every word tappable, coloured by what you know), a role-play per unit, and number / clock-time drills – all under **Course → Practise more**. |
| 🏁 **The race** | You vs your friend: this week's XP, streak and words, side by side. (Demo data until accounts are connected.) |
| 🎮 **Motivation** | A streak, XP and levels – kept simple. Combos and sounds make exercises feel good; a streak celebration closes the day's first session. |
| 🌊 **Flow** | Distraction-free sessions with instant feedback, keyboard shortcuts (Enter, 1–4), auto-advance on correct answers, and a controller that keeps you at around 85% success. |

## Start using it

### Option A – put it online for free with GitHub Pages (recommended for phones)
1. Merge this branch into `main`.
2. In the repository on GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
3. After a minute it's live at `https://<your-username>.github.io/App-for-learning-Norwegian/`.
4. On your phone, open that link and choose **Add to Home Screen** (Safari share menu / Chrome menu). It then opens like an app and works offline.

### Option B – run it on your computer
```bash
python3 -m http.server 8123
```
Then open <http://localhost:8123>. ES modules don't load from `file://`, so you need a local server.

### Norwegian voice
1. **Real recordings** play first – every dialogue line in all 18 units has one (made with ElevenLabs). To re-record a character: record **all their lines in one file** with a short pause between lines, then run `python3 scripts/align-recording.py Emma emma.mp3 --write`. It transcribes the file with Whisper, matches it to the script (skipping anything not in it, like a spoken "Unit 3"), and cuts at the pauses between lines into `audio/<unit>/<line>.mp3`. New characters go in `data/recordings.js`. Words, examples, grammar and practice answers, role-plays and stories have their own voice-overs: `node scripts/recording-scripts.mjs . out/` writes the scripts to read, and `python3 scripts/cut-voiceover.py script.txt recording.mp3 audio/vo/<name> --json out.json` cuts each recording into one file per line (listed in `data/voiceovers.js`).
2. Otherwise the **device's own Norwegian voice** is used. The app never lets an English voice read Norwegian (that's how "Vi sees" becomes "six sees"); without a Norwegian voice, Today shows how to install one:
   - **iPhone/iPad:** Settings → Accessibility → Spoken Content → Voices → Norwegian → "Nora (Enhanced)"
   - **Mac:** System Settings → Accessibility → Spoken Content → System voice → Manage Voices → Norwegian
   - **Android:** Settings → Text-to-speech → Google → install voice data → Norsk (bokmål)
   - **Windows:** Chrome and Edge can use Norwegian voices; Brave can't.

All answers are typed – speaking practice happens with a real person.

## A daily routine
Open the app and press **Start**. That's it: about 10–20 minutes covers reviews, one lesson, one story and one role-play. On a busy day, even the reviews alone keep your streak.

Want a reminder? **Me → Settings → Daily reminder** ties Norwegian to something you already do and adds it to your calendar.

## Your data
Everything is saved in your browser. Use **Me → Settings → Download backup** now and then, and to move to another device.

## Project layout
```
index.html, css/app.css, manifest.webmanifest, sw.js   app shell, styles, PWA
js/core/   fsrs.js (scheduler) · text.js (tokenising, answer checking, lemmas) · deck.js · store.js
           gamify.js (XP, streaks) · today.js (the daily plan) · course.js · lexicon.js · social.js (race)
           speech.js (recordings, device voices, speech recognition)
js/views/  one file per screen (home, learn, lesson, review, read, speak, roleplay, practice, friends, progress, words, settings)
js/ui/     dom helpers, icons, reusable widgets, router
data/      units.js (course) · stories.js · dictionary.js (glossary) · recordings.js
vendor/    fonts (Nunito, Literata – SIL OFL)
tests/     unit tests (node --test) and Playwright end-to-end tests
```

## Development
```bash
npm test          # unit tests: scheduler, answer checking, course-content validation …
npm run test:e2e  # browser walkthrough with screenshots (needs Playwright + a server on :8123)
```
When you change app files, bump `VERSION` in `sw.js` and `APP_VERSION` in `js/core/version.js`. The service worker is network-first, so online users get updates on their next visit (the app reloads itself once, never mid-lesson); the cache is only used offline.

## Credits
Course texts, stories and glossary were written for this project. Scheduling uses the open FSRS-5 algorithm ([open-spaced-repetition](https://github.com/open-spaced-repetition)). Fonts: Nunito and Literata (SIL Open Font License).
