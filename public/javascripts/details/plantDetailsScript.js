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

const PLANT_DETAILS_DB_NAME = 'PlantDetailsDB';
const PLANT_DETAILS_DB_VERSION = 1;

let plantDetailsDB = null;

/**
 * Initialize IndexedDB for plant details and chart data.
 * Creates object stores for charts and plant details cache.
 * 
 * @returns {Promise<IDBDatabase>} Opened database instance
 */
async function initPlantDetailsDB() {
    return new Promise((resolve, reject) => {
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
            
            // Create charts store if it doesn't exist
            if (!db.objectStoreNames.contains('charts')) {
                const chartsStore = db.createObjectStore('charts', { 
                    keyPath: 'plantId' 
                });
                chartsStore.createIndex('plantId', 'plantId', { unique: true });
                chartsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                console.log('Charts object store created');
            }
            
            // Create plant details cache store if it doesn't exist
            if (!db.objectStoreNames.contains('plantDetailsCache')) {
                const detailsStore = db.createObjectStore('plantDetailsCache', { 
                    keyPath: 'plantId' 
                });
                detailsStore.createIndex('plantId', 'plantId', { unique: true });
                detailsStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
                console.log('Plant details cache object store created');
            }
        };
    });
}

/**
 * Save chart data to IndexedDB
 */
