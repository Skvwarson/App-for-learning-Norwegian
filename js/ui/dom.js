// Tiny DOM toolkit + feedback effects (toasts, modals, confetti, sounds, haptics).

import { settings } from '../core/store.js';
import { audioContext, effectsOut } from '../core/audio.js';
import { SFX_FILES } from '../../data/sfx.js';

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
// Sound effects share the app's one audio engine with the voices, on their own
// effects level (Settings → Effects volume) under the master volume.
const audio = () => audioContext();

function tone(freq, start, dur, { type = 'sine', vol = 0.12 } = {}) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(effectsOut());
  o.start(a.currentTime + start); o.stop(a.currentTime + start + dur + 0.05);
}

// ---- Tap & page-change sounds ----
// What makes a UI sound pleasant rather than annoying, heard hundreds of times a day:
// low-mid and rounded (filtered, no piercing highs), very short, quiet, one event per
// gesture, and never exactly the same twice (tiny random pitch/level changes).
const vary = (amt) => 1 + (Math.random() * 2 - 1) * amt;
let noiseBuf = null;
function noise(a) { // 2 s of white noise, made once; each hit plays a random slice of it
  if (!noiseBuf || noiseBuf.sampleRate !== a.sampleRate) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
/** Gain that rises in `attack` seconds and dies away exponentially (time constant `tau`). */
function env(a, t0, vol, tau, attack = 0.002) {
  const g = a.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.setTargetAtTime(0, t0 + attack, tau);
  return g;
}
const lowpass = (a, f, dest) => { const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f; lp.Q.value = 0.5; lp.connect(dest); return lp; };

/** A struck, pitched body: partials are [frequency ratio, level, decay ratio]. */
function strike(start, { f, to, glide = 0.02, vol, tau, attack = 0.002, partials = [[1, 1, 1]], lp = 4000 }) {
  const a = audio(); if (!a) return;
  const t0 = a.currentTime + start, filt = lowpass(a, lp, effectsOut());
  for (const [ratio, amp, tm = 1] of partials) {
    const o = a.createOscillator(), g = env(a, t0, vol * amp, tau * tm, attack);
    o.frequency.setValueAtTime(f * ratio, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to * ratio, t0 + glide);
    o.connect(g).connect(filt);
    o.start(t0); o.stop(t0 + attack + tau * tm * 8);
  }
}
/** Filtered noise: a short hit (tau) or a swell over `dur` with a band sweeping `from` → `to`. */
function hiss(start, { vol, tau, dur, hp = 300, lp = 4000, from, to, q = 1.2 }) {
  const a = audio(); if (!a) return;
  const t0 = a.currentTime + start, len = dur ?? tau * 8, src = a.createBufferSource();
  src.buffer = noise(a);
  const h = a.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
  let chain = src.connect(h);
  if (from) {
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(from, t0); bp.frequency.exponentialRampToValueAtTime(to, t0 + len);
    chain = chain.connect(bp);
  }
  let g;
  if (dur) { // swell in, fade out
    g = a.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + len * 0.4); g.gain.linearRampToValueAtTime(0, t0 + len);
  } else g = env(a, t0, vol, tau, 0.0008);
  chain.connect(g).connect(lowpass(a, lp, effectsOut()));
  src.start(t0, Math.random() * 1.5, len + 0.02);
}

// Marimba-like bar: its overtones sit at ~3.9× and ~9.2× the note, which is what makes it warm.
const BAR = [[1, 1, 1], [3.93, 0.28, 0.32], [9.2, 0.07, 0.14]];
const mallet = (start, f, vol, tau = 0.075) => { strike(start, { f, vol, tau, attack: 0.0015, partials: BAR, lp: 5200 }); hiss(start, { vol: vol * 0.12, tau: 0.0015, hp: 600, lp: 2500 }); };
const PENTA = [392, 440, 493.88, 587.33, 659.25]; // G major pentatonic: any two notes sound good together
let lastNote = -1;

