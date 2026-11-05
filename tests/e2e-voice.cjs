// Browser test for Norwegian audio: never use a foreign voice, prefer natural
// voices, and call ElevenLabs / Google Cloud correctly (both mocked) with caching.
// Usage: start a static server on :8123, then  node tests/e2e-voice.cjs [screenshot-dir]
const { chromium } = require('playwright');
const assert = require('assert');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123/';
const SHOTS = process.argv[2];

// 0.1 s of silence as a WAV file – a stand-in for the MP3 the real services return.
function silentWav() {
  const n = 800, buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(8000, 24);
  buf.writeUInt32LE(8000, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34); buf.write('data', 36); buf.writeUInt32LE(n, 40);
  buf.fill(128, 44);
  return buf;
}

// Replace the browser's speech engine with a recorder and a configurable voice list.
const fakeSpeech = (voices) => `
  window.__spoken = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  speechSynthesis.getVoices = () => ${JSON.stringify(voices)};
  speechSynthesis.speak = (u) => { window.__spoken.push({ text: u.text, voice: u.voice && u.voice.name, lang: u.lang }); setTimeout(() => u.onend && u.onend(), 5); };
  speechSynthesis.cancel = () => {};
`;

async function freshPage(browser, voices) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(fakeSpeech(voices));
  await ctx.addInitScript(() => localStorage.setItem('norsk-na.v1', JSON.stringify({ game: { onboarded: true } })));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector('.hero');
  return { page, errors, ctx };
}

