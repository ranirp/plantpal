/**
 * @fileoverview Plant details page handler with offline support.
 * Manages plant detail loading from server or IndexedDB cache.
 * Stores chart data and plant information for offline viewing.
 * 
 * Key Features:
 * - Plant detail caching for offline access
 * - Chart data persistence
 * - Ownership verification
 * - Automatic cache updates on access
 * - Fallback to cached data when offline
 */

// IndexedDB database name for plant details.
const PLANT_DETAILS_DB_NAME = 'PlantDetailsDB';

// IndexedDB version for plant details database.
const PLANT_DETAILS_DB_VERSION = 1;

// Singleton instance of the plant details IndexedDB database.
let plantDetailsDB = null;

async function initPlantDetailsDB() {
    return new Promise((resolve, reject) => {
        // Open (or create) the IndexedDB database
        const request = indexedDB.open(PLANT_DETAILS_DB_NAME, PLANT_DETAILS_DB_VERSION);

        request.onerror = () => {
            console.error('Error opening plant details database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            plantDetailsDB = request.result;
            console.log('Plant details database opened successfully');
            resolve(plantDetailsDB);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create charts store for chart data
            if (!db.objectStoreNames.contains('charts')) {
                const chartsStore = db.createObjectStore('charts', { keyPath: 'plantId' });
                chartsStore.createIndex('plantId', 'plantId', { unique: true });
                chartsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
            }

            // Create plant details cache store
            if (!db.objectStoreNames.contains('plantDetailsCache')) {
                const detailsStore = db.createObjectStore('plantDetailsCache', { keyPath: 'plantId' });
                detailsStore.createIndex('plantId', 'plantId', { unique: true });
                detailsStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
            }
        };
    });
}

async function saveChartToIDB(plantId, chartData) {
    if (!plantDetailsDB) await initPlantDetailsDB();

    return new Promise((resolve, reject) => {
        const transaction = plantDetailsDB.transaction(['charts'], 'readwrite');
        const store = transaction.objectStore('charts');

        // Store chart data with sync status
        const chartRecord = {
            plantId: plantId,
            data: chartData,
            lastUpdated: new Date().toISOString(),
            syncedToServer: navigator.onLine
        };

        const request = store.put(chartRecord);

        request.onsuccess = () => {
            console.log('Chart data saved to IndexedDB for plant:', plantId);
            resolve(chartRecord);
        };

        request.onerror = () => {
            console.error('Error saving chart data:', request.error);
            reject(request.error);
        };
    });
}

async function getChartFromIDB(plantId) {
    if (!plantDetailsDB) await initPlantDetailsDB();
    
    return new Promise((resolve, reject) => {
        const transaction = plantDetailsDB.transaction(['charts'], 'readonly');
        const store = transaction.objectStore('charts');
        const request = store.get(plantId);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function cachePlantDetails(plantId, plantData) {
    if (!plantDetailsDB) await initPlantDetailsDB();

    return new Promise((resolve, reject) => {
        const transaction = plantDetailsDB.transaction(['plantDetailsCache'], 'readwrite');
        const store = transaction.objectStore('plantDetailsCache');

        // Store plant details with last accessed timestamp
        const detailsRecord = {
            plantId: plantId,
            data: plantData,
            lastAccessed: new Date().toISOString()
        };

        const request = store.put(detailsRecord);
        request.onsuccess = () => resolve(detailsRecord);
        request.onerror = () => reject(request.error);
    });
}

async function getCachedPlantDetails(plantId) {
    if (!plantDetailsDB) await initPlantDetailsDB();
    
    return new Promise((resolve, reject) => {
        const transaction = plantDetailsDB.transaction(['plantDetailsCache'], 'readonly');
        const store = transaction.objectStore('plantDetailsCache');
        const request = store.get(plantId);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function syncChartToServer(plantId, chartData) {
    if (!navigator.onLine) {
        // Defer sync if offline
        console.log('Offline: Chart will sync when online');
        return false;
    }

    try {
        const response = await fetch(`/api/plants/${plantId}/chart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chartData)
        });

        if (response.ok) {
            console.log('Chart synced to server:', plantId);
            await saveChartToIDB(plantId, { ...chartData, syncedToServer: true });
            return true;
        }
        return false;
    } catch (error) {
        console.error('Chart sync error:', error);
        return false;
    }
}

async function syncAllChartsToServer() {
    if (!navigator.onLine || !plantDetailsDB) return;
    
    return new Promise((resolve, reject) => {
        const transaction = plantDetailsDB.transaction(['charts'], 'readonly');
        const store = transaction.objectStore('charts');
        const request = store.getAll();
        
        request.onsuccess = async () => {
            const unsyncedCharts = request.result.filter(chart => !chart.syncedToServer);
            console.log(`Syncing ${unsyncedCharts.length} charts...`);
            
            const syncPromises = unsyncedCharts.map(chart => 
                syncChartToServer(chart.plantId, chart.data)
            );
            
            try {
                await Promise.all(syncPromises);
                console.log('All charts synced');
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        
        request.onerror = () => reject(request.error);
    });
}

/**
 * Load plant details with better offline support
 */
async function loadPlantDetails(plantId) {
    console.log(`Loading plant details for: ${plantId}`);
    
    // Try server first if online, then fallback to cache
    const isOnline = typeof checkServerConnectivity === 'function'
        ? await checkServerConnectivity()
        : navigator.onLine;

    if (isOnline) {
        try {
            const response = await fetch(`/api/plants/${plantId}`);
            if (response.ok) {
                const plantData = await response.json();
                await cachePlantDetails(plantId, plantData);
                console.log('✅ Loaded from server:', plantId);
                return plantData;
            }
        } catch (error) {
            console.log('Server failed, trying cache:', error.message);
        }
    }

    // Try details cache
    const cachedDetails = await getCachedPlantDetails(plantId);
    if (cachedDetails) {
        console.log('Loaded from cache:', plantId);
        return cachedDetails.data;
    }

    // Try main plants database
    try {
        const plant = await getPlantFromMainDB(plantId);
        if (plant) {
            console.log('Loaded from main DB:', plantId);
            await cachePlantDetails(plantId, plant);
            return plant;
        }
    } catch (error) {
        console.error('Error loading from main DB:', error);
    }

    throw new Error(`Plant ${plantId} not found`);
}

/**
 * Get plant from main database with better error handling
 */
async function getPlantFromMainDB(plantId) {
    // Try using existing function first
    if (typeof getAllPlantsFromIDB === 'function') {
        try {
            const allPlants = await getAllPlantsFromIDB();
            const plant = allPlants.find(p => p._id === plantId);
            
            if (plant) {
                console.log('✅ Found in main DB:', plantId);
                return plant;
            }
        } catch (error) {
            console.error('Error getting from getAllPlantsFromIDB:', error);
        }
    }
    
    // Fallback: try direct IndexedDB access
    if (typeof openSyncPlantIDB === 'function') {
        try {
            const db = await openSyncPlantIDB();
            const transaction = db.transaction(['plants'], 'readonly');
            const store = transaction.objectStore('plants');
            const allPlants = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            // Find plant by ID
            for (const item of allPlants) {
                const plant = item.value || item;
                if (plant._id === plantId) {
                    console.log('✅ Found via direct DB access:', plantId);
                    return plant;
                }
            }
        } catch (error) {
            console.error('Error in fallback DB access:', error);
        }
    }
    
    return null;
}

/**
 * Load offline plant data with better UI updates
 */
async function loadOfflinePlantData(plantId) {
    try {
        console.log('Loading offline plant:', plantId);
        
        const offlinePlant = await getPlantFromMainDB(plantId);
        
        if (!offlinePlant) {
            console.error('❌ Offline plant not found:', plantId);
            showOfflinePlantError();
            return;
        }
        
        console.log('✅ Offline plant data:', offlinePlant);
        
        // Update UI with plant data
        updatePlantUI(offlinePlant);
        
        // Show offline indicator
        showOfflineIndicator();
        
    } catch (error) {
        console.error('❌ Error loading offline plant:', error);
        showOfflinePlantError();
    }
}

/**
 * Update page UI with plant data
 */
function updatePlantUI(plant) {
    // Format plant name
    if (plant.plantName) {
        const formattedName = plant.plantName.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        
        document.title = `${formattedName} - Plant Details`;
        
        const nameElements = document.querySelectorAll('[data-plant-name]');
        nameElements.forEach(el => el.textContent = formattedName);
    }
    
    // Update other fields
    if (plant.type) {
        const typeElements = document.querySelectorAll('[data-plant-type]');
        typeElements.forEach(el => el.textContent = plant.type);
    }
    
    if (plant.description) {
        const descElements = document.querySelectorAll('[data-plant-description]');
        descElements.forEach(el => el.textContent = plant.description);
    }
    
    if (plant.nickname) {
        const nicknameElements = document.querySelectorAll('[data-plant-nickname]');
        nicknameElements.forEach(el => el.textContent = plant.nickname);
    }
    
    if (plant.createdAt || plant.dateAdded) {
        const dateElements = document.querySelectorAll('[data-plant-date]');
        const date = new Date(plant.createdAt || plant.dateAdded);
        const formatted = date.toLocaleDateString();
        dateElements.forEach(el => el.textContent = formatted);
    }
}

/**
 * Show offline plant indicator
 */
function showOfflineIndicator() {
    const indicator = document.querySelector('.offline-plant-indicator');
    if (indicator) {
        indicator.style.display = 'block';
        indicator.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-wifi-slash"></i>
                This plant was created offline and will sync when you're back online.
            </div>
        `;
    }
}

/**
 * Show error for offline plant not found
 */
function showOfflinePlantError() {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>This offline plant could not be loaded. It may have been corrupted or deleted.</span>
    `;
    document.body.insertBefore(errorDiv, document.body.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => errorDiv.remove(), 5000);
}

/**
 * Initialize plant details system
 */
async function initPlantDetailsSystem() {
    try {
        await initPlantDetailsDB();
        
        // Check if this is an offline plant
        if (typeof plantID !== 'undefined' && plantID && plantID.startsWith('offline_')) {
            console.log('Detected offline plant:', plantID);
            await loadOfflinePlantData(plantID);
        }
        
        // Set up online/offline listeners
        window.addEventListener('online', async () => {
            console.log('Back online! Syncing charts...');
            await syncAllChartsToServer();
        });
        
        window.addEventListener('offline', () => {
            console.log('Offline mode - charts will sync later');
        });
        
        console.log('Plant details system initialized');
    } catch (error) {
        console.error('Init error:', error);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initPlantDetailsSystem);