const TAP = {
  // Deep, creamy keyboard "thock": a low body that drops in pitch, with a soft felt edge.
  thock: () => {
    const p = vary(0.04);
    strike(0, { f: 300 * p, to: 185 * p, glide: 0.022, vol: 0.28 * vary(0.1), tau: 0.011, partials: [[1, 1, 1], [2.6, 0.2, 0.5]], lp: 1500 });
    hiss(0, { vol: 0.06, tau: 0.0025, hp: 900, lp: 3500 });
  },
  // A water droplet: a round sine that bends upwards.
  drop: () => { const p = vary(0.07); strike(0, { f: 430 * p, to: 1150 * p, glide: 0.035, vol: 0.22 * vary(0.1), tau: 0.016, attack: 0.003, lp: 2800 }); },
  // A soft marimba note, a different one of a five-note scale each time.
  marimba: () => {
    let i; do i = Math.floor(Math.random() * PENTA.length); while (i === lastNote);
    lastNote = i; mallet(0, PENTA[i], 0.16 * vary(0.1), 0.06);
  },
  // Barely there, like a phone keyboard click.
  click: () => {
    hiss(0, { vol: 0.13 * vary(0.12), tau: 0.0022, hp: 1400, lp: 5500 });
    strike(0, { f: 160, to: 115, glide: 0.01, vol: 0.12, tau: 0.007, lp: 700 });
  },
  off: null,
};
// dir: +1 = the menu turned right, -1 = left. Each sound points the way you went.
const NAV = {
  // Two marimba notes: up when you go right, down when you go left.
  notes: (dir = 1) => {
    const [a, b] = dir < 0 ? [783.99, 587.33] : [587.33, 783.99];
    mallet(0, a, 0.12, 0.07); mallet(0.075, b, 0.15, 0.1);
  },
  // A quick, airy swipe that ends in a soft landing.
  swipe: (dir = 1) => {
    const [from, to] = dir < 0 ? [1800, 600] : [600, 1800];
    hiss(0, { vol: 0.16, dur: 0.15, hp: 250, lp: 3000, from, to, q: 1.1 });
    strike(0.13, { f: 240, to: 170, glide: 0.02, vol: 0.2, tau: 0.012, partials: [[1, 1, 1], [2.6, 0.2, 0.5]], lp: 1400 });
  },
  // One notch of a dial clicking into place.
  dial: (dir = 1) => {
    const f = dir < 0 ? 470 : 540;
    hiss(0, { vol: 0.09, tau: 0.002, hp: 1500, lp: 5000 });
    strike(0, { f, vol: 0.13, tau: 0.018, attack: 0.001, partials: [[1, 1, 1], [2.76, 0.35, 0.4]], lp: 3200 });
    strike(0.004, { f: 150, to: 110, glide: 0.015, vol: 0.2, tau: 0.012, lp: 800 });
  },
  off: null,
};
export const SOUND_CHOICES = {
  tap: [['thock', 'Thock'], ['drop', 'Drop'], ['marimba', 'Marimba'], ['click', 'Click'], ['off', 'None']],
  nav: [['notes', 'Two notes'], ['swipe', 'Swipe'], ['dial', 'Dial'], ['off', 'None']],
};
// ---- Recorded sound effects (data/sfx.js) ----
// Kept apart from the voice cache, so they are never pushed out by recordings.
const recorded = new Map(); // name → AudioBuffer[]
const lastVariant = new Map();
let sfxLoading = null;
/** Load every recorded effect listed in data/sfx.js (once). */
export function preloadSfx() {
  if (sfxLoading) return sfxLoading;
  const a = audio();
  if (!a) return Promise.resolve();
  sfxLoading = Promise.all(Object.entries(SFX_FILES).map(async ([name, count]) => {
    const bufs = await Promise.all(Array.from({ length: count }, (_, i) =>
      fetch(`audio/sfx/${name}-${i + 1}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((d) => (d ? new Promise((res, rej) => a.decodeAudioData(d, res, rej)) : null)).catch(() => null)));
    const ok = bufs.filter(Boolean);
    if (ok.length) recorded.set(name, ok);
  }));
  return sfxLoading;
}
const hasFile = (name) => !!SFX_FILES[name];
/** Play a recorded effect (a different variant than last time). False if it isn't loaded. */
function playRecorded(name, { rate = 1 } = {}) {
  const list = recorded.get(name);
  if (!list) { preloadSfx(); return false; }
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastVariant.get(name)) i = (i + 1) % list.length;
  lastVariant.set(name, i);
  const a = audio(), src = a.createBufferSource(), g = a.createGain();
  src.buffer = list[i]; src.playbackRate.value = rate * vary(0.015);
  g.gain.value = vary(0.06);
  src.connect(g).connect(effectsOut()); src.start();
  return true;
}
/** A recorded effect if there is one, else the built-in sound. */
const fx = (name, synth, opts) => { if (!settings().sound) return; if (!playRecorded(name, opts)) synth(); };
if (Object.keys(SFX_FILES).length) {
  TAP.rec = () => playRecorded('tap') || TAP.thock();
  NAV.rec = (dir = 1) => playRecorded(dir < 0 && hasFile('page-left') ? 'page-left' : 'page-right') || NAV.notes(dir);
  if (hasFile('tap')) SOUND_CHOICES.tap.unshift(['rec', 'Recorded']);
  if (hasFile('page-right')) SOUND_CHOICES.nav.unshift(['rec', 'Recorded']);
}

// Earlier sound names, so a saved choice still means something.
const OLD = { tick: 'click', wood: 'thock', pop: 'drop', revolver: 'dial', whoosh: 'swipe', chime: 'notes' };
/** The sound id in use for 'tap' or 'nav' (falls back to the first choice). */
export function soundChoice(kind, id) {
  const table = kind === 'tap' ? TAP : NAV, x = OLD[id] ?? id;
  return x in table && table[x] ? x : SOUND_CHOICES[kind][0][0];
}
export const playSound = (kind, id, dir) => (kind === 'tap' ? TAP : NAV)[soundChoice(kind, id)]?.(dir);

// The built-in fanfares, used until recorded ones are added.
const arp = (notes, step, dur, opts) => () => notes.forEach((f, i) => tone(f, i * step, dur, opts));
const GOAL = arp([784, 988, 1175, 1568], 0.11, 0.4, { vol: 0.11 });
const LEVEL = arp([523, 659, 784, 1047, 1319], 0.09, 0.35, { type: 'triangle', vol: 0.12 });

let lastPress = 0;
export const sfx = {
  correct(combo = 0) {
    const lift = Math.min(combo, 12) * 0.04; // pitch rises with the combo, momentum you can hear
    fx('correct', () => { tone(784 * (1 + lift), 0, 0.12); tone(1175 * (1 + lift), 0.07, 0.18); }, { rate: 1 + Math.min(combo, 8) * 0.025 });
  },
  almost() { fx('almost', () => { tone(660, 0, 0.12, { type: 'triangle' }); tone(740, 0.08, 0.14, { type: 'triangle' }); }); },
  wrong() { fx('wrong', () => tone(220, 0, 0.22, { type: 'triangle', vol: 0.1 })); },
  bonus() { fx('bonus', arp([988, 1319, 1568, 1976], 0.06, 0.2, { vol: 0.1 })); },
  /** Finished a part: the words, a review session, a story, a drill, a role-play. */
  goal() { fx('step-done', GOAL); },
  streak() { fx('streak', GOAL); },
  lessonDone() { fx('lesson-done', LEVEL); },
  levelUp() { fx('level-up', LEVEL); },
  dayDone() { fx('day-done', LEVEL); },
  /** A word tile placed in (or taken out of) an answer. */
  tap() { fx('tile', () => tone(1200, 0, 0.04, { vol: 0.04 })); },
  /** Sound for anything you press – picked in Settings (tapSound). */
  press() {
    if (!settings().sound) return;
    const now = performance.now();
    if (now - lastPress < 45) return; // never a machine-gun of clicks
    lastPress = now;
    playSound('tap', settings().tapSound);
  },
  /** Sound for changing page with the bottom menu – picked in Settings (navSound). */
  spin(dir = 1) { if (settings().sound) { lastPress = performance.now(); playSound('nav', settings().navSound, dir); } },
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