async function saveChartToIDB(plantId, chartData) {
    if (!plantDetailsDB) {
        await initPlantDetailsDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = plantDetailsDB.transaction(['charts'], 'readwrite');
        const store = transaction.objectStore('charts');
        
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
            console.error('Error saving chart data to IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get chart data from IndexedDB
 */
async function getChartFromIDB(plantId) {
    if (!plantDetailsDB) {
        await initPlantDetailsDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = plantDetailsDB.transaction(['charts'], 'readonly');
        const store = transaction.objectStore('charts');
        const request = store.get(plantId);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error('Error getting chart data from IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Cache plant details in IndexedDB
 */
async function cachePlantDetails(plantId, plantData) {
    if (!plantDetailsDB) {
        await initPlantDetailsDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = plantDetailsDB.transaction(['plantDetailsCache'], 'readwrite');
        const store = transaction.objectStore('plantDetailsCache');
        
        const detailsRecord = {
            plantId: plantId,
            data: plantData,
            lastAccessed: new Date().toISOString()
        };
        
        const request = store.put(detailsRecord);
        
        request.onsuccess = () => {
            console.log('Plant details cached for plant:', plantId);
            resolve(detailsRecord);
        };
        
        request.onerror = () => {
            console.error('Error caching plant details:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get cached plant details from IndexedDB
 */
async function getCachedPlantDetails(plantId) {
    if (!plantDetailsDB) {
        await initPlantDetailsDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = plantDetailsDB.transaction(['plantDetailsCache'], 'readonly');
        const store = transaction.objectStore('plantDetailsCache');
        const request = store.get(plantId);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error('Error getting cached plant details:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Sync chart data to MongoDB when online
 */
async function syncChartToServer(plantId, chartData) {
    if (!navigator.onLine) {
        console.log('Offline: Chart data will be synced when online');
        return false;
    }
    
    try {
        const response = await fetch(`/api/plants/${plantId}/chart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(chartData)
        });
        
        if (response.ok) {
            console.log('Chart data synced to server for plant:', plantId);
            
            // Update the chart record to mark it as synced
            await saveChartToIDB(plantId, {
                ...chartData,
                syncedToServer: true
            });
            
            return true;
        } else {
            console.error('Failed to sync chart data to server:', response.statusText);
            return false;
        }
    } catch (error) {
        console.error('Error syncing chart data to server:', error);
        return false;
    }
}

/**
 * Sync all unsynced charts when coming back online
 */
async function syncAllChartsToServer() {
    if (!navigator.onLine || !plantDetailsDB) {
        return;
    }
    
    return new Promise((resolve, reject) => {
        const transaction = plantDetailsDB.transaction(['charts'], 'readonly');
        const store = transaction.objectStore('charts');
        const request = store.getAll();
        
        request.onsuccess = async () => {
            const allCharts = request.result;
            const unsyncedCharts = allCharts.filter(chart => !chart.syncedToServer);
            
            console.log(`Found ${unsyncedCharts.length} unsynced charts to upload`);
            
            const syncPromises = unsyncedCharts.map(chart => 
                syncChartToServer(chart.plantId, chart.data)
            );
            
            try {
                await Promise.all(syncPromises);
                console.log('All charts synced to server');
                resolve();
            } catch (error) {
                console.error('Error syncing charts to server:', error);
                reject(error);
            }
        };
        
        request.onerror = () => {
            console.error('Error getting charts for sync:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Load plant details - tries server first, falls back to IndexedDB if offline
 */
async function loadPlantDetails(plantId) {
    // First try to get from server if online
    if (navigator.onLine) {
        try {
            const response = await fetch(`/api/plants/${plantId}`);
            if (response.ok) {
                const plantData = await response.json();
                // Cache the plant details
                await cachePlantDetails(plantId, plantData);
                console.log('Plant details loaded from server:', plantId);
                return plantData;
            }
        } catch (error) {
            console.log('Server request failed, falling back to cache:', error);
        }
    }
    
    // If server fails or offline, try IndexedDB cache
    const cachedDetails = await getCachedPlantDetails(plantId);
    if (cachedDetails) {
        console.log('Plant details loaded from cache:', plantId);
        return cachedDetails.data;
    }
    
    // If not in cache, try to get from main plants database
    try {
        const plant = await getPlantFromMainDB(plantId);
        if (plant) {
            console.log('Plant details loaded from main plants database:', plantId);
            // Cache it for future use
            await cachePlantDetails(plantId, plant);
            return plant;
        }
    } catch (error) {
        console.error('Error loading from main plants database:', error);
    }
    
    throw new Error('Plant details not found');
}

/**
 * Get plant from main plants database (from addPlantUtility.js)
 */
async function getPlantFromMainDB(plantId) {
    // Use the existing function from addPlantUtility.js if available
    if (typeof getAllPlantsFromIDB === 'function') {
        const allPlants = await getAllPlantsFromIDB();
        return allPlants.find(plant => plant._id === plantId);
    }
    
    // Fallback implementation
    if (!plantsDB) {
        await initDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = plantsDB.transaction(['plants'], 'readonly');
        const store = transaction.objectStore('plants');
        const request = store.get(plantId);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Initialize plant details system
 */
async function initPlantDetailsSystem() {
    try {
        await initPlantDetailsDB();
        
        // Check if this is an offline plant that needs to be loaded
        if (typeof plantID !== 'undefined' && plantID && plantID.startsWith('offline_')) {
            console.log('Loading offline plant data for ID:', plantID);
            await loadOfflinePlantData(plantID);
        }
        
        // Set up online/offline event listeners
        window.addEventListener('online', async () => {
            console.log('Back online! Syncing chart data...');
            await syncAllChartsToServer();
        });
        
        window.addEventListener('offline', () => {
            console.log('Gone offline. Chart data will be stored locally.');
        });
        
        console.log('Plant details system initialized');
    } catch (error) {
        console.error('Error initializing plant details system:', error);
    }
}

/**
 * Load offline plant data and update the page
 */
async function loadOfflinePlantData(plantId) {
    try {
        const offlinePlant = await getPlantFromMainDB(plantId);
        
        if (offlinePlant) {
            console.log('Loaded offline plant:', offlinePlant);
            
            // Update the page title
            if (offlinePlant.plantName) {
                document.title = `${offlinePlant.plantName} - Plant Details`;
                
                // Update any plant name elements on the page
                const plantNameElements = document.querySelectorAll('[data-plant-name]');
                plantNameElements.forEach(el => {
                    el.textContent = offlinePlant.plantName;
                });
            }
            
            // Update other plant details if elements exist
            if (offlinePlant.type) {
                const typeElements = document.querySelectorAll('[data-plant-type]');
                typeElements.forEach(el => {
                    el.textContent = offlinePlant.type;
                });
            }
            
            if (offlinePlant.description) {
                const descElements = document.querySelectorAll('[data-plant-description]');
                descElements.forEach(el => {
                    el.textContent = offlinePlant.description;
                });
            }
            
            if (offlinePlant.nickname) {
                const nicknameElements = document.querySelectorAll('[data-plant-nickname]');
                nicknameElements.forEach(el => {
                    el.textContent = offlinePlant.nickname;
                });
            }
            
            // Show offline indicator
            const offlineIndicator = document.querySelector('.offline-plant-indicator');
            if (offlineIndicator) {
                offlineIndicator.style.display = 'block';
            }
            
        } else {
            console.error('Offline plant not found in IndexedDB:', plantId);
            // Show error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-error';
            errorDiv.textContent = 'This offline plant could not be loaded. It may have been corrupted or deleted.';
            document.body.insertBefore(errorDiv, document.body.firstChild);
        }
    } catch (error) {
        console.error('Error loading offline plant data:', error);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initPlantDetailsSystem);