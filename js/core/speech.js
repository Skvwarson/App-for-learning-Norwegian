// Norwegian audio.
//
// Three voice sources:
//   device      – the browser's built-in voices (free). We rank Norwegian voices by
//                 quality (Edge "Natural", Apple "Enhanced/Premium", Google …) and
//                 never let an English voice read Norwegian (that's how "Vi sees"
//                 turns into "six sees").
//   elevenlabs  – very natural neural voices (your own API key, model Flash v2.5).
//   google      – Google Cloud Text-to-Speech nb-NO voices (your own API key).
// Cloud audio is generated once per sentence and cached on the device, so you pay
// for each sentence only once and it then plays offline.
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

export const PROVIDERS = {
  device: 'This device (free)',
  elevenlabs: 'ElevenLabs (most natural · API key)',
  google: 'Google Cloud (free monthly quota · API key)',
};

const provider = () => {
  const p = settings().ttsProvider || 'device';
  if (p === 'elevenlabs' && settings().elevenKey) return p;
  if (p === 'google' && settings().googleKey) return p;
  return 'device';
};

export const ttsAvailable = () => !!synth || provider() !== 'device';
export const hasNorwegianVoice = () => norwegianVoices().length > 0;
/** Can we play correct Norwegian audio right now? (Used to decide on listening exercises.) */
export const canSpeakNorwegian = () => provider() !== 'device' || hasNorwegianVoice();

/** What's speaking, in words – shown in Settings and the voice warning. */
export function voiceStatus() {
  const p = provider();
  if (p === 'elevenlabs') return { ok: true, quality: 3, label: 'ElevenLabs (Flash v2.5)' };
  if (p === 'google') return { ok: true, quality: 3, label: `Google Cloud (${settings().googleVoice || DEFAULT_GOOGLE_VOICE})` };
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
let currentUrl = null;
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
  const p = provider();
  const r = rate ?? settings().ttsRate ?? 0.9;
  if (p !== 'device') {
    try {
      return await playBlob(await cloudAudio(p, t), r);
    } catch (e) {
      problem('cloud', e.message);
      // fall through to the device voice, if it has a Norwegian one
    }
  }
  return speakDevice(t, r, pitch);
}

