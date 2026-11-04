// Speaking hub: role-plays (offline) and the AI conversation partner (optional).

import { h, clear, toast, sfx, add } from '../ui/dom.js';
import { tappable, speakBtn, answerInput } from '../ui/components.js';
import { UNITS, lesson } from '../core/course.js';
import { roleplayBest } from './roleplay.js';
import { settings, update } from '../core/store.js';
import { createConversation, SCENARIOS, MODELS } from '../core/tutor.js';
import { speak, canListen, listenBlocker } from '../core/speech.js';
import { addCard } from '../core/deck.js';
import { addXp, unlock, getGame } from '../core/gamify.js';
import { navigate } from '../ui/router.js';

export function speakView(root) {
  const hasKey = !!settings().aiKey;
  add(root, h('div.stack',
    h('div.page-head', h('h1', 'Snakk'), h('p.muted', 'Conversation is a skill you build by doing it. Speak out loud – mistakes are part of the process.')),
    h('a.card.ai-card', { href: '#/chat' },
      h('div.row.between', h('div', h('div.kicker', '🤖 AI conversation partner'), h('div.strong', 'Have a real conversation at your level'),
        h('div.small.muted', hasKey ? 'Pick a situation and chat – with gentle corrections, translations and suggested replies.' : 'Optional: needs your own Claude API key. Everything else in the app works without it.')),
      h('span.big-emoji', '💬'))),
    h('div.card.tip.small', canListen()
      ? '🎙 Tip: use the microphone. Say the answer out loud even when you type it – speaking aloud activates pronunciation memory (the “production effect”).'
      : h('span', h('b', '🎙 Microphone unavailable here. '), listenBlocker(), ' You can still type – and say each answer out loud anyway: the “production effect” makes spoken words stick better.')),
    h('h2', 'Role-plays'),
    h('div.stack', ...UNITS.map((u, i) => {
      const best = roleplayBest(u.id);
      return h('a.card.row.between', { href: `#/roleplay/${u.id}` },
        h('div', h('div.small.muted', `Unit ${i + 1}${lesson(u.id).done ? ' ✓' : ''}`), h('div.strong', u.roleplay.title), h('div.small.muted', `with ${u.roleplay.partner}`)),
        best != null ? h('span.pill', `${Math.round(best * 100)}%`) : h('span.pill.ghost', 'Try'));
    }))));
}

export function chatView(root) {
  root.classList.add('focus-view');
  const head = h('div.lesson-head', h('a.icon-btn', { href: '#/speak', 'aria-label': 'Back' }, '✕'), h('div.lesson-title', h('div.strong', 'AI conversation')));
  const body = h('div.lesson-body.stack');
  add(root, head, body);
  if (!settings().aiKey) return keySetup(body);
  pickScenario(body);
}

