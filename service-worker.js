// EOW Bhopal Dashboard - Service Worker (PWA)
// Provides offline caching for instant loading

const CACHE_VERSION = 'eow-v1';
const CACHE_NAME = `eow-bhopal-${CACHE_VERSION}`;

// Files to cache on install (app shell)
const APP_SHELL = [
  '/',
  '/supervisor.html',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

// Install event - cache app shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Best effort - don't fail if some files missing
      return Promise.all(
        APP_SHELL.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Failed to cache:', url, err);
          });
        })
      );
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  // Take control immediately
  self.clients.claim();
});

// Fetch event - network-first for HTML, cache-first for assets
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Supabase API requests (always go to network)
  if (url.hostname.indexOf('supabase') > -1) return;
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) return;
  
  // For HTML files: network first, fall back to cache
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).then(function(response) {
        // Update cache with fresh response
        const respClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, respClone);
        });
        return response;
      }).catch(function() {
        // Network failed - serve from cache
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('/supervisor.html');
        });
      })
    );
    return;
  }
  
  // For assets (images, scripts): cache first, fall back to network
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        // Cache successful responses
        if (response && response.status === 200) {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, respClone);
          });
        }
        return response;
      });
    })
  );
});
