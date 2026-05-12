// EOW Bhopal Avkash Form - Service Worker (PWA)
// Provides offline caching for instant loading
// Scope: /leave-form.html only — Independent of Dashboard/Pragati SWs

const CACHE_VERSION = 'avkash-v1';
const CACHE_NAME = `eow-avkash-${CACHE_VERSION}`;

// Files to cache on install (app shell)
const APP_SHELL = [
  '/leave-form.html',
  '/avkash-manifest.json',
  '/icons/avkash-icon-192.png',
  '/icons/avkash-icon-512.png',
  '/icons/avkash-apple-touch.png'
];

// Install event - cache app shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Best effort - don't fail if some files missing
      return Promise.all(
        APP_SHELL.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[Avkash SW] Failed to cache:', url, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k.indexOf('eow-avkash-') === 0 && k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
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
  
  // Only handle Avkash-related URLs
  const path = url.pathname;
  const isAvkashAsset = path === '/leave-form.html' 
    || path === '/avkash-manifest.json'
    || path.indexOf('/icons/avkash-') === 0;
  
  if (!isAvkashAsset) return;
  
  // For HTML: network-first, fall back to cache
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).then(function(response) {
        const respClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, respClone);
        });
        return response;
      }).catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('/leave-form.html');
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
