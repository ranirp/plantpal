/**
 * @fileoverview Server connectivity verification utility.
 * Provides real server reachability checking beyond navigator.onLine.
 * Implements caching, timeout handling, and consecutive failure tracking.
 * 
 * Key Features:
 * - Lightweight HEAD requests to health endpoint
 * - 1-minute caching to reduce network overhead
 * - 3-second timeout for responsive checks
 * - Consecutive failure/success tracking
 * - Cache-busting headers for accurate status
 */

/**
 * Verify actual server reachability with caching and timeout.
 * Makes HEAD request to /health endpoint with 3s timeout.
 * Results cached for 60s unless forceCheck is true.
 * 
 * @param {boolean} forceCheck - Bypass cache and force fresh check
 * @returns {Promise<boolean>} True if server reachable, false otherwise
 */
async function checkServerConnectivity(forceCheck = false) {
    // Cache connectivity status (updated every minute)
    if (!window._connectivityState) {
        window._connectivityState = {
            lastCheck: 0,
            isOnline: null,
            checkInterval: 60000, // 1 minute cache
            consecutiveFailures: 0,
            consecutiveSuccesses: 0,
            healthEndpoint: '/health' 
        };
    }

    // Use cached value if recent (unless forcing a check)
    const now = Date.now();
    if (!forceCheck && 
        window._connectivityState.isOnline !== null && 
        now - window._connectivityState.lastCheck < window._connectivityState.checkInterval) {
        console.log(`🔵 Using cached connectivity (${window._connectivityState.isOnline ? 'online' : 'offline'}) from ${Math.round((now - window._connectivityState.lastCheck)/1000)}s ago`);
        return window._connectivityState.isOnline;
    }

    // If navigator says we're offline and we're not forcing a check, no need to check server
    if (!forceCheck && !navigator.onLine) {
        console.log('🔴 Navigator.onLine is false - definitely offline');
        window._connectivityState.isOnline = false;
        window._connectivityState.lastCheck = now;
        window._connectivityState.consecutiveFailures++;
        window._connectivityState.consecutiveSuccesses = 0;
        return false;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

        // Use health endpoint or API endpoint for checking
        const checkEndpoint = '/health'; // Faster health endpoint
        const response = await fetch(checkEndpoint, {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-store', // Never use cache for connectivity checks
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        clearTimeout(timeoutId);

        // Server responded - we're online
        if (response.ok || response.status === 304) {
            console.log('🟢 Server connectivity check: ONLINE');
            window._connectivityState.consecutiveSuccesses++;
            window._connectivityState.consecutiveFailures = 0;
            window._connectivityState.isOnline = true;
            window._connectivityState.lastCheck = now;
            return true;
        } else {
            console.log('🟡 Server responded with status:', response.status);
        const isOnline = response.status < 500; 
            
        // Update consecutive success/failure counters
        if (isOnline) {
            window._connectivityState.consecutiveSuccesses++;
            window._connectivityState.consecutiveFailures = 0;
        } else {
            window._connectivityState.consecutiveFailures++;
            window._connectivityState.consecutiveSuccesses = 0;
        }
            
            window._connectivityState.isOnline = isOnline;
            window._connectivityState.lastCheck = now;
            return isOnline;
        }
    } catch (error) {
        // Network error or timeout - we're offline
        if (error.name === 'AbortError') {
            console.log('🔴 Server connectivity check: TIMEOUT (offline)');
        } else {
            console.log('🔴 Server connectivity check: ERROR (offline)', error.message);
        }
        
        // Increment failure counter
        window._connectivityState.consecutiveFailures++;
        window._connectivityState.consecutiveSuccesses = 0;
        
        if (window._connectivityState.consecutiveFailures > 2) {
            window._connectivityState.isOnline = false;
        } else if (window._connectivityState.isOnline !== null) {
            console.log('⚠️ Ignoring temporary connectivity issue, maintaining previous status');
        } else {
            window._connectivityState.isOnline = false;
        }
        
        window._connectivityState.lastCheck = now;
        return window._connectivityState.isOnline;
    }
}

/**
 * Update online status across the application
 * This can be called from any page to update the UI
 * @param {boolean} isOnline - Current connectivity status
 */
function changeOnlineStatus(isOnline) {
    console.log(`📡 Connectivity status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
}