async function speakDevice(text, rate, pitch) {
  if (!synth) return false;
  if (!voicesCache.length) await voicesReady();
  const v = pickVoice();
  if (!v && !settings().allowForeignVoice) {
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

function playBlob(blob, rate) {
  return new Promise((resolve, reject) => {
    if (!audioEl) return reject(new Error('Audio playback is not available.'));
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(blob);
    audioEl.src = currentUrl;
    audioEl.preservesPitch = true;
    audioEl.playbackRate = Math.max(0.5, Math.min(1.5, rate));
    audioEl.onended = () => resolve(true);
    audioEl.onerror = () => reject(new Error('The audio could not be played.'));
    audioEl.play().catch((e) => {
      // Autoplay blocked (no tap yet) is not an error worth reporting – just stay quiet.
      if (e?.name === 'NotAllowedError') resolve(false); else reject(e);
    });
  });
}

// ---------- Cloud voices ----------
export const DEFAULT_ELEVEN_VOICE = '21m00Tcm4TlvDq8ikWAM'; // a premade multilingual voice; pick your own in Settings
export const DEFAULT_GOOGLE_VOICE = 'nb-NO-Wavenet-A';
export const ELEVEN_MODEL = 'eleven_flash_v2_5'; // supports Norwegian (Multilingual v2 does not)
const CACHE_NAME = 'norsk-na-tts-v1';
const memory = new Map();

function fnv(s) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return (x >>> 0).toString(36);
}

export function cacheKey(p, voice, text) {
  return `${p}/${encodeURIComponent(voice)}/${fnv(text)}-${text.length}`;
}

async function cloudAudio(p, text) {
  const voice = p === 'elevenlabs' ? settings().elevenVoice || DEFAULT_ELEVEN_VOICE : settings().googleVoice || DEFAULT_GOOGLE_VOICE;
  const key = cacheKey(p, voice, text);
  if (memory.has(key)) return memory.get(key);
  const url = new URL(`./__tts__/${key}`, location.href).href;
  try {
    const hit = await (await caches.open(CACHE_NAME)).match(url);
    if (hit) { const b = await hit.blob(); memory.set(key, b); return b; }
  } catch { /* Cache API unavailable – memory cache only */ }
  const blob = p === 'elevenlabs' ? await elevenLabsTts(text, voice) : await googleTts(text, voice);
  memory.set(key, blob);
  try { await (await caches.open(CACHE_NAME)).put(url, new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/mpeg' } })); } catch { /* ignore */ }
  return blob;
}

export async function clearAudioCache() {
  memory.clear();
  try { await caches.delete(CACHE_NAME); } catch { /* ignore */ }
}

async function httpError(service, res) {
  let detail = '';
  try {
    const j = await res.clone().json();
    detail = j?.detail?.message || j?.detail?.status || (typeof j?.detail === 'string' ? j.detail : '') || j?.error?.message || '';
  } catch {
    try { detail = (await res.text()).slice(0, 200); } catch { /* */ }
  }
  if (res.status === 401 || res.status === 403) return `${service} rejected the API key${detail ? `: ${detail}` : '.'} Check it in Settings → Voice.`;
  if (res.status === 402 || res.status === 429) return `${service}: quota or rate limit reached${detail ? ` (${detail})` : ''}.`;
  return `${service} error ${res.status}${detail ? `: ${detail}` : ''}`;
}

async function request(service, url, init) {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(`Couldn’t reach ${service}. Check your internet connection (and, for Google, that the key allows this website).`);
  }
}

async function elevenLabsTts(text, voice) {
  const key = settings().elevenKey;
  const call = (withLanguage) => request('ElevenLabs', `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: ELEVEN_MODEL, ...(withLanguage ? { language_code: 'no' } : {}) }),
  });
  let res = await call(true);
  if (res.status === 400 || res.status === 422) {
    const msg = await res.clone().text().catch(() => '');
    if (/language/i.test(msg)) res = await call(false); // older accounts/models without language_code
  }
  if (!res.ok) throw new Error(await httpError('ElevenLabs', res));
  return res.blob();
}

async function googleTts(text, voice) {
  const key = settings().googleKey;
  const res = await request('Google Cloud', `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: { text }, voice: { languageCode: 'nb-NO', name: voice }, audioConfig: { audioEncoding: 'MP3' } }),
  });
  if (!res.ok) throw new Error(await httpError('Google Cloud', res));
  const { audioContent } = await res.json();
  const bin = atob(audioContent);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'audio/mpeg' });
}

