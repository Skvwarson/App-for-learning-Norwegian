// Role-play: three wrong tries show the answer and move on; missed lines come back
// 15 minutes later, and the role-play only counts once they're typed correctly.
// Usage: start a static server on :8123, then  node tests/e2e-roleplay.cjs
const { chromium } = require('playwright');
const assert = require('assert');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123/';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.speechSynthesis.speak = (u) => setTimeout(() => u.onend && u.onend(), 5);
    HTMLMediaElement.prototype.play = function () { setTimeout(() => this.onended && this.onended(), 5); return Promise.resolve(); };
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('norsk-na.v1', JSON.stringify({ game: { onboarded: true, toured: true }, settings: { name: 'Alex' } }));
    }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const U = await (async () => { await page.goto(BASE); return page.evaluate(async () => (await import('/data/units.js')).UNITS[0]); })();
  const yours = U.roleplay.lines.filter((l) => l.who === 'you');
  const answer = async (text) => { await page.fill('.answer', text); await page.click('.answer-row .btn.primary'); };

  await page.goto(BASE + '#/roleplay/u01');
  // Line 1: three wrong tries → the answer is shown and the role-play moves on.
  await page.waitForSelector('.cue', { timeout: 10000 });
  await answer('feil'); await page.waitForSelector('text=2 tries left');
  await answer('feil'); await page.waitForSelector('text=1 try left');
  await answer('feil');
  await page.waitForSelector('.bubble.you.missed');
  assert.match(await page.textContent('.bubble.you.missed'), /Hei! Jeg heter Alex\./);
  console.log('✓ three misses show the answer');
  // The rest: answer correctly.
  for (const l of yours.slice(1)) {
    await page.waitForSelector('.cue', { timeout: 10000 });
    await answer(l.model.replace('{name}', 'Alex'));
    await page.waitForTimeout(700);
  }
  await page.waitForSelector('text=1 line to practise again');
  let st = await page.evaluate(async () => (await import('/js/core/store.js')).getState().roleplays.u01);
  assert.deepEqual(st.retry.lines, [U.roleplay.lines.indexOf(yours[0])]);
  assert.equal(st.best, undefined);
  console.log('✓ missed line saved for 15 minutes later, role-play not counted yet');

  // Today keeps "Speak" open and says when.
  await page.goto(BASE + '#/');
  await page.waitForSelector('.today-card');
  // Coming back too early: a waiting screen.
  await page.goto(BASE + '#/roleplay/u01');
  await page.waitForSelector('.rp-wait');
  console.log('✓ waiting screen before the 15 minutes are up');

  // 15 minutes later: only the missed line (with the line before it as context).
  await page.evaluate(async () => {
    const { update, save } = await import('/js/core/store.js');
    update((s) => { s.roleplays.u01.retry.due = Date.now() - 1000; });
    save(true);
  });
  await page.goto(BASE + '#/'); await page.goto(BASE + '#/roleplay/u01');
  await page.waitForSelector('.cue', { timeout: 10000 });
  assert.equal(await page.$$eval('.bubble.them', (b) => b.length), 1);
  await answer(yours[0].model.replace('{name}', 'Alex'));
  await page.waitForSelector('text=All the missed lines are right now!');
  st = await page.evaluate(async () => (await import('/js/core/store.js')).getState().roleplays.u01);
  assert.equal(st.retry, undefined);
  console.log('✓ retry passed: role-play done');

  assert.deepEqual(errors, []);
  await browser.close();
  console.log('All role-play tests passed');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
