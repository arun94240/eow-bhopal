// EOW Bhopal Pragati Form - Service Worker (PWA)
// Provides offline caching for instant loading
// Scope: /io-form.html only — Doesn't interfere with Dashboard or Avkash SW

const CACHE_VERSION = 'pragati-v1';
const CACHE_NAME = `eow-pragati-${CACHE_VERSION}`;

// Files to cache on install (app shell)
const APP_SHELL = [
  '/io-form.html',
  '/pragati-manifest.json',
  '/icons/pragati-icon-192.png',
  '/icons/pragati-icon-512.png',
  '/icons/pragati-apple-touch.png'
];

// Install event - cache app shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Best effort - don't fail if some files missing
      return Promise.all(
        APP_SHELL.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[Pragati SW] Failed to cache:', url, err);
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
        keys.filter(function(k) { return k.indexOf('eow-pragati-') === 0 && k !== CACHE_NAME; })
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
  
  // Only handle Pragati-related URLs
  const path = url.pathname;
  const isPragatiAsset = path === '/io-form.html' 
    || path === '/pragati-manifest.json'
    || path.indexOf('/icons/pragati-') === 0;
  
  if (!isPragatiAsset) return;
  
  // For HTML: network-first, fall back to cache
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
          return cached || caches.match('/io-form.html');
        });
      })
    );
    return;
  }
  
  // For assets: cache-first, fall back to network
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
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
