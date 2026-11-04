// Generates a small "textbook" PDF (glossary + reading text + English
// instructions) to test the importer. Usage: node tests/make-sample-pdf.cjs out.pdf
const { chromium } = require('playwright');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:Georgia,serif;margin:40px;font-size:15px} h1{font-size:22px} table td{padding:2px 18px 2px 0}
</style></head><body>
<h1>Chapter 4: At home</h1>
<p>In this chapter you will learn words for the house. Read the text and answer the questions.</p>
<p>Ingrid bor i et lite hus på landet. Huset har tre rom og et stort kjøkken.</p>
<p>Hver morgen drikker hun kaffe ved vinduet og ser på fjellene.</p>
<p>Om kvelden leser hun en bok i stua. Hun liker huset sitt veldig godt.</p>
<h2>Vocabulary</h2>
<p>et hus – a house</p>
<p>et kjøkken – a kitchen</p>
<p>ei stue – a living room</p>
<p>et vindu – a window</p>
<p>å drikke – to drink</p>
<p>et fjell = a mountain</p>
<table><tr><td>landet</td><td>the countryside</td></tr><tr><td>hver morgen</td><td>every morning</td></tr></table>
<h2>Exercises</h2>
<p>1. Translate the following sentences into Norwegian.</p>
<p>2. Where does Ingrid live? Hvor bor Ingrid?</p>
</body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(html);
  await p.pdf({ path: process.argv[2] || 'sample.pdf', format: 'A4' });
  await b.close();
})();
