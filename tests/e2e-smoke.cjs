// End-to-end smoke test: walks through onboarding, a full lesson, a review
// session, reading and every main page, saving screenshots.
// Usage: start a static server on :8123, then  node tests/e2e-smoke.cjs <screenshot-dir>
const { chromium } = require('playwright');

const SHOTS = process.argv[2] || 'shots';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123/';
const errors = [];
let lastPage = null;
const log = (...a) => console.log('•', ...a);
// Tiles re-render on every tap, so always click the current first one.
async function tapAllTiles(page) {
  for (let k = 0; k < 20 && (await page.$('.tile-pool .tile')); k++) await page.locator('.tile-pool .tile').first().click();
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  lastPage = page;
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = (n, full = false) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: full });
  const units = () => page.evaluate(async () => (await import('/data/units.js')).UNITS);

  await page.goto(BASE);
  await page.waitForSelector('.onboard', { timeout: 5000 });
  await shot('01-onboarding');
  await page.fill('#ob-name', 'Alex');
  await page.click('text=Start my first lesson');
  await page.waitForSelector('text=Start ▸');
  await shot('03-lesson-intro');
  await page.click('text=Start ▸');
  await page.waitForSelector('.dialogue');
  await page.click('.line-sp >> nth=0');
  await shot('04-listen');
  await page.click('text=I’ve listened ▸');
  log('listen ok');

  const U = await units();
  const u1 = U[0];
  const byEn = new Map(u1.words.map((w) => [w.en, w.no]));
  for (let chunk = 0; chunk < 10; chunk++) {
    const ready = await page.$('text=I’m ready – test me ▸');
    if (!ready) break;
    if (chunk === 0) await shot('05-words-study');
    await ready.click();
    for (let q = 0; q < 14; q++) {
      const prompt = await page.waitForSelector('.prompt-big', { timeout: 4000 }).catch(() => null);
      if (!prompt) break;
      const en = (await prompt.textContent()).trim();
      const no = byEn.get(en);
      const btns = await page.$$('.choice');
      let clicked = false;
      for (const b of btns) {
        const t = (await b.$eval('span:last-child', (s) => s.textContent)).trim();
        if (t === no) { await b.click(); clicked = true; break; }
      }
      if (!clicked) { log('no match for', en); await btns[0].click(); }
      if (chunk === 0 && q === 0) await shot('06-words-quiz');
      await page.waitForTimeout(1100);
      if (await page.$('text=I’m ready – test me ▸') || await page.$('text=Next: grammar ▸')) break;
    }
  }
  log('words ok');
  await page.click('text=Next: grammar ▸');
  await page.waitForSelector('.grammar');
  await shot('07-grammar');
  for (const d of u1.grammar.drills) {
    if (d.type === 'fill') {
      await page.fill('.answer', d.a);
      await page.click('.answer-row .btn.primary');
    } else {
      for (const t of d.a.replace(/[.!?]/g, '').split(' ')) {
        const texts = await page.$$eval('.tile-pool .tile', (els) => els.map((e) => e.textContent));
        const idx = texts.indexOf(t);
        if (idx >= 0) await page.locator('.tile-pool .tile').nth(idx).click();
      }
      await page.click('text=Check');
    }
    await page.waitForSelector('text=Continue ▸');
    await page.click('text=Continue ▸');
  }
  log('grammar ok');
  await page.click('text=Next: practice ▸');
  for (let i = 0; i < 24; i++) {
    // Wait until the next exercise (or the end of practice) is on screen.
    await page.locator('.answer:not([disabled]), .tile-pool .tile').or(page.getByText('Next: speak ▸')).first().waitFor({ timeout: 8000 });
    if (await page.$('text=Next: speak ▸')) break;
    if (i === 1) await shot('08-practice');
    const inp = await page.$('.answer:not([disabled])');
    if (inp) { await inp.fill('hei'); await page.click('.answer-row .btn.primary'); }
    else {
      await tapAllTiles(page);
      const chk = await page.$('text=Check');
      if (chk) await chk.click();
    }
    await page.waitForSelector('text=Continue ▸', { timeout: 8000 });
    await page.click('text=Continue ▸');
  }
  log('practice ok');
  await page.click('text=Next: speak ▸');
  const rp = u1.roleplay.lines.filter((l) => l.who === 'you');
  for (const [i, l] of rp.entries()) {
    await page.waitForSelector('.cue', { timeout: 20000 });
    await page.fill('.answer', l.model.replace('{name}', 'Alex'));
    if (i === 1) await shot('09-roleplay');
    await page.click('.answer-row .btn.primary');
    await page.waitForTimeout(900);
  }
  await page.waitForSelector('text=Finish lesson ▸', { timeout: 20000 });
  await shot('10-roleplay-done');
  await page.click('text=Finish lesson ▸');
  await page.waitForSelector('text=Unit 1 complete!');
  // First activity of the day → the streak celebration appears at the end of the lesson.
  await page.waitForSelector('.streak-pop.show', { timeout: 5000 });
  await shot('11a-streak-pop');
  await page.click('.streak-pop button');
  await page.waitForSelector('.streak-pop', { state: 'detached', timeout: 5000 });
  await page.waitForSelector('.next-step', { timeout: 5000 });
  log('streak pop + next step:', (await page.textContent('.next-step')).trim().slice(0, 60));
  await page.waitForTimeout(400);
  await shot('11-unit-done');
  log('lesson complete');
  for (const b of await page.$$('text=Fortsett ▸')) await b.click().catch(() => {});

  await page.goto(BASE + '#/');
  await page.waitForSelector('.today-card');
  await page.waitForTimeout(500);
  await shot('12-home');
  await shot('12b-home-full', true);

  // Make every card due, then run a review session.
  await page.evaluate(() => {
    const k = 'norsk-na.v1'; const s = JSON.parse(localStorage.getItem(k));
    for (const c of Object.values(s.cards)) c.srs.due = Date.now() - 1000;
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.goto(BASE + '#/review'); await page.reload();
  await page.waitForSelector('.card-face');
  await shot('13-review');
  for (let i = 0; i < 25; i++) {
    if (await page.$('.summary') || await page.$('text=All caught up!')) break;
    const showBtn = await page.$('text=Show answer');
    if (showBtn) { await showBtn.click(); if (i < 2) await shot(`14-review-reveal-${i}`); await page.click('.rate.r3'); }
    else if (await page.$('.answer:not([disabled])')) {
      const wrong = i % 3 === 0;
      await page.fill('.answer', wrong ? 'feil' : 'hei');
      await page.click('.answer-row .btn.primary');
      await page.waitForSelector('.rate-bar');
      if (i < 6) await shot(`15-review-answer-${i}`);
      await page.click(wrong ? '.rate.r1' : '.rate.r3');
    } else if (await page.$('.tile-pool .tile')) {
      await tapAllTiles(page);
      await page.click('text=Check'); await page.waitForSelector('.rate-bar'); await page.click('.rate.r3');
    } else if (await page.$('text=Got it ▸')) { await page.click('text=Got it ▸'); }
    else { await page.waitForTimeout(300); }
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(400);
  await shot('16-review-summary');
  log('review ok');

  await page.goto(BASE + '#/read'); await page.waitForSelector('.story-item');
  await shot('17-read');
  await page.goto(BASE + '#/read/story/s01'); await page.waitForSelector('.story');
  await shot('18-story');
  await page.click('.story .w >> nth=4');
  await page.waitForSelector('.sheet');
  await shot('19-word-sheet');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.click('text=Finished reading ✓');
  await page.waitForSelector('.story-done >> text=Ferdig!');
  await page.waitForTimeout(500);
  await shot('19b-story-done');
  log('story done, next:', (await page.textContent('.story-done')).replace(/\s+/g, ' ').slice(0, 90));

  for (const [r, n] of [['#/learn', '20-learn'], ['#/friends', '20b-race'], ['#/me', '20c-me'], ['#/progress', '21-progress'], ['#/speak', '22-speak'], ['#/practice/time', '24-time'], ['#/words', '25-words'], ['#/settings', '27-settings']]) {
    await page.goto(BASE + r); await page.waitForTimeout(500); await shot(n);
  }
  await page.goto(BASE + '#/progress'); await page.waitForTimeout(300); await shot('21b-progress-full', true);

  // Desktop + dark mode
  const dark = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
  const p2 = await dark.newPage();
  p2.on('pageerror', (e) => errors.push('dark pageerror: ' + e.message));
  await p2.addInitScript(() => localStorage.setItem('norsk-na.v1', JSON.stringify({ game: { onboarded: true }, settings: { name: 'Alex' } })));
  await p2.goto(BASE + '#/');
  await p2.waitForSelector('.today-card');
  await p2.waitForTimeout(600);
  await p2.screenshot({ path: `${SHOTS}/30-desktop-dark-home.png` });

  console.log('ERRORS:', JSON.stringify(errors, null, 1));
  await browser.close();
})().catch(async (e) => {
  console.error('FAILED', e.message.split('\n')[0]);
  console.log('ERRORS:', JSON.stringify(errors, null, 1));
  if (lastPage) await lastPage.screenshot({ path: `${SHOTS}/zz-failure.png` }).catch(() => {});
  process.exit(1);
});