function keySetup(el) {
  const key = h('input.input', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off' });
  const model = h('select.input', ...MODELS.map((m) => h('option', { value: m.id, selected: m.id === settings().aiModel }, m.label)));
  add(el, h('div.card.stack',
    h('div.kicker', '🔑 Connect your Claude API key'),
    h('p', 'The AI partner talks with you at your level, corrects you gently and suggests what to say next. It uses your own API key, sent directly from this browser to Anthropic – no server in between.'),
    h('ol.small',
      h('li', 'Create a key at ', h('a', { href: 'https://console.anthropic.com/settings/keys', target: '_blank', rel: 'noopener' }, 'console.anthropic.com'), ' (usage is billed to your account; a 10-minute chat typically costs a few cents).'),
      h('li', 'Paste it below. It’s stored only in this browser’s local storage – don’t do this on a shared computer.')),
    key, model,
    h('button.btn.primary', {
      onclick: () => {
        if (!key.value.trim().startsWith('sk-')) return toast('That doesn’t look like an API key.', { kind: 'warn' });
        update((s) => { s.settings.aiKey = key.value.trim(); s.settings.aiModel = model.value; });
        navigate('#/chat');
      },
    }, 'Save and start')));
}

function pickScenario(el) {
  add(el, h('div.stack',
    h('h2', 'Choose a situation'),
    h('div.grid2', ...SCENARIOS.map((s) => h('button.card.tile-link', { onclick: () => startChat(el, s.id) },
      h('div.big-emoji', s.icon), h('div.strong', s.title))))));
}

function startChat(el, scenarioId) {
  clear(el);
  const conv = createConversation(scenarioId);
  const log = h('div.chat');
  const sugg = h('div.chips.suggestions');
  const status = h('div.small.muted');
  const gathered = [];
  let busy = false;
  let sent = 0;

  const aiBubble = (out) => {
    const en = h('div.bubble-en.hidden', out.translation);
    const b = h('div.bubble.them',
      h('div.no', tappable(out.reply, { sentence: out.reply, translation: out.translation, src: 'ai' })),
      en,
      h('div.bubble-tools', speakBtn(out.reply), h('button.link', { onclick: () => en.classList.toggle('hidden') }, 'EN')));
    add(log, b);
    b.scrollIntoView({ block: 'end', behavior: 'smooth' });
    speak(out.reply);
    clear(sugg);
    for (const s of out.suggestions.slice(0, 3)) add(sugg, h('button.chip', { onclick: () => { inp.input.value = s; inp.input.focus(); } }, s));
    for (const w of out.new_words ?? []) if (!gathered.some((g) => g.no === w.no)) gathered.push(w);
  };

  const correctionBox = (c) => c?.needed && c.corrected ? h('div.bubble-fix', h('div', '✏️ ', h('span.no', c.corrected), ' ', speakBtn(c.corrected)), c.explanation ? h('div.small.muted', c.explanation) : null) : null;

  const send = async (text) => {
    if (busy) return;
    busy = true;
    inp.setDisabled(true);
    status.textContent = '…';
    let you = null;
    if (text != null) {
      you = h('div.bubble.you', h('div.no', text));
      add(log, you);
      you.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
    try {
      const out = await conv.send(text);
      if (you) {
        const fix = correctionBox(out.correction);
        if (fix) add(you, fix); else you.classList.add('ok');
        sent++;
        update((s) => { s.game ??= {}; s.game.chats = (s.game.chats || 0) + 1; });
        if ((getGame().chats || 0) >= 5) unlock('chat');
        addXp(out.correction?.needed ? 5 : 8, 'chat');
        if (!out.correction?.needed) sfx.correct();
      }
      aiBubble(out);
      status.textContent = '';
    } catch (e) {
      status.textContent = '';
      add(log, h('div.card.bad.small', e.message));
      if (you) you.remove();
    }
    busy = false;
    inp.setDisabled(false);
    inp.input.value = '';
    inp.input.focus();
  };

  const inp = answerInput({ placeholder: 'Skriv eller snakk på norsk…', onSubmit: (v) => { if (v.trim()) send(v.trim()); } });
  inp.el.querySelector('.btn.primary').textContent = 'Send';
  add(el, 
    h('div.row.between', h('div', h('div.kicker', `${conv.scenario.icon} ${conv.scenario.title}`), h('div.small.muted', 'Tap words for meanings · EN shows a translation · ✏️ shows a correction')),
      h('button.btn.ghost.small', { onclick: () => finish() }, 'End')),
    log, status, sugg, inp.el);

  const finish = () => {
    clear(el);
    add(el, h('div.stack.center-col',
      h('div.big-emoji', '🗣️'),
      h('h2', sent ? `You sent ${sent} message${sent > 1 ? 's' : ''} in Norwegian!` : 'Conversation ended'),
      gathered.length ? h('div.card.stack', h('div.kicker', 'New words from this chat'),
        ...gathered.map((w) => h('div.row.between', h('span', h('b.no', w.no), ' – ', w.en),
          h('button.btn.small', { onclick: (e) => { addCard({ no: w.no, en: w.en, src: 'ai' }); e.currentTarget.replaceWith(h('span.pill.ok', '✓')); } }, '＋')))) : null,
      h('div.row.wrap.center', h('button.btn', { onclick: () => { clear(el); pickScenario(el); } }, 'New conversation'), h('a.btn.primary', { href: '#/' }, 'Home'))));
  };

  send(null);
}
