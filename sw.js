// Offline support. Network first (so updates show up immediately when online),
// falling back to the cached copy when offline or when the network is very slow.
// Keep VERSION in sync with APP_VERSION in js/core/version.js.
const VERSION = 'norsk-na-v14';
const SHELL = [
  './', './index.html', './css/app.css', './manifest.webmanifest', './icons/icon.svg',
  './js/main.js', './js/ui/dom.js', './js/ui/router.js', './js/ui/components.js', './js/ui/celebrate.js', './js/ui/icons.js',
  './js/core/fsrs.js', './js/core/text.js', './js/core/store.js', './js/core/deck.js', './js/core/gamify.js',
  './js/core/course.js', './js/core/speech.js', './js/core/lexicon.js', './js/core/version.js', './js/core/today.js', './js/core/social.js',
  './js/views/home.js', './js/views/learn.js', './js/views/lesson.js', './js/views/review.js', './js/views/read.js',
  './js/views/speak.js', './js/views/roleplay.js', './js/views/practice.js', './js/views/words.js',
  './js/views/progress.js', './js/views/settings.js', './js/views/onboarding.js', './js/views/friends.js',
  './data/units.js', './data/units-a2.js', './data/recordings.js', './data/stories.js', './data/dictionary.js', './data/habits.js',
  './vendor/fonts/nunito-latin-wght-normal.woff2', './vendor/fonts/literata-latin-wght-normal.woff2',
];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version never caches old files.
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('norsk-na-v') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = cache.match(e.request, { ignoreSearch: true });
    // A navigation Request can't be re-used with options, so fetch by URL.
    const network = fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    });
    const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
    try {
      const res = await Promise.race([network, timeout.then(() => cached)]);
      if (res) return res;
      return await network;
    } catch {
      return (await cached) || Response.error();
    }
  })());
});
