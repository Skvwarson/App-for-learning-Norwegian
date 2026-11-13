// Tiny DOM toolkit + feedback effects (toasts, modals, confetti, sounds, haptics).

import { settings } from '../core/store.js';

/** h('div.card#id', {onclick, class, ...}, ...children) */
export function h(sel, attrs, ...children) {
  if (attrs == null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) {
    if (attrs != null) children.unshift(attrs);
    attrs = {};
  }
  const m = sel.match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m?.[1] || 'div');
  for (const part of (m?.[2] || '').match(/[.#][\w-]+/g) ?? []) {
    if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

/** Null-safe append: skips null/undefined/false (native append would print "null"). */
export function add(parent, ...children) {
  append(parent, children);
  return parent;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

// ---------- Toasts ----------
export function toast(content, { kind = '', ms = 2600, icon = '' } = {}) {
  const box = $('#toasts');
  if (!box) return;
  const t = h('div.toast', { class: kind, role: 'status' }, icon ? h('span.toast-icon', icon) : null, h('div', content));
  while (box.children.length >= 2) box.firstElementChild.remove();
  box.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

/** Floating "+10 XP" near an element. */
export function floatXp(amount, anchor) {
  const r = (anchor ?? $('.xp-chip'))?.getBoundingClientRect();
  if (!r) return;
  const f = h('div.float-xp', `+${amount} XP`);
  f.style.left = `${r.left + r.width / 2}px`;
  f.style.top = `${r.top}px`;
  document.body.append(f);
  setTimeout(() => f.remove(), 1100);
}

// ---------- Modal ----------
export function modal(content, { onClose, dismissable = true, cls = '' } = {}) {
  const back = h('div.modal-back');
  const box = h('div.modal', { class: cls, role: 'dialog', 'aria-modal': 'true' });
  append(box, [content]);
  back.append(box);
  const close = () => { back.classList.remove('show'); setTimeout(() => back.remove(), 200); onClose?.(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape' && dismissable) close(); };
  if (dismissable) back.addEventListener('click', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', esc);
  document.body.append(back);
  requestAnimationFrame(() => back.classList.add('show'));
  return { close, box };
}

export function confirmModal(text, { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    let m;
    // Resolve first: closing the modal also fires onClose, which would answer "false".
    const done = (v) => { resolve(v); m.close(); };
    m = modal(h('div.stack',
      h('p', text),
      h('div.row.end', h('button.btn.ghost', { onclick: () => done(false) }, cancel),
        h('button.btn', { class: danger ? 'danger' : 'primary', onclick: () => done(true) }, ok))), { onClose: () => resolve(false) });
  });
}

// ---------- Confetti ----------
export function confetti(pieces = 120) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  pieces = Math.min(pieces, 70); // plenty to feel festive, light enough for older phones
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const c = h('canvas.confetti');
  document.body.append(c);
  const ctx = c.getContext('2d');
  const W = (c.width = innerWidth * dpr), H = (c.height = innerHeight * dpr);
  const colors = ['#ba0c2f', '#00205b', '#ffffff', '#f2c14e', '#3fa27a', '#5aa9e6'];
  const ps = Array.from({ length: pieces }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
    vx: (Math.random() - 0.5) * 18 * dpr, vy: (-Math.random() * 16 - 6) * dpr,
    r: (4 + Math.random() * 5) * dpr, c: colors[(Math.random() * colors.length) | 0],
    a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.3,
  }));
  let frame = 0;
  (function tick() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.vy += 0.45 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.setTransform(Math.cos(p.a), Math.sin(p.a), -Math.sin(p.a), Math.cos(p.a), p.x, p.y);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
    }
    if (++frame < 120) requestAnimationFrame(tick); else c.remove();
  })();
}

// ---------- Sounds (synthesised, no audio files needed) ----------
let actx = null;
function audio() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

function tone(freq, start, dur, { type = 'sine', vol = 0.12 } = {}) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  vol *= Math.max(0, Math.min(1, Number(settings().volume ?? 1)));
  if (vol <= 0) return;
  g.gain.linearRampToValueAtTime(vol, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start); o.stop(a.currentTime + start + dur + 0.05);
}

// A short burst of filtered noise: sounds like a mechanical click rather than a beep.
function click(start, { freq = 2500, q = 6, dur = 0.03, vol = 0.12 } = {}) {
  const a = audio();
  if (!a) return;
  vol *= Math.max(0, Math.min(1, Number(settings().volume ?? 1)));
  if (vol <= 0) return;
  const n = Math.ceil(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3; // sharp attack, quick decay
  const src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q; g.gain.value = vol;
  src.connect(bp).connect(g).connect(a.destination);
  src.start(a.currentTime + start);
}

// ---- UI sound designs: short, soft and "physical" rather than beeps ----
function out(a, vol) { const g = a.createGain(); g.gain.value = vol * Math.max(0, Math.min(1, Number(settings().volume ?? 1))); g.connect(a.destination); return g; }
/** A sine (plus optional overtones) with a fast attack, exponential decay and an optional pitch glide. */
function blip(start, { f0, f1 = f0, glide = 0.02, decay = 0.02, vol = 0.2, partials = [[1, 1]] }) {
  const a = audio(); if (!a) return;
  const t0 = a.currentTime + start, g = out(a, 1), env = a.createGain();
  env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(vol, t0 + 0.0015); env.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * 6);
  env.connect(g);
  for (const [mul, amp] of partials) {
    const o = a.createOscillator(), pg = a.createGain();
    o.frequency.setValueAtTime(f0 * mul, t0); o.frequency.exponentialRampToValueAtTime(f1 * mul, t0 + glide);
    pg.gain.value = amp; o.connect(pg).connect(env); o.start(t0); o.stop(t0 + decay * 6 + 0.02);
  }
}
/** Filtered noise that swells and fades, with the filter sweeping up: a soft "whoosh". */
function whoosh(start, dur = 0.26, vol = 0.12) {
  const a = audio(); if (!a) return;
  const t0 = a.currentTime + start, n = Math.ceil(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / n) ** 2;
  const src = a.createBufferSource(), bp = a.createBiquadFilter();
  src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(600, t0); bp.frequency.exponentialRampToValueAtTime(2400, t0 + dur);
  src.connect(bp).connect(out(a, vol)); src.start(t0);
}
const TAP = {
  tick: () => blip(0, { f0: 2400, f1: 1500, glide: 0.012, decay: 0.005, vol: 0.09 }),
  wood: () => { blip(0, { f0: 820, decay: 0.007, vol: 0.13, partials: [[1, 1], [2, 0.45], [3, 0.2]] }); click(0, { freq: 2500, dur: 0.01, vol: 0.04 }); },
  pop: () => blip(0, { f0: 380, f1: 950, glide: 0.035, decay: 0.008, vol: 0.13 }),
  off: null,
};
const NAV = {
  whoosh: () => { whoosh(0); blip(0.22, { f0: 700, decay: 0.008, vol: 0.1, partials: [[1, 1], [2, 0.4]] }); },
  revolver: () => {
    [[0, 1500, 0.05], [0.09, 1600, 0.06], [0.16, 1700, 0.07]].forEach(([t, f, v]) => blip(t, { f0: f, decay: 0.004, vol: v, partials: [[1, 1], [2, 0.3]] }));
    blip(0.26, { f0: 180, decay: 0.012, vol: 0.2, partials: [[1, 1], [2, 0.6], [6.1, 0.3]] });
  },
  chime: () => { blip(0, { f0: 784, decay: 0.05, vol: 0.08, partials: [[1, 1], [2, 0.25]] }); blip(0.07, { f0: 1175, decay: 0.05, vol: 0.1, partials: [[1, 1], [2, 0.25]] }); },
  off: null,
};
export const SOUND_CHOICES = {
  tap: [['tick', 'Soft tick'], ['wood', 'Wooden tock'], ['pop', 'Bubble pop'], ['off', 'None']],
  nav: [['revolver', 'Revolver'], ['whoosh', 'Whoosh'], ['chime', 'Chime'], ['off', 'None']],
};
export const playSound = (kind, id) => (kind === 'tap' ? TAP : NAV)[id]?.();

export const sfx = {
  correct(combo = 0) {
    if (!settings().sound) return;
    const lift = Math.min(combo, 12) * 0.04; // pitch rises with the combo, momentum you can hear
    tone(784 * (1 + lift), 0, 0.12); tone(1175 * (1 + lift), 0.07, 0.18);
  },
  almost() { if (settings().sound) { tone(660, 0, 0.12, { type: 'triangle' }); tone(740, 0.08, 0.14, { type: 'triangle' }); } },
  wrong() { if (settings().sound) tone(220, 0, 0.22, { type: 'triangle', vol: 0.1 }); },
  bonus() { if (settings().sound) [988, 1319, 1568, 1976].forEach((f, i) => tone(f, i * 0.06, 0.2, { vol: 0.1 })); },
  levelUp() { if (settings().sound) [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.35, { type: 'triangle', vol: 0.12 })); },
  goal() { if (settings().sound) [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.11, 0.4, { vol: 0.11 })); },
  tap() { if (settings().sound) tone(1200, 0, 0.04, { vol: 0.04 }); },
  /** Sound for anything you press – picked in Settings (tapSound). */
  press() { if (settings().sound) TAP[settings().tapSound ?? 'tick']?.(); },
  /** Sound for changing page with the bottom menu – picked in Settings (navSound). */
  spin() { if (settings().sound) NAV[settings().navSound ?? 'revolver']?.(); },
};

export function haptic(pattern = 12) {
  if (settings().haptics && navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* ignore */ } }
}

// ---------- Progress ring (SVG) ----------
/** Run fn after the element has been painted once (so a CSS transition can play from the start value). */
const afterPaint = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

/** animate: fill up from empty when first shown (for progress worth noticing). */
export function ring(pct, { size = 44, stroke = 5, label = '', cls = '', animate = false } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  const offset = c * (1 - p);
  const wrap = h('div.ring', { class: cls, style: { width: `${size}px`, height: `${size}px` } });
  wrap.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ring-bg)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ring-fg)" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" style="stroke-dashoffset:${animate ? c : offset}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
  if (animate) afterPaint(() => { const arc = wrap.querySelector('circle:last-child'); if (arc) arc.style.strokeDashoffset = offset; });
  if (label) add(wrap, h('span.ring-label', label));
  return wrap;
}

export function progressBar(pct, cls = '', { animate = false } = {}) {
  const width = `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%`;
  const fill = h('div.progress-fill', { style: { width: animate ? '0%' : width } });
  if (animate) afterPaint(() => { fill.style.width = width; });
  return h('div.progress', { class: cls }, fill);
}

export function download(filename, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
