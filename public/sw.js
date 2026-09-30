// Lets the officer forms open with no signal (garages, basements).
// Pages: always try the network first, fall back to the last saved copy.
// Build files (/_next/static, content-hashed): saved once, served from cache.
// Nothing else is touched: form submissions and database calls go straight
// to the network, and the page's own outbox handles sending later.

const VERSION = "v1";
const PAGES = `allied-pages-${VERSION}`;
const STATIC = `allied-static-${VERSION}`;
const OFFICER_PAGES = ["/forms", "/calloff", "/dar", "/dar/scan", "/dar/my-dars", "/timeoff"];

async function precache() {
  const pages = await caches.open(PAGES);
  const stat = await caches.open(STATIC);
  await Promise.all(OFFICER_PAGES.map(async (path) => {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) return;
      const html = await res.clone().text();
      await pages.put(path, res);
      // Save the page's scripts and styles too, so it works offline even if
      // the officer has never opened it before.
      const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
      await Promise.all(assets.map((a) => stat.add(a).catch(() => {})));
    } catch { /* offline during install: pages get saved as they're visited */ }
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = [PAGES, STATIC];
    for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.open(STATIC).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && OFFICER_PAGES.includes(url.pathname)) {
          const cache = await caches.open(PAGES);
          cache.put(url.pathname, res.clone());
        }
        return res;
      } catch {
        const cache = await caches.open(PAGES);
        return (await cache.match(url.pathname)) || (await cache.match("/forms")) || Response.error();
      }
    })());
  }
});
