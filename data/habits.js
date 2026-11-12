// Habit-building content: daily-life micro-missions, achievements and level titles.

// One mission per day (rotates by date). Each moves Norwegian out of the app and
// into ordinary moments, "habit stacking" onto things you already do.
export const MISSIONS = [
  { id: 'm-coffee', icon: '☕', text: 'While you make coffee or tea, say it out loud:', no: 'Nå lager jeg kaffe. Kaffen er varm og god.' },
  { id: 'm-labels', icon: '🏷️', text: 'Put sticky notes on 3 things at home and read them every time you pass:', no: 'kjøleskapet · døra · vinduet' },
  { id: 'm-phone', icon: '📱', text: 'Switch your phone’s language to Norwegian (norsk bokmål) for at least one hour.', no: 'Innstillinger → Språk → Norsk' },
  { id: 'm-radio', icon: '📻', text: 'Listen to 5 minutes of Norwegian radio or a podcast (e.g. NRK). Don’t try to understand everything. Just soak it in.', no: 'Jeg hører på norsk radio.' },
  { id: 'm-todo', icon: '📝', text: 'Write tomorrow’s to-do list in Norwegian. Three items are enough.', no: 'I morgen skal jeg: 1) handle 2) trene 3) ringe mamma' },
  { id: 'm-commute', icon: '🚋', text: 'Narrate your commute in your head:', no: 'Nå går jeg til bussen. Bussen kommer. Jeg sitter og ser ut.' },
  { id: 'm-text', icon: '💬', text: 'Send one Norwegian sentence to a friend (or to yourself):', no: 'Hei! Hvordan går det? Jeg lærer norsk!' },
  { id: 'm-lunch', icon: '🥪', text: 'Describe your lunch in three sentences:', no: 'Jeg spiser en matpakke. Det er brød og ost. Det er godt!' },
  { id: 'm-count', icon: '🔢', text: 'Count in Norwegian while you climb stairs, do push-ups or wait for the kettle.', no: 'en, to, tre, fire, fem …' },
  { id: 'm-video', icon: '🎬', text: 'Watch a short Norwegian video with Norwegian subtitles (NRK TV, YouTube).', no: 'Jeg ser på en norsk video.' },
  { id: 'm-past', icon: '⏪', text: 'Tonight, say three things you did today, in the past tense:', no: 'I dag gikk jeg … Jeg spiste … Jeg så …' },
  { id: 'm-yr', icon: '🌦️', text: 'Check the weather forecast in Norwegian (e.g. on yr.no) and say it out loud:', no: 'I morgen blir det regn og ti grader.' },
  { id: 'm-bye', icon: '👋', text: 'Say goodbye in Norwegian to someone today (your cat counts):', no: 'Ha det bra! Vi sees!' },
  { id: 'm-recall', icon: '🧠', text: 'Before you sleep, recall 5 Norwegian words from today. No peeking! That’s retrieval practice!', no: 'Hvilke ord husker jeg?' },
  { id: 'm-plan', icon: '🗓️', text: 'Plan your evening in Norwegian:', no: 'I kveld skal jeg lage middag og lese en bok.' },
  { id: 'm-song', icon: '🎵', text: 'Find a Norwegian song and sing along to the chorus. Melody makes words stick.', no: 'Jeg synger på norsk!' },
  { id: 'm-shadow', icon: '🗣️', text: 'Shadowing: open any dialogue, play a line and repeat it three times, copying the melody.', no: 'Hyggelig å treffe deg!' },
  { id: 'm-teach', icon: '🎓', text: 'Teach one Norwegian word to someone today. Explaining it locks it into your memory.', no: '«Koselig» betyr «cosy».' },
  { id: 'm-see', icon: '👀', text: 'Look around and name 5 things you can see in Norwegian.', no: 'et bord, en stol, et vindu, en kopp, en telefon' },
  { id: 'm-diary', icon: '📔', text: 'Write a two-line diary entry:', no: 'I dag var en fin dag. Jeg lærte fem nye ord.' },
  { id: 'm-order', icon: '🧁', text: 'Next time you order something, rehearse it in Norwegian first (or say it for real!):', no: 'Kan jeg få en kaffe, takk?' },
  { id: 'm-feel', icon: '🙂', text: 'Say how you feel right now:', no: 'Jeg er glad / trøtt / sulten i dag.' },
];

