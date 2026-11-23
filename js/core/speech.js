// Norwegian audio.
//
// 1. A real recording of the exact sentence: dialogue lines (data/recordings.js) or
//    voice-overs of words, examples, stories and role-plays (data/voiceovers.js).
// 2. Otherwise the device's built-in voice. Norwegian voices are ranked by quality
//    (Edge "Natural", Apple "Enhanced/Premium", Google …) and an English voice is
//    never allowed to read Norwegian (that's how "Vi sees" turns into "six sees").

import { settings } from './store.js';
import { normalize } from './text.js';
import { loadBuffer, playBuffer, stopBuffer, applyMasterVolume } from './audio.js';
import { recordingEntries } from '../../data/recordings.js';
import { VOICEOVERS } from '../../data/voiceovers.js';

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

/** Chrome loads voices asynchronously, wait briefly before concluding there are none. */
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

/** What's speaking, in words, shown in Settings and the voice warning. */
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
// Recordings play as decoded buffers through the shared audio engine (js/core/audio.js).
// A plain <audio> element is only used for slowed-down playback, which keeps the pitch.
const audioEl = hasWindow && typeof Audio !== 'undefined' ? new Audio() : null;
/** The app's own volume (Settings), 0-1. */
export const appVolume = () => Math.max(0, Math.min(1, Number(settings().volume ?? 1)));
/** Apply the volume setting right away (also to a recording that's playing). */
export function applyVolume() { applyMasterVolume(); if (audioEl) audioEl.volume = appVolume(); }

let playId = 0; // every new speak() makes older, still-loading ones give up
export function stopSpeaking() {
  playId++;
  synth?.cancel();
  stopBuffer();
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
    const id = playId;
    const r = rate ?? 1; // natural speed unless slowed on purpose
    if (Math.abs(r - 1) < 0.01) {
      const buf = await loadBuffer(recorded);
      if (id !== playId) return false;          // something else started meanwhile
      if (buf) return playBuffer(buf);
    } else {
      try { return await playUrl(recorded, r); } catch { /* fall back to a voice */ }
    }
    if (id !== playId) return false;
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
    u.volume = appVolume();
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
  // Voice-overs (Teacher, stories, role-plays) first; dialogue recordings win for their own lines.
  recordingIndex ??= new Map([...VOICEOVERS, ...recordingEntries()].map(([no, url]) => [recKey(no), url]));
  return recordingIndex.get(recKey(text)) ?? null;
}
export const hasRecording = (text) => !!recordingFor(clean(text));

/** Start loading the recording of this text now, so it plays without delay later. */
export function preload(text) {
  const url = recordingFor(clean(text));
  return url ? loadBuffer(url) : Promise.resolve(null);
}

/** Load all these recordings; onProgress(done, total). Resolves when every one is ready (or failed). */
export async function preloadAll(texts, onProgress = () => {}) {
  const urls = [...new Set(texts.map((t) => recordingFor(clean(t))).filter(Boolean))];
  let done = 0;
  onProgress(0, urls.length);
  await Promise.all(urls.map((u) => loadBuffer(u).then(() => onProgress(++done, urls.length))));
  return urls.length;
}

/** Play an audio file from the app (e.g. a unit's spoken title). Resolves false if it can't play. */
export async function playFile(url, rate = 1) {
  stopSpeaking();
  const id = playId;
  const buf = await loadBuffer(url);
  if (id !== playId) return false;
  return buf ? playBuffer(buf, rate) : false;
}

function playUrl(url, rate) {
  applyVolume();
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

// Brave on Windows can't use the system's Norwegian voices (used by deviceTip).
const isBrave = () => hasWindow && !!navigator.brave && !/iPhone|iPad|iPod/.test(navigator.userAgent);

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
