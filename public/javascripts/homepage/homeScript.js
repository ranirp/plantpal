// Store the list of plants
let plantLists = []; // Variable to store the list of plants
let currentFilter = 'all'; // Current filter type
let currentSort = 'date'; // Current sort method

// Function to navigate to the plant details page
function showDetailsPage(id) {
    window.location.href = "/plantDetails/" + id + "/" + loggedInUser;
}

// Function to navigate to add plant page
function openAddPlantPage() {
    window.location.href = "/addPlant";
}

// Function to initialize the application
async function init() {
    console.log("🚀 Init function called");
    checkIfUserLoggedIn(); // Check if user is logged in

    if ("serviceWorker" in navigator) {
        // Register the service worker for offline functionality
        navigator.serviceWorker.register("/serviceWorker.js", {
            scope: "/",
        });
    }

    if (navigator.onLine) {
        // Check if there are any plants that need to be sunced and update them
        const isTherePlantsToSync = await checkIfThereIsSyncPlantAndUpdate();
        if (isTherePlantsToSync) {
            getPlantsFromServer(); // Fetch latest plants from server after sync
        } else {
            getPlantsFromIDB(); // No sync needed, fetch from IndexedDB
        }

        listenForOnlineSync(); // Listen for online event to sync plants
    }

    // Function to check for offline-synced plants and update them
    async function checkIfThereIsSyncPlantAndUpdate() {
        return new Promise(async (resolve, reject) => {
            let isTherePlantsToSync = false;
            try {
                const plantDB = await getPlantsFromIDB();
                plants.forEach((plant) => {
                    // Check if plants are offline-synced 
                    if (!plant._id) {
                        if (navigator.onLine) {
                            addPlantToMongoDB(plant);
                            isTherePlantsToSync = true;
                        }
                    }
                });
                resolve(isTherePlantsToSync);
            } catch (error) {
                console.error("Error checking for sync plants:", error);
                resolve(error); 
            }
        });
    }
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
                
                // Instead of deleting, mark the plant as synced and get the server response
                if (plantId) {
                    try {
                        const responseData = await response.json();
                        const serverId = responseData._id || responseData.id;
                        
                        if (serverId) {
                            // Update the plant in IndexedDB with server ID and sync status
                            const db = await openSyncPlantIDB();
                            const updatedPlant = {
                                ...plantDetails,
                                _id: serverId,
                                __isServerPlant: true,
                                __syncStatus: 'synced',
                                __lastSyncTime: Date.now()
                            };
                            
                            // Delete the old offline entry and add the synced version
                            await deleteSyncPlantFromIDB(db, plantId);
                            await addNewPlantToSync(db, updatedPlant);
                            console.log("Successfully updated plant sync status in IndexedDB");
                        }
                        
                        resolve();
                    } catch (error) {
                        console.error("Error updating plant sync status:", error);
                        resolve(); // Still resolve to continue with other operations
                    }
                } else {
                    console.log("No plantId provided, skipping IndexedDB update");
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
        console.log("Plant types in IndexedDB:", plantLists.map(p => ({
            name: p.plantName,
            hasId: !!p._id,
            isServerPlant: !!p.__isServerPlant,
            source: p._id ? 'server' : 'offline'
        })));
        applyFilterAndSort(); // Apply current filter and sort
    } catch (error) {
        console.error("Error fetching plants from IndexedDB:", error);
        plantLists = [];
        applyFilterAndSort();
    }
}

// Function to add all plants to IndexedDB (PWA caching approach)
async function addAllPlantsToIDB(plants) {
    console.log("Updating IndexedDB cache with server plants:", plants.length, "plants");
    try {
        const db = await openSyncPlantIDB();
        
        // Instead of clearing all data, we'll merge server data with local cache
        console.log("Merging server plants with local IndexedDB cache...");
        
        // Get existing plants to avoid duplicates
        const existingPlants = await getAllSyncPlants(db);
        const existingServerPlantIds = new Set(
            existingPlants
                .filter(item => (item.value || item).__isServerPlant && (item.value || item)._id)
                .map(item => (item.value || item)._id)
        );
        
        // Add or update server plants
        const addPromises = plants.map((plant) => {
            const serverPlant = { 
                ...plant, 
                __isServerPlant: true,
                __syncStatus: 'synced',
                __lastSyncTime: Date.now()
            };
            
            // If plant already exists in cache, we might want to update it
            return addNewPlantToSync(db, serverPlant);
        });
        
        await Promise.all(addPromises);
        console.log(`Successfully cached ${plants.length} server plants to IndexedDB`);
        
        // Log cache statistics
        const updatedPlants = await getAllSyncPlants(db);
        const cacheStats = {
            total: updatedPlants.length,
            serverPlants: updatedPlants.filter(item => (item.value || item).__isServerPlant).length,
            offlinePlants: updatedPlants.filter(item => !(item.value || item).__isServerPlant && !(item.value || item)._id).length,
            syncedPlants: updatedPlants.filter(item => (item.value || item).__syncStatus === 'synced').length,
            pendingSync: updatedPlants.filter(item => (item.value || item).__syncStatus === 'pending').length
        };
        console.log("IndexedDB Cache Statistics:", cacheStats);
        
    } catch (error) {
        console.error("Error updating IndexedDB cache:", error);
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
        console.log("Navigator reports online, checking server connectivity...");
        const actuallyOnline = await checkServerConnectivity();
        
        if (actuallyOnline) {
            console.log("Device came online, syncing plants...");
            const isTherePlantsToSync = await checkIfThereIsSyncPlantAndUpdate();
            
            // Always fetch latest plants from server after sync (or if no sync needed)
            setTimeout(() => {
                getPlantsFromServer();
            }, isTherePlantsToSync ? 1000 : 0); // Wait 1 second if we synced plants
        } else {
            console.log("Navigator reports online but server is not reachable");
        }
    });
}