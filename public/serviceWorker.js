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
 * @version 10
 */

const CACHE_NAME = 'plantpal-cache-v10';

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
                "/javascripts/details/plantDetailsScript.js",
                
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
    // Parse request URL for routing decisions
    const url = new URL(event.request.url);
    
    // Only handle GET requests for caching
    if (event.request.method !== 'GET') {
        // For non-GET requests (POST, PUT, DELETE, etc.), just pass through to network
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Check if this is a navigation request (HTML page)
    const isNavigationRequest = event.request.mode === 'navigate';
    
    // API calls: Network-first with offline fallback
    const isAPICall = url.pathname.startsWith('/api/');
    if (isAPICall) {
        event.respondWith(
            fetch(event.request)
                .catch((error) => {
                    log("API call failed (offline): " + url.pathname);
                    
                    // Special handling for API endpoints that should work offline
                    if (url.pathname.includes('/api/chat/')) {
                        // Return empty chat array for offline chat requests
                        return new Response(
                            JSON.stringify({ 
                                success: true,
                                message: "Offline mode: use cached messages", 
                                messages: []  // Empty array 
                            }),
                            {
                                status: 200,
                                headers: { 'Content-Type': 'application/json' }
                            }
                        );
                    }
                    
                    // For other API calls, return a proper offline error
                    return new Response(
                        JSON.stringify({ 
                            error: 'offline', 
                            message: 'No network connection',
                            offline: true
                        }),
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
    
    // For navigation requests (HTML pages), use network-first with fallback to home
    if (isNavigationRequest) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Clone the response before caching
                    const responseToCache = response.clone();
                    
                    // Cache all successful navigation responses
                    if (response.status === 200) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                            log("Cached navigation response for: " + url.pathname);
                        });
                    }
                    
                    return response;
                })
                .catch(() => {
                    // If network fails, try to return the page from cache
                    return caches.match(event.request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                log("Serving cached navigation for: " + url.pathname);
                                return cachedResponse;
                            }
                            
                            // If not in cache, return the offline fallback page
                            log("Navigation request failed and not cached: " + url.pathname);
                            return getOfflinePage();
                        });
                })
        );
        return;
    }
    
    // For all other requests (assets, scripts, etc), use cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version immediately
                    log("Serving from cache: " + url.pathname);
                    
                    // Optionally update cache in background 
                    if (navigator.onLine) {
                        fetch(event.request)
                            .then((networkResponse) => {
                                if (networkResponse && networkResponse.status === 200) {
                                    caches.open(CACHE_NAME).then((cache) => {
                                        cache.put(event.request, networkResponse.clone());
                                        log("Updated cache in background for: " + url.pathname);
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
                            // Only cache assets we want to keep
                            if (url.pathname.endsWith('.js') || 
                                url.pathname.endsWith('.css') || 
                                url.pathname.includes('/images/') || 
                                url.pathname.includes('/fonts/')) {
                                
                                const responseToCache = response.clone();
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(event.request, responseToCache);
                                    log("Cached new asset: " + url.pathname);
                                });
                            }
                        }
                        return response;
                    })
                    .catch(() => {
                        // Network failed and not in cache - show offline page
                        log("Network failed for asset: " + url.pathname);
                        
                        // For images, return a default offline image
                        if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                            return caches.match("/images/offlineimage.png");
                        }
                        
                        // For other resources, return a simple error
                        return new Response(
                            "Resource unavailable offline",
                            {
                                status: 503,
                                statusText: "Service Unavailable",
                                headers: { 'Content-Type': 'text/plain' }
                            }
                        );
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