/* ============================================================
   US BENGOL - Service Worker for Offline Support (PWA)
   ============================================================ */

const CACHE_NAME = 'usbengol-v3';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

/* External CDN resources to cache */
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

/* Install - Cache all essential assets */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS);
            })
            .then(() => {
                // Try caching CDN assets but don't fail if they're unavailable
                return caches.open(CACHE_NAME).then((cache) => {
                    return Promise.allSettled(
                        CDN_ASSETS.map(url => cache.add(url).catch(() => null))
                    );
                });
            })
            .then(() => self.skipWaiting())
    );
});

/* Activate - Clean up old caches */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

/* Fetch - Serve from cache, fallback to network */
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version and update in background
                    event.waitUntil(
                        fetch(event.request).then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(event.request, networkResponse);
                                });
                            }
                        }).catch(() => { /* Offline, no update needed */ })
                    );
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetch(event.request).then((networkResponse) => {
                    // Cache valid responses
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // Offline and not cached - return offline page for navigation
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});
