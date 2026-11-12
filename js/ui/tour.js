// First-run tutorial: dims the screen, spotlights one part of Today at a time and
// explains it in a sentence. Shown after the welcome screen (so also after a reset),
// and again from Settings.

import { h } from './dom.js';
import { update } from '../core/store.js';

const STEPS = [
  { sel: '.start-btn, .all-done', title: 'One button a day', text: 'Press Start and the app walks you through everything for today. That’s all you need to do.' },
  { sel: '.today-steps', title: 'Today’s four steps', text: 'Review old words, learn new ones, read a short story, then speak in a role-play. Each one ticks off as you finish it.' },
  { sel: '.chip-streak', title: 'Your streak', text: 'Days in a row with some Norwegian. A few minutes is enough to keep it going.' },
  { sel: '.race-card', title: 'The race', text: 'You against your friend: who learns more this week?' },
  { sel: '.tabbar', growTop: 30, title: 'Getting around', text: 'The page you’re on sits in the middle. Tap a side one and the menu spins round to it.' },
  { sel: '.avatar-btn', title: 'You', text: 'Your progress, your words and settings (volume, voice speed and backup).' },
];

let active = null;

export function startTour({ onDone } = {}) {
  active?.end(false);
  let i = -1;
  const hole = h('div.tour-hole');
  const title = h('div.tour-title'), text = h('p.tour-text'), dots = h('div.tour-dots');
  const nextBtn = h('button.btn.primary', { type: 'button' }, 'Next');
  const tip = h('div.tour-tip', { role: 'dialog', 'aria-live': 'polite' },
    h('div.tour-count', dots), title, text,
    h('div.tour-actions', h('button.btn.ghost.small', { type: 'button', onclick: () => end(true) }, 'Skip'), nextBtn));
  const layer = h('div.tour', { onclick: (e) => { if (e.target === layer) go(); } }, hole, tip);
  document.body.append(layer);
  document.body.classList.add('touring');

  const targets = () => STEPS.map((s) => ({ ...s, el: document.querySelector(s.sel) })).filter((s) => s.el && s.el.getClientRects().length);
  let list = targets();

  const place = () => {
    const step = list[i];
    if (!step) return;
    const r = step.el.getBoundingClientRect();
    const pad = 8, up = step.growTop || 0; // the raised nav bubble sticks out above its bar
    Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad - up}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2 + up}px`,
      borderRadius: getComputedStyle(step.el).borderRadius === '50%' || r.width === r.height ? '50%' : '18px' });
    // Tooltip above or below the spotlight, whichever has more room.
    const below = r.top + r.height / 2 < innerHeight / 2;
    tip.style.top = below ? `${Math.min(innerHeight - tip.offsetHeight - 12, r.bottom + pad + 12)}px` : '';
    tip.style.bottom = below ? '' : `${Math.min(innerHeight - 12 - tip.offsetHeight, innerHeight - r.top + pad + up + 12)}px`;
  };

  const go = () => {
    i++;
    list = targets();
    if (i >= list.length) return end(true);
    const step = list[i];
    title.textContent = step.title;
    text.textContent = step.text;
    nextBtn.textContent = i === list.length - 1 ? 'Got it, let’s start' : 'Next';
    dots.replaceChildren(...list.map((_, k) => h('span', { class: k === i ? 'on' : '' })));
    const r = step.el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > innerHeight - 90) step.el.scrollIntoView({ block: 'center', behavior: 'instant' });
    requestAnimationFrame(place);
  };
  nextBtn.onclick = go;

  const onKey = (e) => { if (e.key === 'Escape') end(true); else if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); go(); } };
  addEventListener('keydown', onKey);
  addEventListener('resize', place);
  addEventListener('scroll', place, { passive: true });

  function end(finished) {
    removeEventListener('keydown', onKey);
    removeEventListener('resize', place);
    removeEventListener('scroll', place);
    layer.classList.add('leaving');
    setTimeout(() => layer.remove(), 200);
    document.body.classList.remove('touring');
    active = null;
    if (finished) { update((s) => { s.game ??= {}; s.game.toured = true; }); onDone?.(); }
  }
  active = { end };
  requestAnimationFrame(() => { layer.classList.add('show'); go(); });
}

export { STEPS as TOUR_STEPS };
