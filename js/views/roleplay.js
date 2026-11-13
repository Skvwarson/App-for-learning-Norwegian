// Scripted role-plays: the app plays one part, you produce the other
// (output practice + retrieval of whole conversational chunks).

import { h, clear, sfx, haptic, confetti, add } from '../ui/dom.js';
import { nextStepBlock, flushCelebrations } from '../ui/celebrate.js';
import { tappable, speakBtn, answerInput, diffView } from '../ui/components.js';
import { normalize, foldDiacritics, similarity, levenshtein } from '../core/text.js';
import { speak, stopSpeaking, preload } from '../core/speech.js';
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

const RETRY_MS = 15 * 60_000;   // missed lines come back after 15 minutes
const MAX_TRIES = 3;             // after three wrong tries the answer is shown
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** A role-play's pending retry of missed lines: { due, lines: [line indexes] } or null. */
export const pendingRetry = (unitId) => getState().roleplays[unitId]?.retry ?? null;

export function mountRoleplay(host, unit, { onDone, embedded = false } = {}) {
  const rp = unit.roleplay;
  const name = settings().name || 'Alex';
  const chat = h('div.chat');
  const controls = h('div.rp-controls');
  add(host, h('div.stack',
    h('div.rp-head', h('div.kicker', `🎭 ${rp.title}`), h('div.small.muted', `You talk with ${rp.partner}.`)),
    chat, controls));
  const combo = createCombo();
  let alive = true, waitTimer = null;

  const bubble = (who, content, cls = '') => {
    const b = h('div.bubble', { class: `${who} ${cls}` }, content);
    add(chat, b);
    b.scrollIntoView({ block: 'end', behavior: 'smooth' });
    return b;
  };
  const themBubble = (line) => {
    const en = h('div.bubble-en.hidden', line.en);
    bubble('them', [h('div.bubble-name', rp.partner), h('div.no', tappable(line.no, { sentence: line.no, translation: line.en, mark: false })), en,
      h('div.bubble-tools', speakBtn(line.no), h('button.link', { onclick: () => en.classList.toggle('hidden') }, 'EN'))]);
  };

  // Which lines to play: the whole role-play, or (retry) each missed line with the line before it.
  const retry = pendingRetry(unit.id);
  let plan;
  if (retry) {
    plan = [];
    for (const k of retry.lines) {
      let c = k - 1;
      while (c >= 0 && rp.lines[c].who !== 'them') c--;
      if (c >= 0 && !plan.includes(c)) plan.push(c);
      plan.push(k);
    }
  } else plan = rp.lines.map((_, k) => k);
  const youCount = plan.filter((k) => rp.lines[k].who === 'you').length;
  let p = 0, firstTry = 0;
  const missed = [];

  // Your turn on line k: up to three tries, then the answer is shown and we move on.
  const yourTurn = (k) => {
    const line = rp.lines[k];
    let tries = 0, hintLevel = 0;
    const model = line.model.replace('{name}', name);
    const hint = h('div.hint');
    const fb = h('div.feedback');
    const left = h('span.small.muted.tries', `${MAX_TRIES} tries`);
    const inp = answerInput({
      placeholder: 'Type your answer…',
      onSubmit: (v) => {
        if (!v.trim()) return;
        const verdict = judgeLine(v, line, name);
        tries++;
        clear(fb);
        if (verdict !== 'wrong') {
          if (tries === 1 && hintLevel === 0) { firstTry++; combo.hit(); }
          sfx.correct(combo.value); haptic(10);
          bubble('you', [h('div.no', v), verdict === 'almost' ? h('div.small.bubble-fix', 'Natural: ', model) : null]);
          addXp((verdict === 'correct' ? 8 : 5) * combo.multiplier(), 'roleplay');
          p++;
          setTimeout(step, 500);
          return;
        }
        combo.miss(); sfx.wrong(); haptic([30, 30, 30]);
        if (tries < MAX_TRIES) {
          left.textContent = `${MAX_TRIES - tries} ${MAX_TRIES - tries === 1 ? 'try' : 'tries'} left`;
          add(fb, h('div.bad', 'Not quite. Try again, or take a hint.'), h('div.small', 'Closest: ', diffView(v, model)));
          return;
        }
        // Third miss: show the answer, say it, remember the line for later.
        inp.setDisabled(true);
        missed.push(k);
        bubble('you', [h('div.small.bubble-miss', 'The answer was:'), h('div.no', model)], 'missed');
        clear(controls);
        add(controls, h('div.small.muted.center', 'This line comes back in 15 minutes.'));
        speak(model).then(() => { if (alive) setTimeout(() => { p++; step(); }, 700); });
      },
    });
    const words = model.split(/\s+/);
    add(controls,
      h('div.cue', h('span.cue-label', 'You'), line.cue),
      inp.el,
      h('div.row.between',
        h('button.btn.ghost.small', {
          onclick: () => { hintLevel++; hint.textContent = '💡 ' + words.slice(0, Math.min(words.length, hintLevel * 2)).join(' ') + (hintLevel * 2 < words.length ? ' …' : ''); },
        }, '💡 Hint'),
        left),
      hint, fb);
  };

  const step = async () => {
    if (!alive) return;
    clear(controls);
    if (p >= plan.length) return finish();
    const k = plan[p];
    const line = rp.lines[k];
    if (line.who === 'them') {
      themBubble(line);
      p++;
      const after = plan.slice(p).map((x) => rp.lines[x]).find((l) => l.who === 'them');
      if (after) preload(after.no);
      await speak(line.no);
      if (alive) setTimeout(step, 250);
      return;
    }
    yourTurn(k);
  };

  const finish = () => {
    const pct = youCount ? firstTry / youCount : 1;
    const xp = addXp(missed.length ? 15 : 40 + firstTry * 5, 'roleplay done');
    sfx.goal();
    if (missed.length) {
      // Not done yet: the missed lines come back in 15 minutes.
      const due = Date.now() + RETRY_MS;
      update((s) => { s.roleplays[unit.id] = { ...(s.roleplays[unit.id] ?? {}), last: Date.now(), retry: { due, lines: [...missed] } }; });
      add(controls, h('div.card.center-col.stack.rp-result',
        h('div.big-emoji', '⏳'),
        h('h3', `${missed.length} ${missed.length === 1 ? 'line' : 'lines'} to practise again`),
        h('div.pill.xp', `+${xp} XP`),
        h('p', `Come back at ${clock(due)} and type ${missed.length === 1 ? 'it' : 'them'} again from memory. That gap is what makes it stick.`),
        h('p.small.muted', 'This role-play counts as done once you get them right.'),
        h('a.btn.primary', { href: '#/' }, 'Back to Today')));
      return;
    }
    // All correct (or a retry passed): this role-play is done.
    unlock('speaker');
    update((s) => {
      const prev = s.roleplays[unit.id] ?? {};
      s.roleplays[unit.id] = { best: Math.max(prev.best ?? 0, retry ? (prev.best ?? 0) : pct), last: Date.now() };
    });
    if (pct >= 0.8) confetti(80);
    add(controls, h('div.card.center-col.stack.rp-result',
      h('div.big-emoji', retry ? '✅' : pct >= 0.8 ? '🏆' : '🙌'),
      h('h3', retry ? 'All the missed lines are right now!' : `${firstTry} of ${youCount} answers on the first try`),
      h('div.pill.xp', `+${xp} XP`),
      h('p.small.muted', 'Repeat role-plays a few days apart. Each time it gets more automatic.'),
      embedded ? null : nextStepBlock('speak'),
      h('div.row.wrap.center',
        onDone ? h('button.btn.primary', { onclick: onDone }, embedded ? 'Finish lesson ▸' : 'Done') : h('a.btn', { href: '#/speak' }, 'More role-plays'))));
    if (!embedded) flushCelebrations();
  };

  // A retry that isn't due yet: show when to come back.
  if (retry && retry.due > Date.now()) {
    const left = h('b');
    const tick = () => {
      const ms = retry.due - Date.now();
      if (ms <= 0) { clear(host); mountRoleplay(host, unit, { onDone, embedded }); return; }
      left.textContent = `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;
      waitTimer = setTimeout(tick, 1000);
    };
    clear(host);
    add(host, h('div.card.center-col.stack.rp-wait',
      h('div.big-emoji', '⏳'),
      h('h3', `${retry.lines.length} ${retry.lines.length === 1 ? 'line' : 'lines'} waiting for you`),
      h('p', 'Ready at ', h('b', clock(retry.due)), ' · in ', left),
      h('p.small.muted', 'The short break is on purpose: recalling it after a gap is what moves it into memory.'),
      h('a.btn', { href: '#/' }, 'Back to Today')));
    tick();
    return () => { alive = false; clearTimeout(waitTimer); };
  }

  if (retry) add(chat, h('div.small.muted.center.rp-note', 'Only the lines you missed earlier, each with the line before it.'));
  step();
  return () => { alive = false; clearTimeout(waitTimer); stopSpeaking(); };
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
