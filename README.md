# 🇳🇴 Norsk Nå – learn conversational Norwegian

A web app (installable on your phone, works offline) for getting to **conversational Norwegian (Bokmål)** quickly. It is built around research on how memory and language learning work, and it turns studying into a small daily habit that's hard to break.

No account, no server and no build step. Your progress stays in your browser.

## What's inside

| | |
|---|---|
| 📚 **18-unit course (A1 → A2)** | Original dialogues from real situations: meeting people, cafés, shops, directions, family, daily routine, weather, the weekend, opinions, the doctor, renting a flat, work, travel, phone calls and changing plans, feelings. Each unit goes: listen → words in groups of 5 → one grammar idea → mixed practice → role-play. |
| 🔁 **Spaced repetition (FSRS-5)** | Each word is scheduled just before you'd forget it. Exercises get harder as a memory gets stronger: recognition → fill the gap in context → type or say it → listening → word order. |
| 📄 **Import your textbook PDF** | Any text-based PDF becomes a tap-to-translate reader. Glossary lines like `et hus – a house` or `å spise = to eat` (including table columns) are detected and offered as flashcards, each with an example sentence from the same book. You can also paste plain text. |
| 📖 **Graded stories** | One short story per unit. Every text shows the % of words you already know and colours each word by what you know. |
| 🗣️ **Speaking** | Scripted role-plays (type or use the microphone), shadowing with a pronunciation score, and an optional **AI conversation partner** that talks at your level and corrects you gently. |
| 🔢 **Drills** | Unlimited number and clock-time drills ("halv sju" = 6:30!). |
| 🎮 **Motivation & habit** | XP, levels with Norwegian titles, combos with rising sounds, surprise bonuses, achievements, a daily goal ring, a streak celebration at the end of each day's first session, a forgiving streak with streak freezes, daily missions that bring Norwegian into everyday life, a journey map, a 12-week activity map and a "conversation readiness" meter. |
| ➡️ **Today's plan** | Reviews → new words → a story → speaking → a real-life mission. Home shows it as a checklist, and every finish screen has a "Next:" button, so one activity flows into the next. A new lesson is followed by its story, which gives the new words a short gap before their first review. |
| 🌊 **Flow mode** | Distraction-free sessions with instant feedback, keyboard shortcuts (Enter, 1–4), auto-advance on correct answers, and a controller that eases off or stretches you so you stay around 85% success. |

The in-app page **☰ → How it works** explains which psychological principle drives each feature: spaced repetition, active recall/retrieval practice, cognitive load, contextual learning, comprehensible input, output/production effect, interleaving, chunking, flow, variable rewards, habit formation and goal-gradient.

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
Choose where audio comes from in **Settings → Voice**:

| Source | Quality | Cost | Setup |
|---|---|---|---|
| **This device** | from robotic to very good, depending on the voice | free | install a Norwegian voice (below) |
| **ElevenLabs** | most natural – and powers the 🎙 microphone in Brave | free monthly allowance, then paid | API key from elevenlabs.io (voice: Flash v2.5, which supports Norwegian; microphone: Scribe v2) |
| **Google Cloud** | very good neural nb-NO voices | free monthly quota covers this whole course | Google Cloud project with the Text-to-Speech API and an API key |

