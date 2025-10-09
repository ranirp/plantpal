// Store the list of plants
let plantLists = []; // Variable to store the list of plants
let currentFilter = 'all'; // Current filter type
let currentSort = 'date'; // Current sort method
let isSyncing = false; // Flag to prevent multiple sync operations
let lastSyncTime = 0; // Timestamp of last sync to prevent too frequent syncing

// Function to navigate to the plant details page
function showDetailsPage(id) {
    window.location.href = "/plants/" + id + "?user=" + loggedInUser;
}

// Function to navigate to add plant page
function openAddPlantPage() {
    window.location.href = "/addPlant";
}

// Function to show welcome message with username
function showWelcomeMessage(username) {
    const welcomeElement = document.getElementById('welcome-message');
    if (welcomeElement) {
        const formattedUsername = capitalizeFirstLetter(username);
        welcomeElement.textContent = `Welcome ${formattedUsername}.here!`;
    }
}

// Function to initialize the application
async function init() {
    console.log("Init function called");
    checkIfUserLoggedIn(); // Check if user is logged in

    // Show welcome message if username is available
    if (typeof loggedInUser !== 'undefined' && loggedInUser) {
        showWelcomeMessage(loggedInUser);
    }

    // Set initial filter and sort values to match UI
    const filterSelect = document.getElementById("typeFilter");
    if (filterSelect) {
        currentFilter = filterSelect.value;
    }

    // Set initial sort button as active
    const sortButtons = document.querySelectorAll('.btn-group .btn');
    sortButtons.forEach(btn => {
        if (btn.textContent.toLowerCase().trim() === currentSort.toLowerCase()) {
            btn.classList.add('btn-active');
        }
    });

    if (navigator.onLine) {
        console.log("User is online, syncing offline plants first");
        // First check if there are any plants in IndexedDB to sync and update them
        const hadPlantsToSync = await checkIfThereIsSyncPlantAndUpdate();
        
        // Then fetch plants from server (after a short delay if we synced plants)
        if (hadPlantsToSync) {
            // Give sync operations time to complete before fetching
            setTimeout(() => {
                getPlantsFromServer();
            }, 1000);
        } else {
            getPlantsFromServer();
        }
    } else {
        console.log("User is offline, fetching plants from IndexedDB");
        getPlantsFromIDB(); // Fetch plants from IndexedDB if offline
    }

    listenForOnlineSync(); // Listen for online event to sync data
}

// Function to check for offline-synced and update them to server
async function checkIfThereIsSyncPlantAndUpdate() {
    if (isSyncing) {
        console.log("Sync already in progress, skipping");
        return false;
    }
    
    // Prevent syncing too frequently (minimum 10 seconds between syncs)
    const now = Date.now();
    if (now - lastSyncTime < 10000) {
        console.log("Sync attempted too soon, skipping (minimum 10 seconds between syncs)");
        return false;
    }
    
    return new Promise(async (resolve, reject) => {
        let isTherePlants = false;
        isSyncing = true;
        lastSyncTime = now;
        
        try {
            const db = await openSyncPlantIDB();
            const syncPlants = await getAllSyncPlants(db);
            
            // Only consider plants without _id AND without __isServerPlant flag as offline plants
            const offlinePlants = syncPlants.filter(item => {
                const plant = item.value || item;
                return !plant._id && !plant.__isServerPlant;
            });
            
            console.log(`Found ${offlinePlants.length} offline plants to sync out of ${syncPlants.length} total plants`);
            
            if (offlinePlants.length > 0 && navigator.onLine) {
                let syncPromises = [];
                let syncedPlantIds = []; // Track successfully synced plant IDs
                
                offlinePlants.forEach((plantItem) => {
                    const plant = plantItem.value || plantItem;
                    console.log("Syncing offline plant:", plant.plantName, "with IDB id:", plantItem.id);
                    const syncPromise = addPlantToMongoDB(plant, plantItem.id)
                        .then(() => {
                            syncedPlantIds.push(plantItem.id);
                        })
                        .catch(error => {
                            console.error("Failed to sync plant:", plant.plantName, error);
                        });
                    syncPromises.push(syncPromise);
                });
                
                // Wait for all sync operations to complete
                await Promise.all(syncPromises);
                isTherePlants = true;
                console.log(`Completed syncing ${offlinePlants.length} offline plants. Successfully synced: ${syncedPlantIds.length}`);
            }
            
            isSyncing = false;
            resolve(isTherePlants);
        } catch (error) {
            console.error("Error checking for sync plants:", error);
            isSyncing = false;
            resolve(false);
        }
    });
}

