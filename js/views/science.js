// "How it works": the learning science behind each feature.

import { h, add } from '../ui/dom.js';

const PRINCIPLES = [
  {
    icon: '⏳', name: 'Spaced repetition', where: 'Daily review',
    what: 'Memories fade on a predictable curve (Ebbinghaus). Reviewing just before you would forget strengthens a memory far more than reviewing early.',
    how: 'The FSRS-5 algorithm models each word’s stability and difficulty and schedules the next review when your recall chance drops to your target (90 % by default). Intervals grow: minutes → days → weeks → months.',
  },
  {
    icon: '🎯', name: 'Active recall & retrieval practice', where: 'Every exercise',
    what: 'Pulling information out of memory strengthens it more than reading it again (the “testing effect”, Roediger & Karpicke 2006).',
    how: 'You always try to answer before seeing the solution: type, speak, build or recall the word. Even right after a new word is introduced, a quick test follows.',
  },
  {
    icon: '🧩', name: 'Cognitive load', where: 'Lessons, daily limits',
    what: 'Working memory holds only a few new items at once (Sweller; Cowan’s ~4 chunks). Overload blocks learning.',
    how: 'New words come in groups of 5, there’s one grammar idea per unit, a daily limit on new words, and exercises get harder only as a memory gets stronger (recognition → fill-the-gap → full production).',
  },
  {
    icon: '🏞️', name: 'Contextual learning', where: 'Dialogues, stories, cloze',
    what: 'Words learned inside meaningful situations are easier to recall and use (encoding specificity).',
    how: 'Every unit starts with a real-life scene. Cards carry an example sentence from that scene, and “fill the gap” exercises test the word inside the sentence. Words you mine from your textbook keep their original sentence.',
  },
  {
    icon: '📖', name: 'Comprehensible input', where: 'Read, AI chat',
    what: 'We acquire language by understanding messages slightly above our level (Krashen’s “i + 1”). At ~95 % known words, reading becomes enjoyable and new words are learned from context.',
    how: 'Every text shows the % of words you know and colours each word. Stories are matched to the units; the AI partner is told which words you know and uses at most 1–2 new words per reply.',
  },
  {
    icon: '🗣️', name: 'Output & the production effect', where: 'Role-plays, speaking aloud',
    what: 'Producing language (Swain’s output hypothesis) reveals gaps and builds fluency; saying words aloud makes them more memorable.',
    how: 'Each unit ends with a role-play where you speak. Play any dialogue line and repeat it out loud, copying the melody (shadowing).',
  },
  {
    icon: '🔀', name: 'Interleaving & desirable difficulty', where: 'Practice, reviews',
    what: 'Mixing topics and making recall a bit effortful feels harder but produces stronger long-term learning (Bjork).',
    how: 'Practice mixes this unit with older words, and reviews shuffle all units together. Mistakes are rewarded with XP too – effort is the point.',
  },
  {
    icon: '🧱', name: 'Chunking & lexical phrases', where: 'Phrase cards',
    what: 'Fluent speakers rely on ready-made chunks (“Kan jeg få …?”, “Hva synes du om …?”). Learning them whole makes you conversational much faster than single words + grammar rules.',
    how: 'About half of the course items are whole phrases chosen for real conversations, practised as units in role-plays and word-tile exercises.',
  },
  {
    icon: '🌊', name: 'Flow', where: 'Focus mode',
    what: 'Flow happens when challenge matches skill, goals are clear and feedback is instant (Csikszentmihalyi). Learning is fastest around ~85 % success (Wilson et al. 2019).',
    how: 'Sessions hide everything else, show a clear progress bar and give instant feedback with sound. A flow controller watches your last answers: below ~70 % it eases off (hints, easier formats), above ~92 % it stretches you. Correct answers advance automatically to keep momentum.',
  },
  {
    icon: '🎁', name: 'Rewards & variable reinforcement', where: 'XP, combos, bonuses',
    what: 'Immediate, visible rewards and an element of surprise keep motivation up (variable-ratio reinforcement) – used here to reward effort, never to trap you.',
    how: 'XP for every attempt, combo multipliers for answer streaks (with rising sounds), occasional surprise bonus XP, levels with Norwegian titles, achievements, confetti on milestones.',
  },
  {
    icon: '🔁', name: 'Habit formation', where: 'Home, plan, missions',
    what: 'Habits form through repetition of a small action in a stable context; a missed day hardly matters (Lally et al. 2010). “Tiny habits” (Fogg) and implementation intentions (“After I…, I will…”, Gollwitzer) make starting effortless.',
    how: 'One big “start” button removes decisions. A tiny daily goal, a 2-minute mode, your personal “After I…” plan with a calendar reminder, a forgiving streak with freezes, and daily missions that move Norwegian into your real life (labels, self-talk, phone language).',
  },
  {
    icon: '📈', name: 'Visible progress (goal gradient)', where: 'Progress, journey map',
    what: 'People speed up as they see themselves approaching a goal, and meaningful progress is one of the strongest motivators.',
    how: 'Progress bars everywhere, a journey map of the course, memory strength per unit, a 12-week activity map, and a “conversation readiness” meter tied to real milestones.',
  },
];

export function scienceView(root) {
  add(root, h('div.stack',
    h('div.page-head', h('h1', 'Hvordan det virker'), h('p.muted', 'How this app uses learning psychology – and where you’ll find each idea.')),
    ...PRINCIPLES.map((p) => h('div.card.principle',
      h('div.row.between', h('div.strong', `${p.icon} ${p.name}`), h('span.pill.ghost.small', p.where)),
      h('p', h('b', 'Why: '), p.what),
      h('p', h('b', 'In the app: '), p.how))),
    h('div.card.tip', h('b', 'The fastest path to conversation: '),
      'do your reviews every day (5–10 min), one new unit every day or two, read one story, and speak – out loud – in a role-play or with the AI partner. Consistency beats intensity.')));
}
