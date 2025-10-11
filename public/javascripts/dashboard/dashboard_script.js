async function getPlantsFromNetwork() {
    try {
        // Attempt to read the last sync timestamp
        const lastSync = typeof getLastSync === 'function' ? await getLastSync() : null;

        const url = lastSync ? `/api/plants?since=${encodeURIComponent(lastSync)}` : '/api/plants';

        const response = await fetch(url);
        if (!response.ok) {
            console.error('Failed to fetch plants from network, status:', response.status);
            return null;
        }

        const data = await response.json();

        // Expect the server to return { success, plants } or an array
        const plants = Array.isArray(data) ? data : (data.plants || []);

        // Do any processing needed here (e.g., merge into UI, update IDB)
        console.log('Plants fetched from network (since:', lastSync, '):', plants.length);

        // On success, update lastSync timestamp
        if (typeof saveLastSync === 'function') {
            try { await saveLastSync(); } catch (e) { console.error('saveLastSync error:', e); }
        }

        return plants;
    } catch (error) {
        console.error('Error in getPlantsFromNetwork:', error);
        return null;
    }
}

// Export for other modules or attach to window for inline usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getPlantsFromNetwork };
} else {
    window.getPlantsFromNetwork = getPlantsFromNetwork;
}
