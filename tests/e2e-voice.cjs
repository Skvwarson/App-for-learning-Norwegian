// Browser test for Norwegian audio: recordings first, never a foreign voice,
// natural voices preferred.
// Usage: start a static server on :8123, then  node tests/e2e-voice.cjs [screenshot-dir]
const { chromium } = require('playwright');
const assert = require('assert');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123/';
const SHOTS = process.argv[2];

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
  await ctx.addInitScript(() => localStorage.setItem('norsk-na.v1', JSON.stringify({ game: { onboarded: true, toured: true } })));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector('.today-card');
  return { page, errors, ctx };
}

const speak = (page, text) => page.evaluate(async (t) => (await import('/js/core/speech.js')).speak(t), text);

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

  // 1. Only an English voice: Norwegian must NOT be read by it, and the user is told why.
  {
    const { page, errors, ctx } = await freshPage(browser, [{ name: 'Microsoft David', lang: 'en-US', voiceURI: 'david' }]);
    const ok = await speak(page, 'Vi sees!');
    assert.equal(ok, false);
    assert.deepEqual(await page.evaluate(() => window.__spoken), []);
    await page.waitForSelector('text=No Norwegian voice on this device.');
    await page.waitForSelector('.voice-card');
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
    assert.equal(await page.$('.voice-card'), null);
    assert.deepEqual(errors, []);
    console.log('✓ natural Norwegian voice preferred');
    await ctx.close();
  }

  // 3. Brave on Windows: the missing voice explains itself.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' });
    await ctx.addInitScript(fakeSpeech([{ name: 'Microsoft David', lang: 'en-US', voiceURI: 'david' }]));
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'brave', { value: { isBrave: () => Promise.resolve(true) } });
      localStorage.setItem('norsk-na.v1', JSON.stringify({ game: { onboarded: true, toured: true } }));
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE);
    await page.waitForSelector('text=/Brave on Windows can’t use Norwegian voices/');
    assert.equal(await page.$('.mic'), null);
    assert.deepEqual(errors, []);
    console.log('✓ Brave: missing voice explained, no microphone');
    await ctx.close();
  }

  await browser.close();
  console.log('All voice tests passed');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
