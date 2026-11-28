// One shared Web Audio engine for the whole app: voice recordings and sound
// effects play through the same context and the same volume control, so they
// never interrupt each other (iPhone Safari is strict about this).

import { settings } from './store.js';

const hasWindow = typeof window !== 'undefined';
let ctx = null, master = null, fx = null, unlocked = false;

/** The shared AudioContext (created on first use), or null if the browser has none. */
export function audioContext() {
  if (!hasWindow) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    fx = ctx.createGain(); // sound effects get their own level on top of the master volume
    fx.connect(master);
    applyMasterVolume();
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

/** Everything app-made goes through here: the Settings volume applies to all of it. */
export function masterOut() { audioContext(); return master; }

/** Sound effects go through here: master volume × the effects volume. */
export function effectsOut() { audioContext(); return fx; }

const clamp01 = (v, d) => Math.max(0, Math.min(1, Number(v ?? d)));
export function applyMasterVolume() {
  if (master) master.gain.value = clamp01(settings().volume, 1);
  if (fx) fx.gain.value = clamp01(settings().sfxVolume, 0.7);
}

// On iPhone, play app audio even when the ringer switch is on silent (Safari 16.4+).
if (hasWindow && navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch { /* older Safari */ } }

// Audio may only start after a tap: wake the context on every tap (cheap) and play
// one silent sample the first time, which unlocks it for good on iOS.
function unlock() {
  const c = audioContext();
  if (!c || unlocked) return;
  unlocked = true;
  try {
    const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
    s.buffer = b; s.connect(c.destination); s.start(0);
  } catch { unlocked = false; }
}
if (hasWindow) {
  for (const ev of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(ev, unlock, { capture: true, passive: true });
}

// ---------- Recordings as decoded buffers ----------
// Decoded once and kept in memory, so they start instantly and always play to the end.
const buffers = new Map(); // url → Promise<AudioBuffer | null>
const MAX = 80;

/** Load and decode a recording (cached). Resolves null if it can't be loaded. */
export function loadBuffer(url) {
  if (buffers.has(url)) { const p = buffers.get(url); buffers.delete(url); buffers.set(url, p); return p; } // keep recent
  const c = audioContext();
  if (!c) return Promise.resolve(null);
  const p = fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((data) => (data ? new Promise((res, rej) => c.decodeAudioData(data, res, rej)) : null))
    .catch(() => null);
  buffers.set(url, p);
  p.then((b) => { if (!b) buffers.delete(url); });
  while (buffers.size > MAX) buffers.delete(buffers.keys().next().value);
  return p;
}

let current = null; // the buffer source playing now
let currentEnd = null; // Promise that resolves when it has finished (or was stopped)
/** Resolves when the recording that's playing now ends (at once if nothing is playing). */
export const untilQuiet = () => (current && currentEnd) || Promise.resolve();
/** Stop whatever recording is playing. */
export function stopBuffer() {
  if (current) { try { current.onended = null; current.stop(); } catch { /* already stopped */ } current = null; }
}

/** Play a decoded recording. Resolves true when it has played to the end, false if stopped. */
export function playBuffer(buffer, rate = 1) {
  const c = audioContext();
  if (!c || !buffer) return Promise.resolve(false);
  stopBuffer();
  const done = new Promise((resolve) => {
    const s = c.createBufferSource();
    s.buffer = buffer;
    s.playbackRate.value = rate;
    s.connect(masterOut());
    s.onended = () => { if (current === s) current = null; resolve(true); };
    current = s;
    const prevStop = s.stop.bind(s);
    s.stop = (...a) => { resolve(false); return prevStop(...a); };
    s.start(0);
  });
  currentEnd = done;
  return done;
}