const speak = (page, text) => page.evaluate(async (t) => (await import('/js/core/speech.js')).speak(t), text);
const setSettings = (page, patch) => page.evaluate(async (p) => (await import('/js/core/store.js')).update((s) => Object.assign(s.settings, p)), patch);

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });

  // 1. Only an English voice: Norwegian must NOT be read by it, and the user is told why.
  {
    const { page, errors, ctx } = await freshPage(browser, [{ name: 'Microsoft David', lang: 'en-US', voiceURI: 'david' }]);
    const ok = await speak(page, 'Vi sees!');
    assert.equal(ok, false);
    assert.deepEqual(await page.evaluate(() => window.__spoken), []);
    await page.waitForSelector('text=No Norwegian voice on this device.');
    await page.waitForSelector('text=Set up a Norwegian voice');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/v1-no-voice.png` });
    assert.deepEqual(errors, []);
    console.log('✓ foreign voice blocked, warning shown');
    await ctx.close();
  }

  // 1b. Recorded dialogue lines play from audio/ even when the device has no Norwegian voice.
  {
    const { page, errors, ctx } = await freshPage(browser, [{ name: 'Microsoft David', lang: 'en-US', voiceURI: 'david' }]);
    const requested = [];
    page.on('request', (r) => { if (r.url().includes('/audio/')) requested.push(new URL(r.url()).pathname); });
    const ok = await speak(page, 'Hei! Jeg heter Lars. Hva heter du?');
    assert.equal(ok, true);
    assert.deepEqual(requested, ['/audio/u01/01.mp3']);
    assert.deepEqual(await page.evaluate(() => window.__spoken), []);
    assert.equal(await page.evaluate(async () => (await import('/js/core/speech.js')).hasRecording('«Ha det!»')), true);
    assert.deepEqual(errors, []);
    console.log('✓ recorded dialogue line played from audio/u01');
    await ctx.close();
  }

  // 2. Several Norwegian voices: the natural one wins.
  {
    const { page, errors, ctx } = await freshPage(browser, [
      { name: 'Microsoft Jon - Norwegian (Bokmål)', lang: 'nb-NO', voiceURI: 'jon' },
      { name: 'Microsoft Pernille Online (Natural) - Norwegian (Bokmål) (Norway)', lang: 'nb-NO', voiceURI: 'pernille' },
      { name: 'Microsoft David', lang: 'en-US', voiceURI: 'david' },
    ]);
    assert.equal(await speak(page, 'Vi sees!'), true);
    const spoken = await page.evaluate(() => window.__spoken);
    assert.equal(spoken[0].voice, 'Microsoft Pernille Online (Natural) - Norwegian (Bokmål) (Norway)');
    assert.equal(spoken[0].lang, 'nb-NO');
    assert.equal(await page.$('text=Set up a Norwegian voice'), null);
    assert.deepEqual(errors, []);
    console.log('✓ natural Norwegian voice preferred');
    await ctx.close();
  }

  // 3. ElevenLabs: correct request, audio plays, second time comes from the cache.
  {
    const { page, errors, ctx } = await freshPage(browser, []);
    const calls = [];
    await page.route('https://api.elevenlabs.io/**', async (route) => {
      const req = route.request();
      calls.push({ url: req.url(), key: req.headers()['xi-api-key'], body: req.postDataJSON() });
      await route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() });
    });
    await setSettings(page, { ttsProvider: 'elevenlabs', elevenKey: 'test-key', elevenVoice: 'voice123' });
    assert.equal(await speak(page, 'Hyggelig å treffe deg!'), true);
    assert.equal(await speak(page, 'Hyggelig å treffe deg!'), true);
    assert.equal(calls.length, 1, 'second play should be cached');
    assert.match(calls[0].url, /\/v1\/text-to-speech\/voice123\?output_format=mp3_44100_128$/);
    assert.equal(calls[0].key, 'test-key');
    assert.deepEqual(calls[0].body, { text: 'Hyggelig å treffe deg!', model_id: 'eleven_flash_v2_5', language_code: 'no' });
    assert.deepEqual(await page.evaluate(() => window.__spoken), []);
    assert.deepEqual(errors, []);
    console.log('✓ ElevenLabs request + cache');

    // A rejected key is reported clearly.
    await page.unroute('https://api.elevenlabs.io/**');
    await page.route('https://api.elevenlabs.io/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: { message: 'Invalid API key' } }) }));
    await speak(page, 'Noe nytt.');
    await page.waitForSelector('text=ElevenLabs rejected the API key');
    console.log('✓ ElevenLabs error reported');
    await ctx.close();
  }

  // 4. Google Cloud: correct request and base64 audio decoding.
  {
    const { page, errors, ctx } = await freshPage(browser, []);
    const calls = [];
    await page.route('https://texttospeech.googleapis.com/**', async (route) => {
      calls.push({ url: route.request().url(), body: route.request().postDataJSON() });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ audioContent: silentWav().toString('base64') }) });
    });
    await setSettings(page, { ttsProvider: 'google', googleKey: 'g-key', googleVoice: 'nb-NO-Wavenet-B' });
    assert.equal(await speak(page, 'Vi sees i morgen.'), true);
    assert.match(calls[0].url, /\/v1\/text:synthesize\?key=g-key$/);
    assert.deepEqual(calls[0].body, { input: { text: 'Vi sees i morgen.' }, voice: { languageCode: 'nb-NO', name: 'nb-NO-Wavenet-B' }, audioConfig: { audioEncoding: 'MP3' } });
    assert.deepEqual(errors, []);
    console.log('✓ Google Cloud request');

    await page.goto(BASE + '#/settings');
    await page.waitForSelector('.voice-status');
    if (SHOTS) {
      await page.locator('.voice-status').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/v2-settings-google.png` });
      await page.click('text=This device (free)');
      await page.screenshot({ path: `${SHOTS}/v3-settings-device.png` });
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // 5. Brave on Windows: the microphone explains itself and the voice tip points to Edge.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' });
    await ctx.addInitScript(fakeSpeech([{ name: 'Microsoft David', lang: 'en-US', voiceURI: 'david' }]));
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'brave', { value: { isBrave: () => Promise.resolve(true) } });
      window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => this.onerror && this.onerror({ error: 'network' }), 10); } stop() {} };
      localStorage.setItem('norsk-na.v1', JSON.stringify({ game: { onboarded: true } }));
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE);
    await page.waitForSelector('text=/Brave can’t use Windows’ newer voice packs/');
    await page.evaluate(async () => {
      const { answerInput } = await import('/js/ui/components.js');
      document.querySelector('#view').append(answerInput({ expected: 'Jeg heter Alex', onSubmit: () => {} }).el);
    });
    await page.click('#view .mic');
    await page.waitForSelector('.heard >> text=/Brave has no built-in speech recognition/');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/v4-brave.png`, fullPage: true });
    assert.deepEqual(errors, []);
    console.log('✓ Brave: microphone and voice explained');
    await ctx.close();
  }

  // 6. Working recognition: shows what was heard and the % match, then checks the answer.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(fakeSpeech([{ name: 'Nora', lang: 'nb-NO', voiceURI: 'nora' }]));
    await ctx.addInitScript(() => {
      window.SpeechRecognition = window.webkitSpeechRecognition = class { start() { setTimeout(() => this.onresult({ results: [[{ transcript: 'jeg heter Alex' }]] }), 300); } stop() {} };
      localStorage.setItem('norsk-na.v1', JSON.stringify({ game: { onboarded: true } }));
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE);
    await page.waitForSelector('.hero');
    await page.evaluate(async () => {
      const { answerInput } = await import('/js/ui/components.js');
      window.__submitted = null;
      document.querySelector('#view').prepend(answerInput({ expected: 'Jeg heter Alex.', onSubmit: (v) => { window.__submitted = v; } }).el);
    });
    await page.click('#view .mic');
    await page.waitForSelector('.heard >> text=Listening… speak now');
    await page.waitForSelector('.heard >> text=100% match');
    assert.equal(await page.evaluate(() => window.__submitted), 'jeg heter Alex');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/v5-heard.png` });
    assert.deepEqual(errors, []);
    console.log('✓ microphone shows what it heard + % match');
    await ctx.close();
  }

  // 7. Brave + ElevenLabs key: the microphone records and ElevenLabs transcribes it.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' });
    await ctx.grantPermissions(['microphone']);
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'brave', { value: { isBrave: () => Promise.resolve(true) } });
      localStorage.setItem('norsk-na.v1', JSON.stringify({ game: { onboarded: true }, settings: { elevenKey: 'el-key', ttsProvider: 'elevenlabs' } }));
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const stt = [];
    await page.route('https://api.elevenlabs.io/v1/speech-to-text', async (route) => {
      const req = route.request();
      stt.push({ key: req.headers()['xi-api-key'], body: req.postDataBuffer().toString('latin1') });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Jeg heter Alex.', language_code: 'nor' }) });
    });
    await page.goto(BASE);
    await page.waitForSelector('.hero');
    await page.evaluate(async () => {
      const { answerInput } = await import('/js/ui/components.js');
      document.querySelector('#view').prepend(answerInput({ expected: 'Jeg heter Alex', onSubmit: (v) => { window.__submitted = v; } }).el);
    });
    await page.click('#view .mic');
    await page.waitForSelector('.heard >> text=Listening… speak now');
    await page.waitForTimeout(1500);
    await page.click('#view .mic'); // tap again = done talking
    await page.waitForSelector('.heard >> text=100% match', { timeout: 15000 });
    assert.equal(stt.length, 1);
    assert.equal(stt[0].key, 'el-key');
    assert.match(stt[0].body, /name="model_id"\r\n\r\nscribe_v2/);
    assert.match(stt[0].body, /name="language_code"\r\n\r\nno/);
    assert.match(stt[0].body, /name="file"; filename="answer\.(webm|ogg|m4a)"/);
    assert.equal(await page.evaluate(() => window.__submitted), 'Jeg heter Alex.');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/v6-brave-eleven-mic.png` });
    assert.deepEqual(errors, []);
    console.log('✓ Brave + ElevenLabs: microphone transcribed via Scribe v2');
    await ctx.close();
  }

  await browser.close();
  console.log('All voice tests passed');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
