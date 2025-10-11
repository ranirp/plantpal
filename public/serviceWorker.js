const CACHE_NAME = 'plantpal-cache-v2';

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
                "/javascripts/addPlant/addPlantIdbUtility.js",
                "/javascripts/chat/chatScript.js",
                "/javascripts/chat/chatIdbUtility.js",
                "/javascripts/chat/chatRenderingScript.js",
                "/javascripts/user/userScript.js",
                "/javascripts/user/userRenderScript.js",
                "/javascripts/user/userIdbUtility.js",
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

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", function (event) {
    log(event.request.url);
    
    // Only handle GET requests for caching
    if (event.request.method !== 'GET') {
        // For non-GET requests (POST, PUT, DELETE, etc.), just pass through to network
        event.respondWith(fetch(event.request));
        return;
    }
    
    event.respondWith(
        fetch(event.request)
        .then((response) => {
            // Only cache successful GET responses
            if (response.status === 200) {
                // Clone the response before caching
                const responseToCache = response.clone();
                
                // Cache the new response for future use
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                }).catch((error) => {
                    log("Cache put failed: " + error);
                });
            }
            
            return response;
        })
        .catch(() => {
            return caches.match(event.request).then((response) => {
            if (response) {
                return response;
            }
            return getOfflinePage().then((response) => {
                return (
                response ||
                get404Page().then(
                    (response) =>
                    response ||
                    new Response(
                        "You are offline and the requested content is not cached.",
                        {
                        status: 404,
                        statusText: "Not Found",
                        }
                    )
                )
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