// Function to add a plant to MongoDB
function addPlantToMongoDB(plantDetails, plantId = null) {
    console.log("Syncing plant to server:", plantDetails);
    
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("plantName", plantDetails.plantName);
        formData.append("type", plantDetails.type);
        formData.append("description", plantDetails.description);
        formData.append("nickname", plantDetails.nickname);
        
        // Handle photo - if it's offline metadata, don't include the photo
        if (plantDetails.photo && plantDetails.photo instanceof File) {
            formData.append("photo", plantDetails.photo);
        } else if (plantDetails.photo && typeof plantDetails.photo === 'object' && plantDetails.photo.name) {
            // This is offline photo metadata, we can't sync the actual file
            console.log("Offline plant has photo metadata but actual file not available for sync:", plantDetails.photo);
            // Don't append photo to formData - the plant will be saved without photo
        } else if (typeof plantDetails.photo === 'string') {
            // This shouldn't happen in sync, but handle just in case
            formData.append("photo", plantDetails.photo);
        }

        // POST request to add new plant to server
        fetch("/api/plants/addNewPlant", {
            method: "POST",
            body: formData
        })
        .then(async response => {
            if (response.ok) {
                console.log("Synced plant to server successfully");
                
                // Remove the synced plant from IndexedDB if we have its ID
                if (plantId) {
                    try {
                        const db = await openSyncPlantIDB();
                        await deleteSyncPlantFromIDB(db, plantId);
                        console.log("Successfully removed synced plant from IndexedDB with id:", plantId);
                        resolve();
                    } catch (error) {
                        console.error("Error removing synced plant from IndexedDB:", error);
                        resolve(); // Still resolve to continue with other operations
                    }
                } else {
                    console.log("No plantId provided, skipping IndexedDB deletion");
                    resolve();
                }
            } else {
                console.error("Error syncing plant to server, status:", response.status);
                reject(new Error(`Server error: ${response.status}`));
            }
        })
        .catch(error => {
            console.error("Error syncing plant to server:", error);
            reject(error);
        });
    });
}

// Function to fetch plants from server
async function getPlantsFromServer() {
    try {
        console.log("Fetching plants from server...");
        const response = await fetch("/api/plants/getAllPlants?sortBy=createdAt&order=desc");
        if (response.ok) {
            const data = await response.json();
            plantLists = data.plants || data; // Handle both array and object responses
            console.log("Plants fetched from server:", plantLists);
            console.log("Number of plants:", plantLists.length);
            applyFilterAndSort(); // Apply current filter and sort
            addAllPlantsToIDB(plantLists); // Update IndexedDB with latest plants
        } else {
            console.error("Failed to fetch plants. Status:", response.status);
            throw new Error("Failed to fetch plants from server");
        }
    } catch (error) {
        console.error("Error fetching plants from server:", error.message);
        renderPlantList([]); // Render empty list on error
    }
}

// Function to fetch plants from IndexedDB
async function getPlantsFromIDB() {
    console.log("Fetching plants from IndexedDB...");
    try {
        plantLists = await getAllPlantsFromIDB();
        console.log("Plants from IndexedDB:", plantLists);
        applyFilterAndSort(); // Apply current filter and sort
    } catch (error) {
        console.error("Error fetching plants from IndexedDB:", error);
        plantLists = [];
        applyFilterAndSort();
    }
}

