const CACHE_VERSION = 'v2'
const STATIC_CACHE = 'conflict-ops-static-' + CACHE_VERSION
const API_CACHE = 'conflict-ops-api-' + CACHE_VERSION

// Install: skip waiting to activate immediately
self.addEventListener('install', () => {
  self.skipWaiting()
})

// Activate: delete all old caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle GET requests
  if (event.request.method !== 'GET') return

  // Immutable static assets (_next/static) — cache-first (they have hashed filenames)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            void caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // API calls — network-first, fall back to cache for offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            void caches.open(API_CACHE).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => caches.match(event.request).then((cached) => cached || new Response('{"error":"offline"}', { status: 503, headers: { 'Content-Type': 'application/json' } })))
    )
    return
  }

  // Everything else (pages, navigation) — network-first, NEVER serve stale pages
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((cached) => cached || new Response('Offline', { status: 503 }))
      )
    )
    return
  }

  // Other resources (fonts, images, etc.) — network-first with short cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          void caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
