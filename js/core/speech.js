// Norwegian audio.
//
// 1. A real recording of the exact sentence (data/recordings.js), if there is one.
// 2. Otherwise the device's built-in voice. Norwegian voices are ranked by quality
//    (Edge "Natural", Apple "Enhanced/Premium", Google …) and an English voice is
//    never allowed to read Norwegian (that's how "Vi sees" turns into "six sees").
//
// Speech recognition (the 🎙 buttons) is at the bottom.

import { settings } from './store.js';
import { normalize } from './text.js';
import { recordingEntries } from '../../data/recordings.js';

const hasWindow = typeof window !== 'undefined';
const synth = hasWindow ? window.speechSynthesis : null;
let voicesCache = [];

function loadVoices() {
  if (!synth) return [];
  voicesCache = synth.getVoices();
  return voicesCache;
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}

/** Chrome loads voices asynchronously – wait briefly before concluding there are none. */
export function voicesReady(timeoutMs = 1200) {
  if (!synth || loadVoices().length) return Promise.resolve(voicesCache);
  return new Promise((resolve) => {
    const done = () => resolve(loadVoices());
    synth.addEventListener?.('voiceschanged', done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

const isNorwegian = (v) => /^(nb|no|nn)([-_]|$)/i.test(v.lang) || /norw|norsk|bokmål/i.test(v.name);

/** Higher is better. Neural/“natural” voices sound far more human than classic ones. */
export function voiceQuality(v) {
  const n = `${v.name} ${v.voiceURI}`;
  if (/natural|neural|premium|enhanced|wavenet/i.test(n)) return 3;
  if (/google|online/i.test(n)) return 2;
  return 1;
}

export function norwegianVoices() {
  return (voicesCache.length ? voicesCache : loadVoices())
    .filter(isNorwegian)
    .sort((a, b) => voiceQuality(b) - voiceQuality(a) || Number(/^nb/i.test(b.lang)) - Number(/^nb/i.test(a.lang)));
}

export function pickVoice() {
  const all = norwegianVoices();
  const chosen = settings().voiceURI && all.find((v) => v.voiceURI === settings().voiceURI);
  return chosen || all[0] || null;
}

export const ttsAvailable = () => !!synth;
export const hasNorwegianVoice = () => norwegianVoices().length > 0;
/** Can we play correct Norwegian audio right now? (Used to decide on listening exercises.) */
export const canSpeakNorwegian = () => hasNorwegianVoice();

/** What's speaking, in words – shown in Settings and the voice warning. */
export function voiceStatus() {
  if (!synth) return { ok: false, quality: 0, label: 'No speech engine in this browser' };
  const v = pickVoice();
  if (!v) return { ok: false, quality: 0, label: 'No Norwegian voice on this device' };
  return { ok: true, quality: voiceQuality(v), label: `${v.name} (${v.lang})` };
}

// ---------- Problems are reported to the UI (main.js shows a toast) ----------
const problemListeners = new Set();
export function onVoiceProblem(fn) { problemListeners.add(fn); return () => problemListeners.delete(fn); }
function problem(kind, message = '') { for (const fn of problemListeners) fn({ kind, message }); }

// ---------- Playback ----------
const audioEl = hasWindow && typeof Audio !== 'undefined' ? new Audio() : null;
let unlocked = false;
// iOS only lets audio play after a tap; "unlock" our single audio element on the first one.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
function unlockAudio() {
  if (!audioEl || unlocked) return;
  unlocked = true;
  audioEl.src = SILENT_WAV;
  audioEl.play().then(() => audioEl.pause()).catch(() => { unlocked = false; });
}
if (hasWindow && typeof document !== 'undefined') document.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });

export function stopSpeaking() {
  synth?.cancel();
  if (audioEl) { audioEl.pause(); audioEl.onended = null; }
}

const clean = (text) => String(text ?? '').replace(/[«»“”]/g, '').replace(/\s*…\s*/g, ' … ').replace(/\s+/g, ' ').trim();

/** Speak Norwegian text. Resolves true when finished, false if nothing could be played. */
export async function speak(text, { rate, pitch = 1 } = {}) {
  const t = clean(text);
  if (!t) return false;
  stopSpeaking();
  // A real recording of this exact sentence beats any synthetic voice.
  const recorded = recordingFor(t);
  if (recorded) {
    try {
      return await playUrl(recorded, rate ?? 1); // natural speed unless slowed on purpose
    } catch { /* missing file – fall back to a voice */ }
  }
  return speakDevice(t, rate ?? settings().ttsRate ?? 0.9, pitch);
}

async function speakDevice(text, rate, pitch) {
  if (!synth) return false;
  if (!voicesCache.length) await voicesReady();
  const v = pickVoice();
  if (!v) {
    problem('no-voice');
    return false;
  }
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (v) u.voice = v;
    u.lang = v?.lang || 'nb-NO';
    u.rate = rate;
    u.pitch = pitch;
    let done = false;
    const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    setTimeout(() => finish(true), 1500 + text.length * 120); // some browsers never fire onend
    synth.speak(u);
  });
}

