/**
 * @fileoverview Server connectivity verification utility.
 * Provides real server reachability checking beyond navigator.onLine.
 * Implements caching, timeout handling, and consecutive failure tracking.
 * 
 * Key Features:
 * - Lightweight HEAD requests to health endpoint
 * - Timeout handling with AbortController
 * - Consecutive failure/success tracking for stability
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
    if (!window._connectivityState) {
        window._connectivityState = {
            lastCheck: 0,
            isOnline: null,
            checkInterval: 10000,
            consecutiveFailures: 0,
            consecutiveSuccesses: 0,
            healthEndpoint: '/health'
        };
    }

    const state = window._connectivityState;
    const now = Date.now(); 
    
    // Use cached value if recent 
    if (!forceCheck && state.isOnline !== null && 
        (now - state.lastCheck) < state.checkInterval) {
        const age = Math.round((now - state.lastCheck) / 1000);
        console.log(`Using cached status: ${state.isOnline ? 'ONLINE' : 'OFFLINE'} (${age}s old)`);
        return state.isOnline;
    }

    console.log("Checking server connectivity...");
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch('/health', {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        clearTimeout(timeoutId);

        if (response.ok || response.status === 304) {
            console.log('Server ONLINE');
            state.consecutiveSuccesses++;
            state.consecutiveFailures = 0;
            state.isOnline = true;
            state.lastCheck = now;
            return true;
        } else {
            console.log('Server responded:', response.status);
            const isOnline = response.status < 500;
            
            if (isOnline) {
                state.consecutiveSuccesses++;
                state.consecutiveFailures = 0;
            } else {
                state.consecutiveFailures++;
                state.consecutiveSuccesses = 0;
            }
            
            state.isOnline = isOnline;
            state.lastCheck = now;
            return isOnline;
        }
    } catch (error) {
        console.log('Server check failed:', error.message);
        
        state.consecutiveFailures++;
        state.consecutiveSuccesses = 0;
        state.isOnline = false;
        state.lastCheck = now; 
        return false;
    }
}