var loggedInUser;

function logout() {
    // In a PWA, we only clear user data, not plant cache
    return deleteAllUsers().then(() => {
        loggedInUser = null;
        onUserLoggedOut();
    }).catch(error => {
        console.error("Error during logout:", error);
        loggedInUser = null;
        onUserLoggedOut();
    });
}

// Function to clear all plants from IndexedDB
function clearAllPlantsFromIndexedDB() {
    return new Promise((resolve, reject) => {
        // Check if the function exists (it should be loaded from addPlantUtility.js)
        if (typeof openSyncPlantIDB === 'function' && typeof deleteAllSyncPlantsFromIDB === 'function') {
            openSyncPlantIDB()
                .then(db => deleteAllSyncPlantsFromIDB(db))
                .then(() => {
                    console.log("Successfully cleared all plants from IndexedDB during logout");
                    resolve();
                })
                .catch(error => {
                    console.error("Error clearing plants from IndexedDB during logout:", error);
                    resolve(); // Still resolve to continue logout process
                });
        } else {
            console.log("Plant IndexedDB functions not available, skipping plant data cleanup");
            resolve();
        }
    });
}

function logInUser() {
    var loginInTextField = document.getElementById("userName");
    var userName = loginInTextField.value;
    loginInTextField.value = "";
    return addUserToIDB(userName).then(() => {
        loggedInUser = userName;
        onUserLoggedIn();
    });
}

function checkIfUserLoggedIn() {
    return new Promise((resolve, reject) => {
        initializeUserIDB()
            .then((db) => {
                getUserName(db)
                    .then((userName) => {
                        if (userName && userName.value) {
                            loggedInUser = userName.value;
                            onUserLoggedIn();
                            resolve(userName);
                        } else {
                            console.log("No user found in IndexedDB, showing login modal");
                            onUserLoggedOut();
                            resolve(null);
                        }
                    })
                    .catch((error) => {
                        console.error("Error getting username:", error);
                        onUserLoggedOut();
                        reject(error);
                    });
                })
            .catch((error) => {
                console.error("Error initializing user IDB:", error);
                onUserLoggedOut();
                reject(error);
            });
    });
}
