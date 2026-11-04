// Import a textbook PDF (or paste text) and turn it into reading + flashcards.

import { h, clear, toast, progressBar, add } from '../ui/dom.js';
import { extractPdf, textToPages, analyseDoc } from '../core/pdf.js';
import { dictHas } from '../core/lexicon.js';
import { docs } from '../core/store.js';
import { addCard } from '../core/deck.js';
import { unlock } from '../core/gamify.js';
import { navigate } from '../ui/router.js';

export function importView(root) {
  const status = h('div.stack');
  const fileInput = h('input', { type: 'file', accept: 'application/pdf,.pdf,.txt,text/plain', hidden: true, onchange: (e) => handleFile(e.target.files[0]) });
  const drop = h('label.dropzone', {
    ondragover: (e) => { e.preventDefault(); drop.classList.add('over'); },
    ondragleave: () => drop.classList.remove('over'),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove('over'); handleFile(e.dataTransfer.files[0]); },
  }, fileInput, h('div.big-emoji', '📄'), h('div.strong', 'Choose a PDF or .txt file'), h('div.small.muted', 'or drop it here · processed on your device, never uploaded'));
  const paste = h('textarea.input', { rows: 6, placeholder: '…or paste Norwegian text here (an article, song lyrics, a chapter)' });
  const titleIn = h('input.input', { placeholder: 'Title (optional)' });

  add(root, h('div.stack',
    h('div.page-head', h('h1', 'Import your textbook'), h('p.muted', 'Turn any beginner textbook into tap-to-translate reading and ready-made flashcards.')),
    drop,
    h('div.card.stack', titleIn, paste, h('div.row.end', h('button.btn', {
      onclick: () => {
        if (!paste.value.trim()) return toast('Paste some text first.');
        finish(textToPages(paste.value), titleIn.value.trim() || paste.value.trim().split('\n')[0].slice(0, 40));
      },
    }, 'Import text'))),
    status,
    h('details.card.small',
      h('summary', h('b', 'What works best? Where do I find free textbooks?')),
      h('ul',
        h('li', 'PDFs with real text (you can select the text in a PDF viewer). Scanned image-only PDFs need OCR first – e.g. “OCR” in Adobe Reader or a free online OCR tool.'),
        h('li', 'Glossaries in the form “et hus – a house”, “å spise = to eat”, or two-column word lists are detected automatically and offered as flashcards.'),
        h('li', 'New cards are introduced a few per day (your “new words per day” setting) – so a 1000-word glossary won’t overwhelm you.'),
        h('li', 'Free, legal sources: university course materials that are openly published, open textbooks (e.g. on Wikibooks), texts from your own course, and NRK/news articles you paste in for personal study. Only import material you have the right to use.')))));

  async function handleFile(file) {
    if (!file) return;
    clear(status);
    const bar = progressBar(0);
    const label = h('div.small.muted', 'Reading file…');
    add(status, h('div.card.stack', h('div.strong', file.name), bar, label));
    try {
      let pages, title = file.name.replace(/\.(pdf|txt)$/i, '');
      if (/\.txt$/i.test(file.name) || file.type === 'text/plain') {
        pages = textToPages(await file.text());
      } else {
        const res = await extractPdf(file, (p, n, total) => {
          bar.firstChild.style.width = `${Math.round(p * 100)}%`;
          label.textContent = `Extracting page ${n} of ${total}…`;
        });
        pages = res.pages;
        if (res.title && res.title.length > 3) title = res.title;
      }
      finish(pages, titleIn.value.trim() || title);
    } catch (e) {
      console.error(e);
      add(clear(status), h('div.card.bad', 'Could not read this file: ', e.message || String(e)));
    }
  }

  async function finish(pages, title) {
    const chars = pages.flat().join('').length;
    if (chars < 20) {
      add(clear(status), h('div.card.bad', 'No text found. This looks like a scanned (image-only) PDF – run it through OCR first, then import again.'));
      return;
    }
    const analysis = analyseDoc(pages, dictHas);
    const doc = { id: `d${Date.now().toString(36)}`, title: title || 'Untitled', importedAt: Date.now(), lastPage: 0, ...analysis };
    try {
      await docs.put(doc);
    } catch (e) {
      add(clear(status), h('div.card.bad', 'Could not save the document in this browser: ', e.message));
      return;
    }
    unlock('importer');
    const { stats, pairs } = analysis;
    const rows = pairs.slice(0, 400).map((p) => {
      const cb = h('input', { type: 'checkbox', checked: true });
      return { p, cb, el: h('label.pair-row', cb, h('span.no', p.no), h('span.muted', ' – '), h('span', p.en), h('span.small.muted', ` · p.${p.page + 1}`)) };
    });
    add(clear(status), h('div.card.stack',
      h('div.kicker', '✅ Imported'),
      h('div.strong', doc.title),
      h('div.stat-row',
        h('div.stat', h('div.stat-n', String(pages.length)), h('div.stat-l', 'pages')),
        h('div.stat', h('div.stat-n', String(stats.no)), h('div.stat-l', 'Norwegian lines')),
        h('div.stat', h('div.stat-n', String(pairs.length)), h('div.stat-l', 'word pairs'))),
      pairs.length ? h('div.stack.tight',
        h('p.small', 'These look like vocabulary entries. Untick any that are wrong, then add them. Each card gets an example sentence from the book when one is found.'),
        h('div.row', h('button.btn.ghost.small', { onclick: () => rows.forEach((r) => (r.cb.checked = true)) }, 'All'), h('button.btn.ghost.small', { onclick: () => rows.forEach((r) => (r.cb.checked = false)) }, 'None')),
        h('div.pair-list', ...rows.map((r) => r.el)),
        h('button.btn.primary', {
          onclick: (e) => {
            let n = 0;
            for (const r of rows) if (r.cb.checked && addCard({ no: r.p.no, en: r.p.en, ex: r.p.ex ? { no: r.p.ex, en: '' } : null, src: `pdf:${doc.id}` }).created) n++;
            toast(`Added ${n} cards – they’ll be introduced a few per day.`, { icon: '📇' });
            e.currentTarget.disabled = true;
          },
        }, `Add ${rows.length} cards to my deck`))
        : h('p.small.muted', 'No glossary pairs detected – no problem: read it with tap-to-translate and add words as you go.'),
      h('a.btn.primary', { href: `#/read/doc/${doc.id}/0` }, 'Open reader ▸')));
  }
}

export function goImport() { navigate('#/import'); }
