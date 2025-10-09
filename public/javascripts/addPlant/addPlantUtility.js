// Constants for IndexedDB database and object store names
const PLANT_DB_NAME = 'plant';
const PLANT_DETAILS_STORE_NAME = 'plantDetails';
const SYNC_PLANT_STORE_NAME = 'plants';
const SYNC_PLANT_EVENT = 'plant';
const SYNC_PLANT_DB = 'plantDB';

/**
 * Function to add a new plant to the IndexedDB for synced plants.
 * @param {IDBDatabase} plantDB - IndexedDB instance for synced plants.
 * @param {Object} plantDetails - Details of the plant to be added.
 * @returns {Promise} - Promise resolving to the added plant details.
 */
const addNewPlantToSync = (plantDB, plantDetails) => {
    return new Promise((resolve, reject) => {
        const transaction = plantDB.transaction([SYNC_PLANT_STORE_NAME], 'readwrite');
        const plantStore = transaction.objectStore(SYNC_PLANT_STORE_NAME);
        const addRequest = plantStore.add({ value: plantDetails });
        addRequest.addEventListener('success', () => {
            console.log("Added " + "#" + addRequest.result + ": " + plantDetails);
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
    });
};

/**
 * Function to retrieve all plants stored for sync from IndexedDB.
 * @param {IDBDatabase} plantDB - IndexedDB instance for synced plants.
 * @returns {Promise} - Promise resolving to an array of synced plant details.
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
                // Remove internal flags when returning plants for display
                const cleanPlant = { ...plant };
                delete cleanPlant.__isServerPlant;
                return cleanPlant;
            });
            resolve(plants);
        } catch (error) {
            console.error('Error getting plants from IndexedDB:', error);
            resolve([]); // Return empty array on error
        }
    });
};