// ---------- Recordings ----------
const recKey = (text) => normalize(text);
let recordingIndex = null;
function recordingFor(text) {
  recordingIndex ??= new Map(recordingEntries().map(([no, url]) => [recKey(no), url]));
  return recordingIndex.get(recKey(text)) ?? null;
}
export const hasRecording = (text) => !!recordingFor(clean(text));

function playUrl(url, rate) {
  return new Promise((resolve, reject) => {
    if (!audioEl) return reject(new Error('Audio playback is not available.'));
    audioEl.src = url;
    audioEl.preservesPitch = true;
    audioEl.playbackRate = Math.max(0.5, Math.min(1.5, rate));
    audioEl.onended = () => resolve(true);
    audioEl.onerror = () => reject(new Error('Recording could not be loaded.'));
    audioEl.play().catch((e) => {
      if (e?.name === 'NotAllowedError') resolve(false); else reject(e);
    });
  });
}

// ---------- Speech recognition ----------
// The browser's own recognition (Chrome, Edge, Safari). Brave has the API but no
// recognition service behind it, so the microphone is hidden there.

const Rec = hasWindow ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
// (On iPhone/iPad every browser runs Safari's engine, so the Brave limitation doesn't apply there.)
export const isBrave = () => hasWindow && !!navigator.brave && !/iPhone|iPad|iPod/.test(navigator.userAgent);
const nativeListen = () => !!Rec && !isBrave();
export const canListen = () => nativeListen();

/** Why the microphone can't work here (empty string if it can). */
export function listenBlocker() {
  if (canListen()) return '';
  if (isBrave()) return 'Brave can’t recognise speech. Type your answers here – the microphone works on iPhone (Safari) and in Chrome.';
  if (!Rec) return 'This browser can’t recognise speech. Type your answers here – the microphone works on iPhone (Safari) and in Chrome.';
  return 'The microphone isn’t available in this browser.';
}

const REC_ERRORS = {
  'not-allowed': 'Microphone access was blocked. Allow the microphone for this site (click the icon left of the address bar) and try again.',
  'service-not-allowed': 'Speech recognition is turned off. On iPhone: Settings → General → Keyboard → turn on Enable Dictation.',
  'audio-capture': 'No microphone was found. Check that one is connected and allowed.',
  'no-speech': 'I didn’t hear anything. Speak a little louder and closer to the microphone.',
  network: 'Speech recognition needs an internet connection. Check you’re online and try again.',
  'language-not-supported': 'This browser can’t recognise Norwegian. Type your answer instead.',
};
export const recognitionErrorText = (code) => REC_ERRORS[code] || `Speech recognition error: ${code}`;

let stopActive = null;
/** Finish listening now (e.g. a second tap on the microphone). */
export function stopListening() { stopActive?.(); }

/**
 * Listen once in Norwegian. Resolves with alternative transcripts (best first),
 * or [] if nothing was heard. Rejects with an Error that explains the problem.
 * onState('listening' | 'processing') lets the UI show progress.
 */
export function listen({ timeoutMs = 8000, onState = () => {} } = {}) {
  const blocker = listenBlocker();
  if (blocker) return Promise.reject(new Error(blocker));
  stopSpeaking();
  return listenNative(timeoutMs, onState);
}

function listenNative(timeoutMs, onState) {
  return new Promise((resolve, reject) => {
    const r = new Rec();
    r.lang = 'nb-NO';
    r.interimResults = false;
    r.maxAlternatives = 5;
    let settled = false;
    const stop = () => { try { r.stop(); } catch { /* */ } };
    const t = setTimeout(stop, timeoutMs);
    stopActive = stop;
    const done = () => { settled = true; clearTimeout(t); stopActive = null; };
    r.onresult = (e) => {
      done();
      const alts = [];
      for (const res of e.results) for (const alt of res) alts.push(alt.transcript.trim());
      resolve(alts);
    };
    r.onerror = (e) => { if (!settled) { done(); reject(new Error(recognitionErrorText(e.error))); } };
    r.onend = () => { if (!settled) { done(); resolve([]); } };
    onState('listening');
    try { r.start(); } catch (e) { done(); reject(e); }
  });
}

/** Advice for getting a good free Norwegian voice on this particular device/browser. */
export function deviceTip() {
  if (!hasWindow) return '';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone: Settings → Accessibility → Spoken Content → Voices → Norwegian → download “Nora (Enhanced)”. Then reopen the app.';
  if (/Windows/.test(ua) && isBrave()) return 'Brave on Windows can’t use Norwegian voices. Lessons with recordings still play; for everything else, use the app on your iPhone or in Chrome.';
  if (/Windows/.test(ua)) return 'Windows: Settings → Time & language → Speech → Add voices → Norwegian (Bokmål). Then restart the browser.';
  if (/Android/.test(ua)) return 'Android: Settings → search “Text-to-speech” → Google → install voice data → Norsk (bokmål). Then reload.';
  if (/Mac OS X/.test(ua)) return 'Mac: System Settings → Accessibility → Spoken Content → System voice → Manage Voices → Norwegian → “Nora (Enhanced)”. Then restart the browser.';
  return 'Install a Norwegian (bokmål) voice in your system’s text-to-speech settings, then restart the browser.';
}
