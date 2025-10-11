const USER_STORE_NAME = 'users';
const USER_IDB_NAME = 'userIDB';

function initializeUserIDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(USER_IDB_NAME, 1);

        request.onerror = function (event) {
            reject(new Error(`Database error: ${event.target}`));
        };

        request.onupgradeneeded = function (event) {
            const db = event.target.result;
                db.createObjectStore(USER_STORE_NAME, { 
                    keyPath: 'id',
                    autoIncrement: true,
                });
        };

        request.onsuccess = function (event) {
            const db = event.target.result;
            console.log("Database initialized successfully");
            resolve(db);
        };
    });
}

function deleteAllUsers() {
    return new Promise((resolve, reject) => {
        initializeUserIDB()
            .then((db) => {
                const transaction = db.transaction([USER_STORE_NAME], 'readwrite');
                const objectStore = transaction.objectStore(USER_STORE_NAME);
                const request = objectStore.clear();

                request.onsuccess = function (event) {
                    console.log("All users deleted successfully");
                    resolve();
                };

                request.onerror = function (event) {
                    console.error("Error deleting users:", event.target.error);
                    reject(event.target.error);
                };
            })
            .catch((error) => {
                reject(error);
            });
    });
}

function addUserToIDB(userName) {
    return new Promise((resolve, reject) => {
        initializeUserIDB()
            .then((db) => {
                const transaction = db.transaction([USER_STORE_NAME], 'readwrite');
                const userStore = transaction.objectStore(USER_STORE_NAME);
                const addRequest = userStore.add({ value: userName });
                addRequest.addEventListener('success', () => {
                    console.log("Added" + "#" + addRequest.result + ": " + userName);
                    const getRequest = userStore.get(addRequest.result);
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
            })
            .catch((error) => {
                reject(error);
            });
    });
}

function getUserName() {
    return new Promise((resolve, reject) => {
        initializeUserIDB()
            .then((db) => {
                const transaction = db.transaction([USER_STORE_NAME], 'readonly');
                const objectStore = transaction.objectStore(USER_STORE_NAME);
                const request = objectStore.getAll();
                request.onsuccess = function (event) {
                    const users = event.target.result;
                    // Return null if no users exist, otherwise return the last user
                    const userName = users && users.length > 0 ? users[users.length - 1] : null;
                    console.log("User name:", userName);
                    resolve(userName);
                };
                request.onerror = function (event) {
                    console.error("Error retrieving user name:", event.target.error);
                    reject(event.target.error);
                };
            })
            .catch((error) => {
                reject(error);
            });
    });
}

// Persist a lastSync ISO timestamp in the users store using a reserved id key
function saveLastSync() {
    return new Promise((resolve, reject) => {
        initializeUserIDB()
            .then((db) => {
                const transaction = db.transaction([USER_STORE_NAME], "readwrite");
                const store = transaction.objectStore(USER_STORE_NAME);
                // Use a string key so it does not collide with numeric autoIncrement ids
                const request = store.put({ id: 'lastSync', value: new Date().toISOString() });
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            })
            .catch((err) => reject(err));
    });
}

// Retrieve the lastSync ISO timestamp (string) or undefined/null if not set
function getLastSync() {
    return new Promise((resolve, reject) => {
        initializeUserIDB()
            .then((db) => {
                const transaction = db.transaction([USER_STORE_NAME], 'readonly');
                const store = transaction.objectStore(USER_STORE_NAME);
                const request = store.get('lastSync');
                request.onsuccess = () => resolve(request.result?.value);
                request.onerror = (e) => reject(e.target.error);
            })
            .catch((err) => reject(err));
    });
}
