/**
 * @fileoverview Service Worker for Plant Sharing Community PWA.
 * Implements offline-first caching strategy with cache-first for static assets
 * and network-first for dynamic API content. Enables offline functionality.
 * 
 * Cache Strategy:
 * - Static assets (HTML, CSS, JS, images): Cache-first with network fallback
 * - API endpoints: Network-first with cache fallback
 * - Automatic cache cleanup on activation
 * 
 * @version 11
 */

const CACHE_NAME = 'plantpal-cache-v11';

console.log("Service Worker: Registered");

/**
 * Log helper function with service worker prefix.
 * @param {string} message - Message to log
 */
function log(message) {
    console.log("Service Worker: " + message);
}

/**
 * Install event - pre-cache essential app resources.
 * Caches all static assets needed for offline operation.
 */
self.addEventListener("install", (event) => {
    log("Service Worker: Installing....");
    event.waitUntil(
        (async () => {
        log("Service Worker: Caching App Shell at the moment......");
        try {
            const cache = await caches.open(CACHE_NAME);
            // Core routes to cache
            const coreRoutes = [
                "/",
                "/addplant", 
                "/error/404_error",
                "/error/offline",
                "/homepage",
                "/chat",
                "/plantDetails"
            ];
            
            // Cache main application files and resources
            const resourcesToCache = {
            html: coreRoutes,
            css: [
                "/css/outputStyles.css", 
                "/css/output.css"
            ],
            images: [
                "/images/login.jpg",
                "/images/logo.jpg",
                "/images/placeholder.jpg",
                "/images/noplant.jpg",
                "/images/addplant.jpg",
                "/images/offlineimage.png",
                "/images/chat.jpg",
                "/images/icon-512.png",
                "/images/icon-384.png", 
                "/images/icon-192.png",
                "/images/icon-96.png",
                "/images/icon-72.png",
                "/images/icon-48.png"
            ],
            javascripts: [
                // Homepage scripts
                '/javascripts/homepage/homepageRenderScript.js',
                '/javascripts/homepage/homepageScript.js',
                '/javascripts/homepage/homeRenderScript.JS',
                
                // Add plant scripts
                "/javascripts/addPlant/addPlantScript.js",
                "/javascripts/addPlant/addPlantUtility.js",
                
                // Chat scripts
                "/javascripts/chat/chatScript.js",
                "/javascripts/chat/chatIDBUtility.js",
                "/javascripts/chat/chatRenderScript.js",
                "/javascripts/chat/chatOfflineUtility.js",
                
                // Details scripts
                "/javascripts/plantdetail/plantDetailsScript.js",
                
                // User scripts
                "/javascripts/user/userScript.js",
                "/javascripts/user/userRenderScript.js",
                "/javascripts/user/userIDBUtility.js",
                
                // Utility scripts
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

/**
 * Activate event - clean up old cache versions.
 * Removes outdated caches when new service worker takes control.
 */
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

/**
 * Fetch event - implements intelligent caching strategy:
 * - API calls: Network-first with offline fallback
 * - Navigation (HTML): Network-first with home fallback
 * - Static assets: Cache-first with network fallback
 */
self.addEventListener("fetch", function (event) {
    const url = new URL(event.request.url);
    
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }
    
    const isNavigationRequest = event.request.mode === 'navigate';
    const isAPICall = url.pathname.startsWith('/api/');
    
    // API calls: Network-first (no cache)
    if (isAPICall) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return new Response(
                        JSON.stringify({ 
                            error: 'offline', 
                            message: 'No network connection',
                            offline: true
                        }),
                        {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                })
        );
        return;
    }
    
    // Network-First for ALL requests when online
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Cache successful responses for offline use
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Only use cache as fallback when network fails
                return caches.match(event.request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            log("📦 Serving from cache (offline): " + url.pathname);
                            return cachedResponse;
                        }
                        
                        // Return offline page for navigation
                        if (isNavigationRequest) {
                            return caches.match("/error/offline");
                        }
                        
                        // Default offline response
                        return new Response("Offline", { status: 503 });
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