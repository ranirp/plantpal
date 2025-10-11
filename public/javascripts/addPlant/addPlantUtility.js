/**
 * @fileoverview IndexedDB utilities for offline plant management.
 * Provides database operations for caching plant data and managing sync queue.
 * Implements two stores: plantDetails (cached from server) and plants (pending upload).
 * 
 * Key Features:
 * - Plant data caching for offline viewing
 * - Sync queue for offline plant submissions
 * - Duplicate detection and prevention
 * - Database version management
 * - Transaction-based operations
 */

const PLANT_IDB_NAME = 'plantIDB';
const PLANT_DETAILS_STORE_NAME = 'plantDetails';
const SYNC_PLANT_STORE_NAME = 'plants';
const SYNC_PLANT_EVENT = 'plant';

/**
 * Add new plant to sync queue store.
 * Checks for duplicates before adding. Updates existing entries if found.
 * 
 * @param {IDBDatabase} plantDB - Opened IndexedDB database instance
 * @param {Object} plantDetails - Plant data to queue for sync
 * @returns {Promise<Object>} Added or updated plant object
 */
const addNewPlantToSync = (plantDB, plantDetails) => {
    return new Promise(async (resolve, reject) => {
        try {
            // First, check if a plant with the same _id already exists 
            if (plantDetails._id && plantDetails.__isServerPlant) {
                const existingPlants = await getAllSyncPlants(plantDB);
                const existingPlant = existingPlants.find(item => {
                    const plant = item.value || item;
                    return plant._id === plantDetails._id;
                });
                
                if (existingPlant) {
                    // Plant already exists - update it instead
                    console.log(`Plant with _id ${plantDetails._id} already exists, updating...`);
                    const transaction = plantDB.transaction([SYNC_PLANT_STORE_NAME], 'readwrite');
                    const plantStore = transaction.objectStore(SYNC_PLANT_STORE_NAME);
                    const updatedPlant = { 
                        id: existingPlant.id, 
                        value: { ...plantDetails, __lastSyncTime: Date.now() } 
                    };
                    const putRequest = plantStore.put(updatedPlant);
                    
                    putRequest.addEventListener('success', () => {
                        console.log(`Updated plant #${existingPlant.id}`);
                        resolve(updatedPlant);
                    });
                    
                    putRequest.addEventListener('error', (event) => {
                        reject(event.target.error);
                    });
                    return;
                }
            }
            
            // Plant doesn't exist, add it
            const transaction = plantDB.transaction([SYNC_PLANT_STORE_NAME], 'readwrite');
            const plantStore = transaction.objectStore(SYNC_PLANT_STORE_NAME);
            const addRequest = plantStore.add({ value: plantDetails });
            
            addRequest.addEventListener('success', () => {
                console.log(`Added plant #${addRequest.result}: ${plantDetails.plantName}`);
                const getRequest = plantStore.get(addRequest.result);
                getRequest.addEventListener('success', () => {
                    resolve(getRequest.result);
                });
                getRequest.addEventListener('error', (event) => {
                    reject(event.target.error);
                });
            });
            
            addRequest.addEventListener('error', (event) => {
                reject(event.target.error);
            });
        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Retrieve all plants from sync queue store.
 * Returns all pending plant submissions that need to be synced with server.
 * 
 * @param {IDBDatabase} plantDB - IndexedDB database connection
 * @returns {Promise<Array<Object>>} Array of queued plant objects
 */
const getAllSyncPlants = (plantDB) => {
    return new Promise((resolve, reject) => {
        const transaction = plantDB.transaction([SYNC_PLANT_STORE_NAME]);
        const plantStore = transaction.objectStore(SYNC_PLANT_STORE_NAME);
        const getAllRequest = plantStore.getAll();

        getAllRequest.addEventListener('success', () => {
            resolve(getAllRequest.result);
        });

        getAllRequest.addEventListener('error', (event) => {
            reject(event.target.error);
        });
    });
};

/**
 * Function to delete a synced plant from IndexedDB.
 * @param {IDBDatabase} plantDB - IndexedDB instance for synced plants.
 * @param {number} id - ID of the plant to be deleted.
 * @returns {Promise} - Promise resolving when the plant is deleted.
*/
const deleteSyncPlantFromIDB = (plantDB, id) => {
    return new Promise((resolve, reject) => {
        const transaction = plantDB.transaction([SYNC_PLANT_STORE_NAME], 'readwrite');
        const plantStore = transaction.objectStore(SYNC_PLANT_STORE_NAME);
        const deleteRequest = plantStore.delete(id);

        deleteRequest.addEventListener('success', () => {
            console.log(`Deleted plant with ID ${id} from IndexedDB.`);
            resolve();
        });

        deleteRequest.addEventListener('error', (event) => {
            console.error('Error deleting plant from IndexedDB:', event.target.error);
            reject(event.target.error);
        });
    });
};

/**
 * Function to delete all synced plants from IndexedDB.
 * @param {IDBDatabase} plantDB - IndexedDB instance for synced plants.
 * @returns {Promise} - Promise resolving when all synced plants are deleted.
*/
const deleteAllSyncPlantsFromIDB = (plantDB) => {
    return new Promise((resolve, reject) => {
        const transaction = plantDB.transaction([SYNC_PLANT_STORE_NAME], 'readwrite');
        const plantStore = transaction.objectStore(SYNC_PLANT_STORE_NAME);
        const clearRequest = plantStore.clear();

        clearRequest.addEventListener('success', () => {
            console.log('Cleared all synced plants from IndexedDB.');
            resolve();
        });

        clearRequest.addEventListener('error', (event) => {
            console.error('Error clearing all synced plants from IndexedDB:', event.target.error);
            reject(event.target.error);
        });
    });
};

/**
 * Function to open (or create) the IndexedDB for synced plants.
 * @returns {Promise} - Promise resolving to the opened IndexedDB instance.
*/
const openSyncPlantIDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(SYNC_PLANT_STORE_NAME, 1);

        request.onsuccess = function(event) {
            const db = event.target.result;
            resolve(db);
        };

        request.onerror = function(event) {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };

        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(SYNC_PLANT_STORE_NAME)) {
                db.createObjectStore(SYNC_PLANT_STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
};

/**
 * Function to get all plants from IndexedDB (wrapper for getAllSyncPlants)
 * @returns {Promise} - Promise resolving to an array of plant objects.
 */
const getAllPlantsFromIDB = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openSyncPlantIDB();
            const syncPlants = await getAllSyncPlants(db);
            const plants = syncPlants.map(item => {
                const plant = item.value || item;
                // Remove internal flags and clean up photo metadata when returning plants for display
                const cleanPlant = { ...plant };
                delete cleanPlant.__isServerPlant;
                delete cleanPlant.__syncStatus;
                delete cleanPlant.__lastSyncTime;
                
                // Ensure all plants have an _id field
                if (!cleanPlant._id) {
                    // Generate a temporary ID for plants that don't have one
                    const timestamp = cleanPlant.createdAt || cleanPlant.dateAdded || Date.now();
                    const nickname = cleanPlant.nickname || 'unknown';
                    const plantName = cleanPlant.plantName || 'unnamed';
                    cleanPlant._id = `offline_${plantName}_${nickname}_${timestamp}`.replace(/[^a-zA-Z0-9_]/g, '_');
                    console.log('Generated temporary ID for plant without _id:', cleanPlant._id);
                }
                
                if (cleanPlant.photo && typeof cleanPlant.photo === 'object' && cleanPlant.photo.name) {
                    if (cleanPlant._id && !cleanPlant._id.startsWith('offline_')) {
                        cleanPlant.photo = null; // Remove photo reference for synced plants 
                    } else {
                        // Keep the metadata for truly offline plants
                        cleanPlant.photo = cleanPlant.photo;
                    }
                }
                
                return cleanPlant;
            });
            resolve(plants);
        } catch (error) {
            console.error('Error getting plants from IndexedDB:', error);
            resolve([]); 
        }
    });
};
