// Scripted role-plays: the app plays one part, you produce the other
// (output practice + retrieval of whole conversational chunks).

import { h, clear, sfx, haptic, confetti, add } from '../ui/dom.js';
import { nextStepBlock, flushCelebrations } from '../ui/celebrate.js';
import { tappable, speakBtn, answerInput, diffView } from '../ui/components.js';
import { normalize, foldDiacritics, similarity, levenshtein } from '../core/text.js';
import { speak, stopSpeaking } from '../core/speech.js';
import { addXp, unlock, createCombo } from '../core/gamify.js';
import { settings, update, getState } from '../core/store.js';
import { unitById, UNITS } from '../core/course.js';

const WILD = 'qqwildqq';
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fold = (s) => foldDiacritics(normalize(String(s).replace(/\*/g, ` ${WILD} `))).replace(/\s+/g, ' ').trim();

function orderedFuzzy(fixed, tokens) {
  let j = 0;
  for (const f of fixed) {
    while (j < tokens.length && !(tokens[j] === f || (f.length > 3 && levenshtein(tokens[j], f) <= 1))) j++;
    if (j >= tokens.length) return false;
    j++;
  }
  return true;
}

export function judgeLine(given, line, name) {
  const g = fold(given);
  if (!g) return 'wrong';
  for (const raw of line.accept) {
    const p = fold(raw.replace('{name}', name));
    if (p.includes(WILD)) {
      const re = new RegExp('^' + p.split(WILD).map((x) => escapeRe(x.trim())).join('\\s*.+?\\s*') + '$');
      if (re.test(g)) return 'correct';
      const fixed = p.split(' ').filter((t) => t && t !== WILD);
      if (orderedFuzzy(fixed, g.split(' '))) return 'almost';
    } else {
      if (g === p) return 'correct';
      if (similarity(g, p) >= 0.8) return 'almost';
    }
  }
  if (similarity(g, fold(line.model.replace('{name}', name))) >= 0.8) return 'almost';
  return 'wrong';
}

