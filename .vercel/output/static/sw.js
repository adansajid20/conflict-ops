const STATIC_CACHE = 'conflict-ops-static-v1'
const API_CACHE = 'conflict-ops-api-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(['/manifest.json'])))
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          void caches.open(API_CACHE).then((cache) => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const clone = response.clone()
    void caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone))
    return response
  })))
})