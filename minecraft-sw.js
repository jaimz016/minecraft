const STATIC_CACHE = 'mc-guide-static-v2';
const RUNTIME_CACHE = 'mc-guide-runtime-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './minecraft-guide.html',
  './minecraft-manifest.json',
  './minecraft-sw.js',
  './mc-guide-icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(
      CORE_ASSETS.map((asset) => cache.add(asset).catch(() => null))
    );
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, RUNTIME_CACHE]);
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => !keep.has(key))
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

function shouldRuntimeCache(request) {
  if (request.method !== 'GET') return false;

  const url = request.url;
  return (
    url.startsWith(self.location.origin) ||
    url.startsWith('https://cdn.tailwindcss.com') ||
    url.startsWith('https://unpkg.com/lucide') ||
    url.startsWith('https://fonts.googleapis.com') ||
    url.startsWith('https://fonts.gstatic.com') ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
        return response;
      } catch {
        return (
          await caches.match(request) ||
          await caches.match('./minecraft-guide.html') ||
          await caches.match('./index.html')
        );
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);

      if (shouldRuntimeCache(request) && (response.ok || response.type === 'opaque')) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
      }

      return response;
    } catch {
      if (request.destination === 'image') {
        return caches.match('./mc-guide-icon.svg');
      }

      return (
        await caches.match(request) ||
        await caches.match('./minecraft-guide.html') ||
        await caches.match('./index.html')
      );
    }
  })());
});