export function mountRoleplay(host, unit, { onDone, embedded = false } = {}) {
  const rp = unit.roleplay;
  const name = settings().name || 'Alex';
  const chat = h('div.chat');
  const controls = h('div.rp-controls');
  add(host, h('div.stack',
    h('div.rp-head', h('div.kicker', `🎭 ${rp.title}`), h('div.small.muted', `You talk with ${rp.partner}.`)),
    chat, controls));
  let i = 0, firstTry = 0, youLines = rp.lines.filter((l) => l.who === 'you').length;
  const combo = createCombo();
  let alive = true;

  const bubble = (who, content) => {
    const b = h('div.bubble', { class: who }, content);
    add(chat, b);
    b.scrollIntoView({ block: 'end', behavior: 'smooth' });
    return b;
  };

  const step = async () => {
    if (!alive) return;
    clear(controls);
    if (i >= rp.lines.length) return finish();
    const line = rp.lines[i];
    if (line.who === 'them') {
      const en = h('div.bubble-en.hidden', line.en);
      bubble('them', [h('div.bubble-name', rp.partner), h('div.no', tappable(line.no, { sentence: line.no, translation: line.en })), en,
        h('div.bubble-tools', speakBtn(line.no), h('button.link', { onclick: () => en.classList.toggle('hidden') }, 'EN'))]);
      i++;
      await speak(line.no);
      if (alive) setTimeout(step, 250);
      return;
    }
    // Your turn
    let tries = 0, hintLevel = 0;
    const model = line.model.replace('{name}', name);
    const hint = h('div.hint');
    const fb = h('div.feedback');
    const inp = answerInput({
      placeholder: 'Say or type your answer…',
      expected: model,
      onSubmit: (v, alts) => {
        const candidates = [v, ...(alts || [])].filter(Boolean);
        let verdict = 'wrong', said = v;
        for (const c of candidates) { const r = judgeLine(c, line, name); if (r === 'correct' || (r === 'almost' && verdict === 'wrong')) { verdict = r; said = c; } if (r === 'correct') break; }
        tries++;
        clear(fb);
        if (verdict !== 'wrong') {
          if (tries === 1 && hintLevel === 0) { firstTry++; combo.hit(); }
          sfx.correct(combo.value); haptic(10);
          bubble('you', [h('div.no', said), verdict === 'almost' ? h('div.small.bubble-fix', 'Natural: ', model) : null]);
          addXp((verdict === 'correct' ? 8 : 5) * combo.multiplier(), 'roleplay');
          i++;
          setTimeout(step, 500);
        } else {
          combo.miss(); sfx.wrong(); haptic([30, 30, 30]);
          if (tries >= 2) {
            add(fb, h('div.bad', 'One way to say it: ', h('b.no', model), ' ', speakBtn(model)),
              h('div.small.muted', 'Say it out loud once, then continue.'),
              h('div.row.end', h('button.btn', { onclick: () => { bubble('you', h('div.no', model)); i++; step(); } }, 'Continue ▸')));
            speak(model);
          } else {
            add(fb, h('div.bad', 'Not quite – try again, or take a hint.'), said ? h('div.small', 'Closest answer: ', diffView(said, model)) : null);
          }
        }
      },
    });
    const words = model.split(/\s+/);
    add(controls, 
      h('div.cue', h('span.cue-label', 'You'), line.cue),
      inp.el,
      h('div.row.wrap',
        h('button.btn.ghost.small', {
          onclick: () => { hintLevel++; hint.textContent = '💡 ' + words.slice(0, Math.min(words.length, hintLevel * 2)).join(' ') + (hintLevel * 2 < words.length ? ' …' : ''); },
        }, '💡 Hint'),
        h('button.btn.ghost.small', { onclick: () => { hintLevel = 99; hint.textContent = '💡 ' + model; speak(model); } }, 'Show answer')),
      hint, fb);
  };

  const finish = () => {
    const pct = youLines ? firstTry / youLines : 1;
    const xp = addXp(40 + firstTry * 5, 'roleplay done');
    unlock('speaker');
    update((s) => { const prev = s.roleplays[unit.id]?.best ?? 0; s.roleplays[unit.id] = { best: Math.max(prev, pct), last: Date.now() }; });
    if (pct >= 0.8) confetti(80);
    sfx.goal();
    add(controls, h('div.card.center-col.stack',
      h('div.big-emoji', pct >= 0.8 ? '🏆' : '🙌'),
      h('h3', `${firstTry} of ${youLines} answers on the first try`),
      h('div.pill.xp', `+${xp} XP`),
      h('p.small.muted', 'Repeat role-plays a few days apart – each time it gets more automatic, and automatic is what makes real conversations feel easy.'),
      embedded ? null : nextStepBlock('speak'),
      h('div.row.wrap.center',
        h('button.btn', { onclick: () => { clear(chat); i = 0; firstTry = 0; step(); } }, '↻ Again'),
        onDone ? h('button.btn.primary', { onclick: onDone }, embedded ? 'Finish lesson ▸' : 'Done') : h('a.btn', { href: '#/speak' }, 'More conversations'))));
    if (!embedded) flushCelebrations();
  };

  step();
  return () => { alive = false; stopSpeaking(); };
}

export function roleplayView(root, { unitId }) {
  const unit = unitById(unitId);
  if (!unit) return;
  root.classList.add('focus-view');
  add(root, h('div.lesson-head', h('a.icon-btn', { href: '#/speak', 'aria-label': 'Back' }, '✕'),
    h('div.lesson-title', h('div.small.muted', `Unit ${UNITS.indexOf(unit) + 1}`), h('div.strong', unit.roleplay.title))));
  const host = h('div.lesson-body');
  add(root, host);
  return mountRoleplay(host, unit, {});
}

export function roleplayBest(unitId) { return getState().roleplays[unitId]?.best ?? null; }
