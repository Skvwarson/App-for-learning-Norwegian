// Offline support: cache the app shell, serve cache-first, refresh in the background.
const VERSION = 'norsk-na-v2';
const SHELL = [
  './', './index.html', './css/app.css', './manifest.webmanifest', './icons/icon.svg',
  './js/main.js', './js/ui/dom.js', './js/ui/router.js', './js/ui/components.js',
  './js/core/fsrs.js', './js/core/text.js', './js/core/store.js', './js/core/deck.js', './js/core/gamify.js',
  './js/core/course.js', './js/core/speech.js', './js/core/lexicon.js', './js/core/pdf.js', './js/core/tutor.js',
  './js/views/home.js', './js/views/learn.js', './js/views/lesson.js', './js/views/review.js', './js/views/read.js',
  './js/views/import.js', './js/views/speak.js', './js/views/roleplay.js', './js/views/practice.js', './js/views/words.js',
  './js/views/progress.js', './js/views/science.js', './js/views/settings.js', './js/views/onboarding.js', './js/views/voice-settings.js',
  './data/units.js', './data/stories.js', './data/dictionary.js', './data/habits.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('norsk-na-v') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