export const ACHIEVEMENTS = [
  { id: 'first-lesson', icon: '🌱', title: 'Første steg', desc: 'Finish your first lesson.' },
  { id: 'first-session', icon: '🔁', title: 'Repetisjon', desc: 'Complete your first review session.' },
  { id: 'streak-3', icon: '🔥', title: '3 dager på rad', desc: 'A 3-day streak.' },
  { id: 'streak-7', icon: '🔥', title: 'En hel uke', desc: 'A 7-day streak. The habit is forming!' },
  { id: 'streak-30', icon: '🏔️', title: 'En måned', desc: '30 days in a row.' },
  { id: 'streak-100', icon: '👑', title: 'Hundre dager', desc: '100 days. Norwegian is part of your life now.' },
  { id: 'words-25', icon: '📗', title: '25 ord', desc: 'Know 25 words or phrases.' },
  { id: 'words-100', icon: '📘', title: '100 ord', desc: 'Know 100 words or phrases.' },
  { id: 'words-300', icon: '📙', title: '300 ord', desc: 'Survival level reached.' },
  { id: 'words-1000', icon: '📚', title: '1000 ord', desc: 'Conversational vocabulary!' },
  { id: 'combo-10', icon: '⚡', title: 'Kombo ×10', desc: '10 correct answers in a row.' },
  { id: 'combo-25', icon: '🌩️', title: 'Kombo ×25', desc: '25 correct answers in a row.' },
  { id: 'perfect', icon: '💎', title: 'Feilfritt', desc: 'A session of 10+ cards without a single miss.' },
  { id: 'speaker', icon: '🗣️', title: 'Jeg snakker!', desc: 'Complete a role-play.' },
  { id: 'reader', icon: '📖', title: 'Leseløve', desc: 'Read 3 stories.' },
  { id: 'importer', icon: '📄', title: 'Egen lærebok', desc: 'Import your first textbook PDF.' },
  { id: 'miner', icon: '⛏️', title: 'Ordsamler', desc: 'Add 10 words from your own reading.' },
  { id: 'missions-5', icon: '🧭', title: 'Hverdagsnorsk', desc: 'Complete 5 daily-life missions.' },
  { id: 'early', icon: '🌅', title: 'Morgenfugl', desc: 'Practise before 08:00.' },
  { id: 'night', icon: '🦉', title: 'Nattugle', desc: 'Practise after 22:00.' },
  { id: 'chat', icon: '🤖', title: 'Samtale', desc: 'Send 5 messages to your AI conversation partner.' },
  { id: 'comeback', icon: '🌈', title: 'Velkommen tilbake', desc: 'Come back after a break. Every return counts!' },
  { id: 'half', icon: '🧗', title: 'Halvveis', desc: 'Finish half of the course.' },
  { id: 'all-units', icon: '🏆', title: 'Hele kurset', desc: 'Finish every unit in the course.' },
];

export const LEVEL_TITLES = [
  ['Turist', 'Tourist'],
  ['Nykommer', 'Newcomer'],
  ['Kaffedrikker', 'Coffee drinker'],
  ['Språkkafé-gjest', 'Language-café guest'],
  ['Trikkepassasjer', 'Tram passenger'],
  ['Turgåer', 'Hiker'],
  ['Brunost-elsker', 'Brown-cheese lover'],
  ['Hyttekos-ekspert', 'Cabin-cosiness expert'],
  ['Fjellvandrer', 'Mountain wanderer'],
  ['Nesten norsk', 'Almost Norwegian'],
  ['Ekte nordmann', 'True Norwegian'],
];

// Encouragements, shown at random after correct answers (variable, light-touch praise).
export const PRAISE = ['Bra!', 'Flott!', 'Supert!', 'Riktig!', 'Kjempebra!', 'Perfekt!', 'Strålende!', 'Helt rett!', 'Sånn ja!', 'Nydelig!'];
export const ENCOURAGE = ['Nesten!', 'Godt forsøk!', 'Det kommer!', 'Feil er læring.', 'Neste gang!'];
