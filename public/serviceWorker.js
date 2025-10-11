const CACHE_NAME = 'plantpal-cache-v8';

console.log("Service Worker: Registered");

function log(message) {
    console.log("Service Worker: " + message);
}

// Use the install event to pre-cache all initial resources
self.addEventListener("install", (event) => {
    log("Service Worker: Installing....");
    event.waitUntil(
        (async () => {
        log("Service Worker: Caching App Shell at the moment......");
        try {
            const cache = await caches.open(CACHE_NAME);
            const resourcesToCache = {
            html: [
                "/", 
                "/addplant",
                "/error/404_error", 
                "/error/offline"
            ],
            css: ["/css/output.css"],
            images: [
                "/images/login.jpg",
                "/images/logo.jpg",
                "/images/placeholder.jpg",
                "/images/noplant.jpg",
                "/images/addplant.jpg",
                "/images/offlineimage.png",
                "/images/chat.jpg"
            ],
            javascripts: [
                '/javascripts/homepage/homepageRenderScript.js',
                '/javascripts/homepage/homepageScript.js',
                "/javascripts/addPlant/addPlantScript.js",
                "/javascripts/addPlant/addPlantUtility.js",
                "/javascripts/chat/chatScript.js",
                "/javascripts/chat/chatIDBUtility.js",
                "/javascripts/chat/chatRenderScript.js",
                "/javascripts/details/plantDetailsScript.js",
                "/javascripts/user/userScript.js",
                "/javascripts/user/userRenderScript.js",
                "/javascripts/user/userIDBUtility.js",
                "/javascripts/utils/connectivityCheck.js",
                "/javascripts/workers/imageWorker.js"
            ],
            };
            const resources = Object.values(resourcesToCache).flat();
            await cache.addAll(resources);
        } catch (error) {
            log("Error occurred while caching: " + error);
        }
        })()
    );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
    log("Service Worker: Activating...");
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        log("Service Worker: Deleting old cache: " + cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event - intelligent caching strategy
self.addEventListener("fetch", function (event) {
    const url = new URL(event.request.url);
    
    // Only handle GET requests for caching
    if (event.request.method !== 'GET') {
        // For non-GET requests (POST, PUT, DELETE, etc.), just pass through to network
        event.respondWith(fetch(event.request));
        return;
    }
    
    // API calls: Network-first, no cache (data handled by IndexedDB)
    const isAPICall = url.pathname.startsWith('/api/');
    if (isAPICall) {
        event.respondWith(
            fetch(event.request)
                .catch((error) => {
                    log("API call failed (offline): " + url.pathname);
                    // Return proper error response for offline API calls
                    return new Response(
                        JSON.stringify({ error: 'offline', message: 'No network connection' }),
                        {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
        return;
    }
    
    // Static assets: Cache-first strategy (fast offline experience)
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version immediately
                    log("Serving from cache: " + url.pathname);
                    
                    // Optionally update cache in background (stale-while-revalidate)
                    if (navigator.onLine) {
                        fetch(event.request)
                            .then((networkResponse) => {
                                if (networkResponse && networkResponse.status === 200) {
                                    caches.open(CACHE_NAME).then((cache) => {
                                        cache.put(event.request, networkResponse.clone());
                                    });
                                }
                            })
                            .catch(() => {
                                // Ignore background update failures
                            });
                    }
                    
                    return cachedResponse;
                }
                
                // Not in cache, fetch from network
                return fetch(event.request)
                    .then((response) => {
                        // Cache successful responses
                        if (response && response.status === 200) {
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        }
                        return response;
                    })
                    .catch(() => {
                        // Network failed and not in cache - show offline page
                        log("Network failed for: " + url.pathname);
                        return getOfflinePage().then((offlinePage) => {
                            if (offlinePage) {
                                return offlinePage;
                            }
                            return new Response(
                                "You are offline and the requested content is not cached.",
                                {
                                    status: 503,
                                    statusText: "Service Unavailable",
                                    headers: { 'Content-Type': 'text/plain' }
                                }
                            );
                        });
                    });
            })
    );
});

function getOfflinePage() {
    return caches.match("/error/offline");
}

function get404Page() {
    return caches.match("/error/404_error");
}