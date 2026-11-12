// Checks that an installed copy picks up a new version by itself.
// Usage: node tests/e2e-update.cjs <served-copy-dir> <port>
// The copy is opened as http://app.localhost:<port>/ – a secure origin where the app registers its service worker.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const DIR = process.argv[2];
const PORT = process.argv[3] || '8124';
const ORIGIN = `http://app.localhost:${PORT}`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { try { localStorage.setItem('norsk-na.v1', JSON.stringify({ game: { onboarded: true, toured: true } })); } catch { /* */ } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const version = async () => {
    await page.goto(`${ORIGIN}/#/settings`);
    const t = await page.locator('text=/version \\d+/').first().textContent();
    return t.match(/version (\d+)/)[1];
  };

  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
  assert.equal(await version(), '24');
  console.log('✓ v24 installed and controlled by the service worker');

  // Publish "version 25": change the app and the service worker, as a real update does.
  const vFile = path.join(DIR, 'js/core/version.js');
  fs.writeFileSync(vFile, fs.readFileSync(vFile, 'utf8').replace("APP_VERSION = '24'", "APP_VERSION = '25'"));
  const swFile = path.join(DIR, 'sw.js');
  fs.writeFileSync(swFile, fs.readFileSync(swFile, 'utf8').replace("norsk-na-v24", "norsk-na-v25"));

  // Next visit (online): the new version must show without clearing anything.
  await page.goto(`${ORIGIN}/`);
  await page.waitForTimeout(2500); // let the new worker install, activate and trigger the one-time reload
  assert.equal(await version(), '25');
  console.log('✓ update picked up on the next visit');

  // Offline: the cached copy still works.
  await ctx.setOffline(true);
  await page.goto(`${ORIGIN}/#/learn`);
  await page.waitForSelector('.unit-hero', { timeout: 10000 });
  console.log('✓ works offline');
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('All update tests passed');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
