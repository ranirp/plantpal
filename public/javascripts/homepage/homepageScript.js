// Store the list of plants
let plantLists = []; // Variable to store the list of plants
let currentFilter = 'all'; // Current filter type
let currentSort = 'date'; // Current sort method

// Update the UI counter that shows number of items queued for sync
async function updateQueueCounter() {
    try {
        const syncDB = await openSyncPlantIDB();
        const syncPlants = await getAllSyncPlants(syncDB) || [];
        const counter = document.getElementById('queue_counter');
        if (counter && syncPlants.length > 0) {
            counter.textContent = syncPlants.length;
            counter.classList.remove('hidden');
        } else if (counter) {
            counter.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error updating queue counter:', error);
    }
}

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
        // Check if there are any plants that need to be synced and update them
        const isTherePlantsToSync = await checkIfThereIsSyncPlantAndUpdate();
        if (isTherePlantsToSync) {
            getPlantsFromServer(); // Fetch latest plants from server after sync
        } else {
            getPlantsFromIDB(); // No sync needed, fetch from IndexedDB
        }

        listenForOnlineSync(); // Listen for online event to sync plants
    }

    // Update queue counter on init (handles offline cached items)
    await updateQueueCounter();
    // Function to check for offline-synced plants and update them is defined at top-level
}    

// Function to check for offline-synced plants and update them (top-level so other handlers can call it)
async function checkIfThereIsSyncPlantAndUpdate() {
    return new Promise(async (resolve) => {
        let isTherePlantsToSync = false;
        try {
            // Open the raw sync DB so we can access numeric keys (id)
            const db = await openSyncPlantIDB();
            const syncEntries = await getAllSyncPlants(db);

            // syncEntries are objects from the store and look like { id, value }
            for (const entry of syncEntries) {
                const plant = entry.value || entry;
                const localId = entry.id;

                if (!plant._id) {
                    if (navigator.onLine) {
                        // pass the local store id so it can be updated in-place after sync
                        await addPlantToMongoDB(plant, localId);
                        isTherePlantsToSync = true;
                    }
                }
            }

            resolve(isTherePlantsToSync);
        } catch (error) {
            console.error("Error checking for sync plants:", error);
            resolve(false);
        }
    });
}

// Manual sync triggered by the UI sync button
async function manualSync() {
    const syncButton = document.getElementById('sync_button');
    if (!syncButton) {
        console.warn('Sync button not found');
        return;
    }

    try {
        syncButton.disabled = true;
        syncButton.classList.add('loading');

        // First, push any locally queued plants to server
        const didSync = await checkIfThereIsSyncPlantAndUpdate();

        // Then fetch latest plants from network and update UI / cache
        const networkPlants = await getPlantsFromNetwork();
        if (networkPlants && networkPlants.length) {
            // If getPlantsFromNetwork returns data, merge into UI and idb
            plantLists = networkPlants;
            applyFilterAndSort();
            try { await addAllPlantsToIDB(networkPlants); } catch (e) { console.error('addAllPlantsToIDB error:', e); }
        } else {
            // Fallback to server full list if the incremental fetch returned nothing
            try { await getPlantsFromServer(); } catch (e) { console.error('getPlantsFromServer error during manualSync fallback:', e); }
        }

        // Update queue counter after sync
        try { await updateQueueCounter(); } catch (e) { console.error('updateQueueCounter error:', e); }

        alert('Sync completed successfully!');
    } catch (error) {
        console.error('Sync failed:', error);
        alert('Sync failed. Please try again.');
    } finally {
        syncButton.disabled = false;
        syncButton.classList.remove('loading');
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

        if (plantDetails.photo && plantDetails.photo instanceof File) {
            formData.append("photo", plantDetails.photo);
        } else if (plantDetails.photo && typeof plantDetails.photo === 'object' && plantDetails.photo.name) {
            console.log("Offline plant has photo metadata but actual file not available for sync:", plantDetails.photo);
        } else if (typeof plantDetails.photo === 'string') {
            formData.append("photo", plantDetails.photo);
        }

        fetch("/api/plants/addNewPlant", {
            method: "POST",
            body: formData
        })
        .then(async response => {
            if (!response.ok) {
                console.error("Error syncing plant to server, status:", response.status);
                reject(new Error(`Server error: ${response.status}`));
                return;
            }

            let responseData = null;
            try { responseData = await response.json(); } catch (e) { /* ignore parse errors */ }
            const serverId = responseData && (responseData._id || responseData.id) ? (responseData._id || responseData.id) : null;
            console.log("Synced plant to server successfully, serverId:", serverId);

            if (plantId) {
                try {
                    const db = await openSyncPlantIDB();
                    const transaction = db.transaction(['plants'], 'readwrite');
                    const store = transaction.objectStore('plants');
                    const getReq = store.get(plantId);

                    getReq.addEventListener('success', async () => {
                        const record = getReq.result;
                        if (!record) {
                            console.warn('Local sync record not found for id', plantId);
                            resolve();
                            return;
                        }

                        const existingPlant = record.value || record;
                        const updatedValue = {
                            ...existingPlant,
                            _id: serverId || existingPlant._id,
                            __isServerPlant: true,
                            __syncStatus: serverId ? 'synced' : 'pending',
                            __lastSyncTime: Date.now()
                        };

                        const putReq = store.put({ id: plantId, value: updatedValue });
                        putReq.addEventListener('success', async () => {
                            console.log('Updated local IndexedDB record with server _id for id', plantId);
                            try { await updateQueueCounter(); } catch (e) { console.error('updateQueueCounter error:', e); }
                            resolve();
                        });

                        putReq.addEventListener('error', (ev) => {
                            console.error('Error updating local record after sync:', ev.target.error);
                            resolve();
                        });
                    });

                    getReq.addEventListener('error', (ev) => {
                        console.error('Error reading local record before updating:', ev.target.error);
                        resolve();
                    });
                } catch (error) {
                    console.error("Error updating plant sync status in IndexedDB:", error);
                    resolve();
                }
            } else {
                console.log("No local plantId provided, skipping IndexedDB update");
                resolve();
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

// Helper: fetch plants from network optionally using a last-sync timestamp
async function getPlantsFromNetwork() {
    try {
        // Attempt to read the last sync timestamp
        const lastSync = typeof getLastSync === 'function' ? await getLastSync() : null;

        const url = lastSync ? `/api/plants?since=${encodeURIComponent(lastSync)}` : '/api/plants';

        const response = await fetch(url);
        if (!response.ok) {
            console.error('Failed to fetch plants from network, status:', response.status);
            return null;
        }

        const data = await response.json();

        // Expect the server to return { success, plants } or an array
        const plants = Array.isArray(data) ? data : (data.plants || []);

        // Do any processing needed here (e.g., merge into UI, update IDB)
        console.log('Plants fetched from network (since:', lastSync, '):', plants.length);

        // On success, update lastSync timestamp
        if (typeof saveLastSync === 'function') {
            try { await saveLastSync(); } catch (e) { console.error('saveLastSync error:', e); }
        }

        return plants;
    } catch (error) {
        console.error('Error in getPlantsFromNetwork:', error);
        return null;
    }
}

// Export for other modules or attach to window for inline usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getPlantsFromNetwork };
} else {
    window.getPlantsFromNetwork = getPlantsFromNetwork;
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
    // Refresh queue counter after updating cache
    try { await updateQueueCounter(); } catch (e) { console.error('updateQueueCounter error:', e); }
        
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