// Function to add all plants to IndexedDB
async function addAllPlantsToIDB(plants) {
    console.log("Saving plants to IndexedDB:", plants.length, "plants");
    try {
        const db = await openSyncPlantIDB();
        
        // Clear all existing plants - offline plants should already have been synced and deleted
        console.log("Clearing all existing plants from IndexedDB...");
        await deleteAllSyncPlantsFromIDB(db);
        console.log("Successfully cleared all existing plants from IndexedDB");
        
        // Add all server plants (these have _id) and mark them as server plants
        const addPromises = plants.map((plant) => {
            const serverPlant = { ...plant, __isServerPlant: true };
            return addNewPlantToSync(db, serverPlant);
        });
        
        await Promise.all(addPromises);
        console.log(`Successfully added ${plants.length} server plants to IndexedDB`);
    } catch (error) {
        console.error("Error saving plants to IndexedDB:", error);
    }
}

// Function to filter plants by type
function filterByType() {
    const filterSelect = document.getElementById("typeFilter");
    currentFilter = filterSelect.value;
    applyFilterAndSort();
}

// Function to sort plant list
function sortList(sortType) {
    currentSort = sortType;
    
    // Update button styles to show active sort
    const sortButtons = document.querySelectorAll('.btn-group .btn');
    sortButtons.forEach(btn => {
        btn.classList.remove('btn-active');
    });
    
    // Find and activate the clicked button
    const activeButton = Array.from(sortButtons).find(btn => 
        btn.textContent.toLowerCase().trim() === sortType.toLowerCase()
    );
    if (activeButton) {
        activeButton.classList.add('btn-active');
    }
    
    applyFilterAndSort();
}

// Backwards compatibility for existing onclick handlers
function sortPlants(sortType) {
    sortList(sortType);
}

// Function to apply both filter and sort
function applyFilterAndSort() {
    console.log("applyFilterAndSort called");
    console.log("plantLists:", plantLists);
    console.log("plantLists length:", plantLists.length);
    console.log("currentFilter:", currentFilter);
    console.log("currentSort:", currentSort);
    
    let filteredPlants = [...plantLists];

    // Apply filter
    if (currentFilter !== 'all') {
        filteredPlants = filteredPlants.filter(plant => {
            const plantType = plant.type ? plant.type.toLowerCase() : '';
            const filterType = currentFilter.toLowerCase();
            console.log(`Comparing plant type '${plantType}' with filter '${filterType}'`);
            return plantType === filterType;
        });
        console.log("After filter:", filteredPlants);
        console.log("Filtered plants count:", filteredPlants.length);
    }

    // Apply sort
    if (currentSort === 'name') {
        filteredPlants.sort((a, b) => {
            const nameA = a.plantName || '';
            const nameB = b.plantName || '';
            return nameA.localeCompare(nameB);
        });
    } else if (currentSort === 'date') {
        filteredPlants.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
            const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
            return dateB - dateA;
        });
    } else if (currentSort === 'type') {
        filteredPlants.sort((a, b) => {
            const typeA = a.type || '';
            const typeB = b.type || '';
            return typeA.localeCompare(typeB);
        });
    }

    console.log("Final filtered plants to render:", filteredPlants);
    console.log("Final plants count:", filteredPlants.length);
    renderPlantList(filteredPlants); // Render the filtered and sorted list
}

// Function to listen for online event to sync plants
function listenForOnlineSync() {
    window.addEventListener('online', async () => {
        console.log("Device came online, syncing plants...");
        const isTherePlantsToSync = await checkIfThereIsSyncPlantAndUpdate();
        
        // Always fetch latest plants from server after sync (or if no sync needed)
        setTimeout(() => {
            getPlantsFromServer();
        }, isTherePlantsToSync ? 1000 : 0); // Wait 1 second if we synced plants
    });
}