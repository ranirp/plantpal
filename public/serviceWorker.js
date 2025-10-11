const CACHE_NAME = 'plantpal-cache-v1';
const urlsToCache = [
    '/',
    '/css/outputStyles.css',
    '/javascripts/homepage/homepageRenderScript.js',
    '/javascripts/homepage/homepageScript.js',
    '/javascripts/addPlant/addPlantScript.js',
    '/javascripts/chat/chatScript.js',
    '/images/logo.jpg',
    '/images/noplant.jpg',
    '/images/placeholder.jpg',
    '/images/chat.jpg'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip caching for API requests and Socket.IO
    if (event.request.url.includes('/api/') || 
        event.request.url.includes('/socket.io/') ||
        event.request.url.includes('check=true')) {
        // Always go to network for API calls
        return event.respondWith(fetch(event.request));
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return the response from the cache
                if (response) {
                    return response;
                }
                // Not in cache - return the result from the live server
                return fetch(event.request).catch(() => {
                    // If network fails, return a meaningful error for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match('/offline');
                    }
                });
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});