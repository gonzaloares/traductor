/* Parole PWA: static shell only. Never intercept Supabase, OpenAI or POST requests. */
const ROOT = '/traductor/'
const CACHE_NAME = 'parole-shell-__PAROLE_BUILD_TAG__'
const PRECACHE_URLS = __PAROLE_PRECACHE_URLS__

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith('parole-shell-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(ROOT)) return

  // Hashed Next.js assets are immutable: prefer the precached copy.
  if (url.pathname.startsWith(ROOT + '_next/static/')) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req)))
    return
  }

  // Keep the app shell fresh. If offline, show only the UI; API data is never cached.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(ROOT, copy)))
        }
        return response
      }).catch(async () => {
        const cached = await caches.match(ROOT)
        return cached || Response.error()
      })
    )
  }
})
