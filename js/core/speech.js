// Text-to-speech and speech recognition via the browser's Web Speech API.
// Norwegian voices exist on most platforms (iOS/macOS "Nora", Android/Chrome
// "Norsk bokmål", Windows "Jon"/"Hulda" when the language pack is installed).

import { settings } from './store.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
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

const isNo = (v) => /^(nb|no|nn)(-|_|$)/i.test(v.lang) || /norw|norsk|bokmål/i.test(v.name);

export function norwegianVoices() {
  return (voicesCache.length ? voicesCache : loadVoices()).filter(isNo);
}

export function pickVoice() {
  const all = norwegianVoices();
  const chosen = settings().voiceURI && all.find((v) => v.voiceURI === settings().voiceURI);
  return chosen || all.find((v) => /^nb/i.test(v.lang)) || all[0] || null;
}

export const ttsAvailable = () => !!synth;
export const hasNorwegianVoice = () => norwegianVoices().length > 0;

/** Speak Norwegian text. Resolves when finished (or immediately if TTS is unavailable). */
export function speak(text, { rate, pitch = 1 } = {}) {
  return new Promise((resolve) => {
    if (!synth || !text) return resolve(false);
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[«»]/g, ''));
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang || 'nb-NO';
    u.rate = rate ?? settings().ttsRate ?? 0.9;
    u.pitch = pitch;
    let done = false;
    const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    // Safety net: some browsers never fire onend.
    setTimeout(() => finish(true), 1500 + String(text).length * 120);
    synth.speak(u);
  });
}

export function stopSpeaking() { synth?.cancel(); }

// ---------- Speech recognition ----------
const Rec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const canListen = () => !!Rec;

/**
 * Listen once in Norwegian. Resolves with an array of alternative transcripts
 * (best first). Rejects with an Error if recognition is unavailable/denied.
 */
export function listen({ timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!Rec) return reject(new Error('Speech recognition is not supported in this browser (try Chrome, Edge or Safari).'));
    const r = new Rec();
    r.lang = 'nb-NO';
    r.interimResults = false;
    r.maxAlternatives = 5;
    let settled = false;
    const t = setTimeout(() => { try { r.stop(); } catch { /* */ } }, timeoutMs);
    r.onresult = (e) => {
      settled = true; clearTimeout(t);
      const alts = [];
      for (const res of e.results) for (const alt of res) alts.push(alt.transcript.trim());
      resolve(alts);
    };
    r.onerror = (e) => { if (!settled) { settled = true; clearTimeout(t); reject(new Error(e.error === 'not-allowed' ? 'Microphone permission was denied.' : `Speech recognition error: ${e.error}`)); } };
    r.onend = () => { if (!settled) { settled = true; clearTimeout(t); resolve([]); } };
    try { r.start(); } catch (e) { reject(e); }
  });
}