Cloud audio is generated once per sentence and saved on your device, so replays are free and work offline. The app never lets an English voice read Norwegian (that's how "Vi sees" becomes "six sees"). If there's no Norwegian voice, audio is muted and you're shown how to fix it.

**Real recordings.** Dialogue lines can have their own recordings, which play instead of any voice. Unit 1 has them (made with ElevenLabs). To add another unit: make one file per dialogue line (`01.mp3`, `02.mp3` …), upload them to `audio/u02/` (or the matching unit), and add the unit to `data/recordings.js`.

Free device voices:
- **Windows:** use **Microsoft Edge**, which usually includes natural-sounding Norwegian voices and supports the microphone. Brave and Chrome only see Windows' older built-in voices, so an installed Norwegian voice pack usually doesn't show up in them, and Brave has no speech recognition at all.
- **iPhone/iPad:** Settings → Accessibility → Spoken Content → Voices → Norwegian → "Nora (Enhanced)"
- **Mac:** System Settings → Accessibility → Spoken Content → System voice → Manage Voices → Norwegian
- **Android:** Settings → Text-to-speech → Google → install voice data → Norsk (bokmål)

Speech recognition (the 🎙 buttons) is built into Edge, Chrome and Safari. **Brave** (and Firefox) have none of their own; there, add an ElevenLabs key and the microphone records your answer and ElevenLabs transcribes it. When you answer by speaking, the app shows what it heard and how closely it matched.

**Using only Brave on Windows?** Choose **ElevenLabs** in Settings → Voice. Brave can't use Windows' Norwegian voice pack, so this one free key gives you both a natural voice and a working microphone.

## A daily routine that gets you talking fast
1. **Reviews first** (5–10 min): press the big button on the home screen. On a busy day, press "⚡ Just 2 minutes" to keep the habit going.
2. **One new unit every day or two** (≈15 min). The app limits new words per day so you don't overload.
3. **Read one short story or a page of your textbook.** Aim for texts where you know 90–98% of the words.
4. **Speak out loud every day**: a role-play, shadowing, or a chat with the AI partner.
5. **Do the daily mission**: little ways to use Norwegian outside the app (labels at home, talking to yourself, switching your phone to Norwegian…).

Set your **habit plan** on the home screen ("After I have my morning coffee, I practise Norwegian") and add the daily calendar reminder it offers.

## Using textbook PDFs
- The PDF is read **on your device** with [pdf.js](https://mozilla.github.io/pdf.js/). It's never uploaded anywhere.
- It needs text you can select. Scanned image-only PDFs need OCR first.
- New cards from a book are introduced a few per day, according to your "new words per day" setting, so even a 1,000-word glossary arrives at a manageable pace.
- Use material you have the right to use: openly licensed or free course materials, your own course books, or articles you paste in for personal study.

## Optional AI conversation partner
Open **Snakk → AI conversation partner**, paste a Claude API key from [console.anthropic.com](https://console.anthropic.com/settings/keys) and choose a situation (café, small talk, directions, doctor…). The partner:
- knows which words you know, and uses at most 1–2 new words per reply (comprehensible input);
- returns a translation on tap, a gentle correction of your last message, and 2–3 suggested replies;
- collects new words so you can add them to your deck at the end.

The key is stored only in this browser's local storage and is sent only to `api.anthropic.com`. Usage is billed to your Anthropic account. The default model is **Claude Opus 5.5**; Sonnet 5.5 and Haiku 5.5 are cheaper options in Settings. Requests use low effort for quick replies, structured JSON output, and Anthropic's server-side refusal fallback (`fallbacks: "default"`) on the models that support it.

## Your data
Everything is saved in your browser (localStorage for progress, IndexedDB for imported texts). Use **Settings → Download backup** now and then, and to move to another device. Backups don't include your API key.

## Project layout
```
index.html, css/app.css, manifest.webmanifest, sw.js   app shell, styles, PWA
js/core/   fsrs.js (scheduler) · text.js (tokenising, answer checking, lemmas) · deck.js · store.js
           gamify.js (XP, streaks, missions) · course.js · pdf.js (import) · lexicon.js · tutor.js (AI)
           speech.js (device voices, ElevenLabs / Google Cloud voices with caching, speech recognition)
js/views/  one file per screen (home, learn, lesson, review, read, import, speak, roleplay, practice, words, progress, science, settings)
js/ui/     dom helpers, reusable widgets, router
data/      units.js (course) · stories.js · dictionary.js (glossary) · habits.js (missions, achievements)
vendor/    pdf.js and the Anthropic SDK (browser bundle), with their licenses – recreate with scripts/vendor.sh
tests/     unit tests (node --test) and a Playwright end-to-end smoke test
```

## Development
```bash
npm test          # unit tests: scheduler, answer checking, PDF parsing, course-content validation …
npm run test:e2e  # browser walkthrough with screenshots (needs Playwright + a server on :8123)
```
When you change app files, bump `VERSION` in `sw.js` and `APP_VERSION` in `js/core/version.js`. The service worker is network-first, so online users get updates on their next visit (the app reloads itself once, never mid-lesson); the cache is only used offline.

## Credits
Course texts, stories and glossary were written for this project. Scheduling uses the open FSRS-5 algorithm ([open-spaced-repetition](https://github.com/open-spaced-repetition)). PDF reading uses Mozilla pdf.js (Apache-2.0).
