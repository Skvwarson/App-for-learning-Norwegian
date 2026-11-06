// Browser test for the AI conversation: write mode (text + spoken reply) and
// hands-free voice mode (mic → ElevenLabs speech-to-text → Claude → ElevenLabs voice).
// Claude and ElevenLabs are mocked. Usage: server on :8123, then node tests/e2e-chat.cjs [shots]
const { chromium } = require('playwright');
const assert = require('assert');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123/';
const SHOTS = process.argv[2];

function silentWav() {
  const n = 800, buf = Buffer.alloc(44 + n);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(8000, 24);
  buf.writeUInt32LE(8000, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34); buf.write('data', 36); buf.writeUInt32LE(n, 40);
  buf.fill(128, 44);
  return buf;
}

const replies = [
  { reply: 'Hei! Jeg heter Ingrid. Hva heter du?', translation: 'Hi! I’m Ingrid. What’s your name?', correction: { needed: false, corrected: '', explanation: '' }, suggestions: ['Jeg heter Alex.'], new_words: [] },
  { reply: 'Hyggelig å treffe deg, Alex! Hvor kommer du fra?', translation: 'Nice to meet you, Alex! Where are you from?', correction: { needed: true, corrected: 'Jeg heter Alex.', explanation: 'Use “heter” for names.' }, suggestions: [], new_words: [] },
  { reply: 'Å, så spennende!', translation: 'Oh, how exciting!', correction: { needed: false, corrected: '', explanation: '' }, suggestions: [], new_words: [] },
];

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(['microphone']);
  await ctx.addInitScript(() => {
    // Behave like Brave: no built-in recognition, so the mic goes through ElevenLabs.
    Object.defineProperty(navigator, 'brave', { value: { isBrave: () => Promise.resolve(true) } });
    if (!localStorage.getItem('norsk-na.v1')) {
      localStorage.setItem('norsk-na.v1', JSON.stringify({ game: { onboarded: true }, settings: { aiKey: 'sk-ant-test', ttsProvider: 'elevenlabs', elevenKey: 'el-key' } }));
    }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const claude = [], tts = [], stt = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    const body = route.request().postDataJSON();
    claude.push(body);
    const out = replies[Math.min(claude.length - 1, replies.length - 1)];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: `msg_${claude.length}`, type: 'message', role: 'assistant', model: body.model,
      content: [{ type: 'text', text: JSON.stringify(out) }], stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    }) });
  });
  await page.route('https://api.elevenlabs.io/v1/text-to-speech/**', async (route) => {
    tts.push(route.request().postDataJSON().text);
    await route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() });
  });
  await page.route('https://api.elevenlabs.io/v1/speech-to-text', async (route) => {
    stt.push(1);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Jeg kommer fra Polen.' }) });
  });

  // ---- Write mode: type, get text + voice back
  await page.goto(BASE + '#/chat');
  await page.click('text=Getting to know someone');
  await page.waitForSelector('.bubble.them >> text=Hva heter du?');
  await page.waitForFunction(() => true);
  await page.waitForTimeout(400);
  assert.ok(tts.includes(replies[0].reply), 'opening line is spoken with ElevenLabs');
  await page.fill('.answer', 'Jeg er Alex');
  await page.click('.answer-row .btn.primary');
  await page.waitForSelector('.bubble.them >> text=Hvor kommer du fra?');
  await page.waitForSelector('.bubble-fix >> text=Jeg heter Alex.');
  await page.waitForTimeout(400);
  assert.ok(tts.includes(replies[1].reply), 'reply is spoken');
  assert.equal(claude[1].messages.at(-1).content, 'Jeg er Alex');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/c1-write-mode.png` });
  console.log('✓ write mode: reply comes back as text + ElevenLabs voice, with correction');

  // ---- Voice mode: hands-free turn
  await page.click('.mode-switch >> text=🎙 Voice');
  await page.waitForSelector('.voice-orb[data-state="listening"]', { timeout: 5000 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/c2-voice-listening.png` });
  await page.waitForTimeout(1200);
  await page.click('.voice-orb'); // done talking
  await page.waitForSelector('.bubble.you >> text=Jeg kommer fra Polen.', { timeout: 15000 });
  await page.waitForSelector('.bubble.them >> text=Å, så spennende!', { timeout: 10000 });
  assert.equal(stt.length, 1);
  assert.equal(claude[2].messages.at(-1).content, 'Jeg kommer fra Polen.');
  // After the spoken reply it listens again by itself.
  await page.waitForSelector('.voice-orb[data-state="listening"]', { timeout: 8000 });
  assert.ok(tts.includes(replies[2].reply));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/c3-voice-turn.png` });
  console.log('✓ voice mode: speech → text → Claude → spoken reply → listening again');

  await page.click('text=End');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('All chat tests passed');
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
