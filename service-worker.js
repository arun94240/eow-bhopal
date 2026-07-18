/* Self-destroying service worker.
   The previous worker cached a stale copy of the app, which flashed on refresh
   (an old box appearing then disappearing). This worker takes over, deletes all
   caches, unregisters itself, and reloads open pages so every future load is
   served fresh from the network. */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys()
      .then(function(keys){ return Promise.all(keys.map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.registration.unregister(); })
      .then(function(){ return self.clients.matchAll({ type: 'window' }); })
      .then(function(clients){ clients.forEach(function(c){ try { c.navigate(c.url); } catch(e){} }); })
      .catch(function(){})
  );
});
/* Network-only fetch (no caching) in case any request still reaches this worker
   before it finishes unregistering. */
self.addEventListener('fetch', function(e){ /* pass through to network */ });
