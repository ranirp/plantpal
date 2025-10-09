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
*/
const deleteSyncPlantFromIDB = (plantDB, id) => {
    const transaction = plantDB.transaction([SYNC_PLANT_STORE_NAME], 'readwrite');
    const plantStore = transaction.objectStore(SYNC_PLANT_STORE_NAME);
    const deleteRequest = plantStore.delete(id);

    deleteRequest.addEventListener('success', () => {
        console.log(`Deleted plant with ID ${id} from IndexedDB.`);
    });

    deleteRequest.addEventListener('error', (event) => {
        console.error('Error deleting plant from IndexedDB:', event.target.error);
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

        request.onerror = function(event) {
            const db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            db.createObjectStore(SYNC_PLANT_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        };
    });
};
