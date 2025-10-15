/**
 * @fileoverview User authentication and session management.
 * Handles user login/logout with IndexedDB storage.
 * Manages user session persistence for PWA offline functionality.
 * 
 * Key Features:
 * - Local user authentication via IndexedDB
 * - Logout with selective data cleanup
 * - User session persistence
 * - Login state verification
 */

/**
 * Callback executed when user successfully logs in.
 * Updates UI to reflect logged-in state.
 */
function onUserLoggedIn() {
    console.log('[User] User logged in:', loggedInUser);
    
    // Update UI elements for logged-in state
    const loginModal = document.getElementById('loginModal');
    const logoutButton = document.getElementById('logoutButton');
    const loginButton = document.getElementById('loginButton');
    
    // Hide login modal if it exists
    if (loginModal && loginModal.close) {
        loginModal.close();
    }
    
    // Show logout button, hide login button
    if (logoutButton) logoutButton.style.display = 'block';
    if (loginButton) loginButton.style.display = 'none';
    
    // Dispatch custom event for other parts of app to listen
    window.dispatchEvent(new CustomEvent('userLoggedIn', { 
        detail: { username: loggedInUser } 
    }));
}

/**
 * Callback executed when user logs out or is not found.
 * Updates UI to reflect logged-out state.
 */
function onUserLoggedOut() {
    console.log('[User] User logged out or not found');
    
    // Update UI elements for logged-out state
    const logoutButton = document.getElementById('logoutButton');
    const loginButton = document.getElementById('loginButton');
    
    // Show login button, hide logout button
    if (logoutButton) logoutButton.style.display = 'none';
    if (loginButton) loginButton.style.display = 'block';
    
    // Dispatch custom event for other parts of app to listen
    window.dispatchEvent(new CustomEvent('userLoggedOut'));
}

/**
 * Log out current user and clear user data.
 * Preserves plant cache for continued offline access.
 * 
 * @returns {Promise<void>}
 */
function logout() {
    return deleteAllUsers().then(() => {
        loggedInUser = null;
        onUserLoggedOut();
    }).catch(error => {
        console.error("Error during logout:", error);
        loggedInUser = null;
        onUserLoggedOut();
    });
}

/**
 * Clear all plants from IndexedDB during logout.
 * Optional cleanup for sync queue - preserves cached plant data.
 * 
 * @returns {Promise<void>}
 */
function clearAllPlantsFromIndexedDB() {
    return new Promise((resolve, reject) => {
        // Check if the function exists 
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

/**
 * Log in user and store in IndexedDB.
 * Clears input field and triggers login callback.
 * 
 * @returns {Promise<void>}
 */
function logInUser() {
    const loginInTextField = document.getElementById("userName");
    const userName = loginInTextField.value;
    loginInTextField.value = "";
    return addUserToIDB(userName).then(() => {
        loggedInUser = userName;
        onUserLoggedIn();
    });
}

/**
 * Check if user is currently logged in via IndexedDB.
 * 
 * @returns {Promise<Object|null>} User object or null if not logged in
 */
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