/** Voices available for the configured key (for the Settings dropdown). */
export async function listCloudVoices(p, key) {
  if (p === 'elevenlabs') {
    const res = await request('ElevenLabs', 'https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
    if (!res.ok) throw new Error(await httpError('ElevenLabs', res));
    const { voices = [] } = await res.json();
    const norwegianFirst = (v) => (/norw|norsk|^no$|^nb$/i.test(`${v.labels?.language ?? ''} ${v.labels?.accent ?? ''} ${v.name}`) ? 0 : 1);
    return voices.sort((a, b) => norwegianFirst(a) - norwegianFirst(b) || a.name.localeCompare(b.name))
      .map((v) => ({ id: v.voice_id, label: `${v.name}${v.labels?.accent ? ` · ${v.labels.accent}` : ''}${v.category ? ` (${v.category})` : ''}` }));
  }
  const res = await request('Google Cloud', `https://texttospeech.googleapis.com/v1/voices?languageCode=nb-NO&key=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(await httpError('Google Cloud', res));
  const { voices = [] } = await res.json();
  const rank = (n) => (/chirp|neural|studio/i.test(n) ? 0 : /wavenet/i.test(n) ? 1 : 2);
  return voices.filter((v) => v.languageCodes?.includes('nb-NO'))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
    .map((v) => ({ id: v.name, label: `${v.name} · ${String(v.ssmlGender || '').toLowerCase()}` }));
}

// ---------- Speech recognition ----------
// Two engines: the browser's own (Chrome, Edge, Safari – free), or ElevenLabs
// speech-to-text (Scribe) with the same key as the voice – this is what makes the
// microphone work in Brave, which has the API but no recognition service.

const Rec = hasWindow ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
// (On iPhone/iPad every browser runs Safari's engine, so the Brave limitation doesn't apply there.)
export const isBrave = () => hasWindow && !!navigator.brave && !/iPhone|iPad|iPod/.test(navigator.userAgent);
const nativeListen = () => !!Rec && !isBrave();
const cloudListen = () => !!settings().elevenKey && hasWindow && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
export const canListen = () => nativeListen() || cloudListen();
export const STT_MODEL = 'scribe_v2';

/** Why the microphone can't work here (empty string if it can). */
export function listenBlocker() {
  if (canListen()) return '';
  if (isBrave()) return 'Brave has no built-in speech recognition. To use the microphone in Brave, add a free ElevenLabs API key in Settings → Voice – the same key also gives you a natural Norwegian voice.';
  if (!Rec) return 'This browser has no built-in speech recognition. Add an ElevenLabs API key in Settings → Voice to use the microphone here.';
  return 'The microphone isn’t available in this browser.';
}

const REC_ERRORS = {
  'not-allowed': 'Microphone access was blocked. Allow the microphone for this site (click the icon left of the address bar) and try again.',
  'service-not-allowed': 'Speech recognition is turned off. On iPhone: Settings → General → Keyboard → turn on Enable Dictation.',
  'audio-capture': 'No microphone was found. Check that one is connected and allowed.',
  'no-speech': 'I didn’t hear anything. Speak a little louder and closer to the microphone.',
  network: 'Speech recognition needs an internet connection. Check you’re online and try again.',
  'language-not-supported': 'This browser can’t recognise Norwegian. Add an ElevenLabs key in Settings → Voice to use its recognition instead.',
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
  return nativeListen() ? listenNative(timeoutMs, onState) : listenCloud(timeoutMs, onState);
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

/** Record until you pause (or timeoutMs), then transcribe with ElevenLabs. */
async function listenCloud(timeoutMs, onState) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    throw new Error(recognitionErrorText(e?.name === 'NotFoundError' ? 'audio-capture' : 'not-allowed'));
  }
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };

  // Simple voice-activity detection: stop ~1.2 s after you stop talking.
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = AC ? new AC() : null;
  const analyser = ctx?.createAnalyser();
  if (ctx) { analyser.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(analyser); ctx.resume?.(); }
  const buf = new Float32Array(1024);
  const started = Date.now();
  let spoke = !ctx, lastLoud = started, timer = null;

  const audio = await new Promise((resolve) => {
    const finish = () => {
      clearInterval(timer);
      stopActive = null;
      if (recorder.state !== 'inactive') recorder.stop();
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      ctx?.close?.();
      resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
    };
    stopActive = () => { spoke = spoke || Date.now() - started > 600; finish(); };
    timer = setInterval(() => {
      const now = Date.now();
      if (analyser) {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        if (Math.sqrt(sum / buf.length) > 0.02) { spoke = true; lastLoud = now; }
      }
      if ((spoke && now - lastLoud > 1200) || now - started > timeoutMs || (!spoke && now - started > 5000)) finish();
    }, 100);
    recorder.start(250);
    onState('listening');
  });

  if (!spoke || !audio.size) return []; // nothing said – don't spend credits
  onState('processing');
  const form = new FormData();
  form.append('model_id', STT_MODEL);
  form.append('language_code', 'no');
  form.append('file', audio, `answer.${/ogg/.test(audio.type) ? 'ogg' : /mp4/.test(audio.type) ? 'm4a' : 'webm'}`);
  const res = await request('ElevenLabs', 'https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': settings().elevenKey },
    body: form,
  });
  if (!res.ok) throw new Error(await httpError('ElevenLabs', res));
  const { text = '' } = await res.json();
  const clean = text.replace(/\([^)]*\)/g, '').trim(); // drop audio-event tags like (laughter)
  return clean ? [clean] : [];
}
