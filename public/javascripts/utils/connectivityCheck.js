/**
 * Connectivity Check Utility
 * Provides a function to verify actual server connectivity
 * by making a lightweight API call, not just relying on navigator.onLine
 */

/**
 * Check if the server is actually reachable
 * @returns {Promise<boolean>} True if server is reachable, false otherwise
 */
async function checkServerConnectivity() {
    // If navigator says we're offline, no need to check server
    if (!navigator.onLine) {
        console.log('🔴 Navigator.onLine is false - definitely offline');
        return false;
    }

    try {
        // Make a lightweight HEAD request to check server availability
        // Using a short timeout to avoid long waits
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch('/api/plants', {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-cache'
        });

        clearTimeout(timeoutId);

        // Server responded - we're online
        if (response.ok || response.status === 304) {
            console.log('🟢 Server connectivity check: ONLINE');
            return true;
        } else {
            console.log('🟡 Server responded with status:', response.status);
            return response.status < 500; // Client errors still mean we're online
        }
    } catch (error) {
        // Network error or timeout - we're offline
        if (error.name === 'AbortError') {
            console.log('🔴 Server connectivity check: TIMEOUT (offline)');
        } else {
            console.log('🔴 Server connectivity check: ERROR (offline)', error.message);
        }
        return false;
    }
}

/**
 * Update online status across the application
 * This can be called from any page to update the UI
 * @param {boolean} isOnline - Current connectivity status
 */
function changeOnlineStatus(isOnline) {
    // This function is called from various components to update status
    // It's defined here for consistency but can be overridden if needed
    console.log(`📡 Connectivity status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
}
