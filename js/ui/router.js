// Minimal hash router.

const routes = [];
let mountEl = null;
let cleanup = null;
let onChange = null;

export function route(pattern, view) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ re, keys, view, pattern });
}

export function navigate(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}

export function current() { return location.hash.slice(1) || '/'; }

export function render() {
  const path = current();
  if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { console.error(e); } }
  cleanup = null;
  mountEl.replaceChildren();
  mountEl.className = '';
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      try {
        cleanup = r.view(mountEl, params) ?? null;
        mountEl.classList.add('view-enter'); // gentle fade-in between screens
      } catch (e) {
        console.error(e);
        mountEl.textContent = `Something went wrong: ${e.message}`;
      }
      onChange?.(r.pattern, params);
      window.scrollTo(0, 0);
      return;
    }
  }
  location.hash = '#/';
}

export function start(el, { changed } = {}) {
  mountEl = el;
  onChange = changed;
  el.addEventListener('animationend', (e) => { if (e.target === el) el.classList.remove('view-enter'); });
  addEventListener('hashchange', render);
  render();
}
