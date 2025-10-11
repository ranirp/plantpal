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
    console.log("═══════════════════════════════════════════");
    console.log("🚀 INIT FUNCTION CALLED - STARTING APP");
    console.log("📍 Current URL:", window.location.href);
    console.log("🌐 Navigator online:", navigator.onLine);
    console.log("═══════════════════════════════════════════");
    
    checkIfUserLoggedIn(); // Check if user is logged in

    if ("serviceWorker" in navigator) {
        // Register the service worker for offline functionality
        navigator.serviceWorker.register("/serviceWorker.js", {
            scope: "/",
        }).then((registration) => {
            console.log("Service Worker registered successfully:", registration);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
                console.log('Service Worker update found');
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('New Service Worker installed, reloading page...');
                        // Optionally reload the page to use the new service worker
                        // window.location.reload();
                    }
                });
            });
        }).catch((error) => {
            console.error("Service Worker registration failed:", error);
        });
    }

    // Setup sync event listener first, before any sync operations
    listenForOnlineSync();
    
    // Then proceed with initial sync/fetch based on network status
    if (navigator.onLine) {
        console.log("🌐 Online mode detected at init - checking for server connectivity");
        // Verify actual server connectivity before proceeding
        if (typeof checkServerConnectivity === 'function') {
            const isActuallyOnline = await checkServerConnectivity();
            if (isActuallyOnline) {
                console.log("🌐 Server connectivity confirmed - proceeding with online init");
                // ALWAYS sync pending plants first if any exist
                await checkIfThereIsSyncPlantAndUpdate();
                
                // ALWAYS fetch fresh data from server when online
                // This ensures the UI shows the latest plants, not stale cache
                getPlantsFromServer();
            } else {
                console.log("⚠️ No server connectivity despite navigator.onLine=true - using offline mode");
                getPlantsFromIDB();
            }
        } else {
            // No connectivity check available; attempt online flow
            console.log("⚠️ No connectivity check function available - proceeding with online init");
            await checkIfThereIsSyncPlantAndUpdate();
            getPlantsFromServer();
        }
    } else {
        console.log("📴 Offline mode detected at init - using local data");
        // Only use IndexedDB cache when truly offline
        getPlantsFromIDB();
    }

    // Update queue counter on init (handles offline cached items)
    await updateQueueCounter();
    // Function to check for offline-synced plants and update them is defined at top-level
}    

// Function to check for offline-synced plants and update them (top-level so other handlers can call it)
async function checkIfThereIsSyncPlantAndUpdate() {
    console.log("═══════════════════════════════════════════");
    console.log(`🔄 SYNC CHECK STARTED - ${new Date().toISOString()}`);
    
    return new Promise(async (resolve) => {
        let isTherePlantsToSync = false;
        try {
            // Open the raw sync DB so we can access numeric keys (id)
            const db = await openSyncPlantIDB();
            const syncEntries = await getAllSyncPlants(db);

            console.log(`📦 Found ${syncEntries.length} total items in IndexedDB`);

            // syncEntries are objects from the store and look like { id, value }
            for (const entry of syncEntries) {
                const plant = entry.value || entry;
                const localId = entry.id;

                // Only sync if:
                // 1. Plant doesn't have a server _id OR has an offline temp ID
                // 2. Plant is not already synced (__syncStatus !== 'synced')
                // 3. Plant is not from server (__isServerPlant !== true)
                // 4. We're online
                const needsSync = (!plant._id || (typeof plant._id === 'string' && plant._id.startsWith('offline_'))) 
                                    && plant.__syncStatus !== 'synced' 
                                    && !plant.__isServerPlant;
                
                if (needsSync && navigator.onLine) {
                    console.log(`📤 Syncing plant ${localId}: ${plant.plantName}`);
                    // pass the local store id so it can be updated in-place after sync
                    await addPlantToMongoDB(plant, localId);
                    isTherePlantsToSync = true;
                } else {
                    const reason = plant.__isServerPlant ? 'server plant (cached)' : 
                                    plant.__syncStatus === 'synced' ? 'already synced' : 'unknown';
                    console.log(`⏭️  Skipping plant ${localId} (${plant.plantName}): ${reason}`);
                }
            }

            console.log(`✅ Sync check complete. Plants synced: ${isTherePlantsToSync}`);
            console.log("═══════════════════════════════════════════");
            resolve(isTherePlantsToSync);
        } catch (error) {
            console.error("❌ Error checking for sync plants:", error);
            console.log("═══════════════════════════════════════════");
            resolve(false);
        }
    });
}

// Automatic background sync - no manual button needed
// Sync happens automatically when coming online or on page load

// Function to add a plant to MongoDB
function addPlantToMongoDB(plantDetails, plantId = null) {
    console.log("📤 Syncing plant to server:", plantDetails.plantName);

    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("plantName", plantDetails.plantName);
        formData.append("type", plantDetails.type);
        formData.append("description", plantDetails.description);
        formData.append("nickname", plantDetails.nickname);

        // Handle photo upload - check if it's a File object (from offline storage) or Blob
        if (plantDetails.photo) {
            if (plantDetails.photo instanceof File || plantDetails.photo instanceof Blob) {
                console.log("📷 Uploading photo with plant:", plantDetails.photo.name || 'blob');
                formData.append("photo", plantDetails.photo);
            } else if (typeof plantDetails.photo === 'string') {
                // Photo is already uploaded (string filename)
                formData.append("photo", plantDetails.photo);
            } else if (typeof plantDetails.photo === 'object' && plantDetails.photo.name) {
                // Metadata only - file was lost (shouldn't happen with new approach)
                console.warn("⚠️  Photo metadata found but no actual file. Photo will not be uploaded:", plantDetails.photo.name);
            }
        }

        fetch("/api/plants/addNewPlant", {
            method: "POST",
            body: formData
        })
        .then(async response => {
            if (!response.ok) {
                console.error("❌ Error syncing plant to server, status:", response.status);
                reject(new Error(`Server error: ${response.status}`));
                return;
            }

            let responseData = null;
            try { responseData = await response.json(); } catch (e) { /* ignore parse errors */ }
            
            // Debug: Log the full response structure
            console.log("📋 Server response structure:", {
                responseData: responseData,
                hasPlant: !!(responseData && responseData.plant),
                plantId: responseData && responseData.plant ? responseData.plant._id : 'not found',
                fullPlantData: responseData && responseData.plant ? responseData.plant : 'no plant in response'
            });
            
            const serverId = responseData && responseData.plant && responseData.plant._id ? responseData.plant._id : 
                             responseData && (responseData._id || responseData.id) ? (responseData._id || responseData.id) : null;
            console.log("✅ Synced plant to server successfully, serverId:", serverId);

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
                        // If successfully synced, REMOVE from sync queue completely
                        // The plant will be fetched fresh from server and cached separately
                        if (serverId) {
                            const deleteReq = store.delete(plantId);
                            deleteReq.addEventListener('success', async () => {
                                console.log('✅ Removed synced plant from offline queue:', plantId);
                                console.log('🔄 Plant will be fetched fresh from server and cached');
                                try { 
                                    await updateQueueCounter(); 
                                } catch (e) { 
                                    console.error('updateQueueCounter error:', e); 
                                }
                                resolve();
                            });
                            deleteReq.addEventListener('error', (ev) => {
                                console.error('❌ Error deleting synced plant from queue:', ev.target.error);
                                // Still resolve - sync was successful
                                resolve();
                            });
                        } else {
                            // No server ID returned, keep it as pending for retry
                            const updatedValue = {
                                ...existingPlant,
                                _id: existingPlant._id,
                                __isServerPlant: false,
                                __syncStatus: 'pending',
                                __lastSyncTime: Date.now()
                            };

                            const putReq = store.put({ id: plantId, value: updatedValue });
                            putReq.addEventListener('success', async () => {
                                console.log('⚠️  Sync attempted but no server ID returned for plant:', plantId);
                                try { await updateQueueCounter(); } catch (e) { console.error('updateQueueCounter error:', e); }
                                resolve();
                            });

                            putReq.addEventListener('error', (ev) => {
                                console.error('❌ Error updating local record after sync:', ev.target.error);
                                resolve();
                            });
                        }
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
        console.log("═══════════════════════════════════════════");
        console.log("🌐 FETCHING FRESH DATA FROM SERVER (ONLINE MODE)");
        console.log("═══════════════════════════════════════════");
        // Add cache-busting parameter to ensure fresh data
        const cacheBuster = Date.now();
        const response = await fetch(`/api/plants/getAllPlants?sortBy=createdAt&order=desc&_=${cacheBuster}`, {
            cache: 'no-store' // Prevent browser HTTP caching
        });
        console.log("📡 Server response status:", response.status, response.ok);
        
        if (response.ok) {
            const data = await response.json();
            plantLists = data.plants || data; // Handle both array and object responses
            console.log("✅ Plants fetched from server successfully!");
            console.log("📊 Number of plants received:", plantLists.length);
            console.log("🌱 Plants data:", plantLists);
            
            // CRITICAL: Render immediately so user sees data
            applyFilterAndSort();
            
            // Cache in background (don't block UI)
            addAllPlantsToIDB(plantLists);
        } else {
            console.error("❌ Failed to fetch plants. Status:", response.status);
            throw new Error("Failed to fetch plants from server");
        }
    } catch (error) {
        console.error("❌ Error fetching plants from server:", error.message);
        // Try to load from cache as fallback
        console.log("📦 Attempting to load from IndexedDB cache as fallback...");
        await getPlantsFromIDB();
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
    console.log("═══════════════════════════════════════════");
    console.log("📦 LOADING FROM INDEXEDDB CACHE (OFFLINE MODE)");
    console.log("═══════════════════════════════════════════");
    try {
        plantLists = await getAllPlantsFromIDB();
        console.log("📦 Plants loaded from IndexedDB:", plantLists.length);
        console.log("🔍 Plant types in IndexedDB:", plantLists.map(p => ({
            name: p.plantName,
            hasId: !!p._id,
            isServerPlant: !!p.__isServerPlant,
            source: p._id ? 'server' : 'offline'
        })));
        applyFilterAndSort(); // Apply current filter and sort
    } catch (error) {
        console.error("❌ Error fetching plants from IndexedDB:", error);
        plantLists = [];
        applyFilterAndSort();
    }
}

// Function to add all plants to IndexedDB (PWA caching approach)
async function addAllPlantsToIDB(plants) {
    console.log("📦 Updating IndexedDB cache with server plants:", plants.length, "plants");
    console.log("⚠️ NOTE: This is BACKGROUND caching only - UI already shows fresh server data");
    try {
        const db = await openSyncPlantIDB();
        
        // Smart merge: Update server plants in cache, keep pending offline plants separate
        console.log("🔄 Merging server plants with local IndexedDB cache...");
        
        // Get existing plants
        const existingPlants = await getAllSyncPlants(db);
        
        // Build a map of existing server plants by _id for quick lookup
        const existingServerPlantsMap = new Map();
        const pendingPlants = [];
        
        existingPlants.forEach(item => {
            const plant = item.value || item;
            if (plant.__isServerPlant && plant._id) {
                existingServerPlantsMap.set(plant._id, item.id); // Map server ID to local store ID
            } else if (plant.__syncStatus === 'pending') {
                pendingPlants.push(plant);
            }
        });
        
        console.log(`📊 Cache state: ${existingServerPlantsMap.size} server plants, ${pendingPlants.length} pending sync`);
        
        // Add or update server plants
        const transaction = db.transaction(['plants'], 'readwrite');
        const store = transaction.objectStore('plants');
        
        for (const plant of plants) {
            const serverPlant = { 
                ...plant, 
                __isServerPlant: true,
                __syncStatus: 'synced',
                __lastSyncTime: Date.now()
            };
            
            // Check if we already have this server plant cached
            if (existingServerPlantsMap.has(plant._id)) {
                // Update existing cache entry
                const localId = existingServerPlantsMap.get(plant._id);
                store.put({ id: localId, value: serverPlant });
            } else {
                // Add new server plant to cache
                store.add({ value: serverPlant });
            }
        }
        
        // Wait for transaction to complete
        await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
        });
        
        console.log(`✅ Successfully cached ${plants.length} server plants to IndexedDB`);
        
        // Log cache statistics
        const updatedPlants = await getAllSyncPlants(db);
        const cacheStats = {
            total: updatedPlants.length,
            serverPlants: updatedPlants.filter(item => (item.value || item).__isServerPlant).length,
            pendingSync: updatedPlants.filter(item => (item.value || item).__syncStatus === 'pending' && !(item.value || item).__isServerPlant).length
        };
        console.log("📊 IndexedDB Cache Statistics:", cacheStats);
        
        // Refresh queue counter after updating cache
        try { await updateQueueCounter(); } catch (e) { console.error('updateQueueCounter error:', e); }
        
    } catch (error) {
        console.error("❌ Error updating IndexedDB cache:", error);
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

// Function to listen for online event and sync data
function listenForOnlineSync() {
    // Use a debounced version to prevent multiple rapid executions
    let syncTimeout = null;
    
    window.addEventListener("online", async() => {
        console.log("ONLINE EVENT DETECTED - Starting sync process");
        
        // Clear any pending sync timeout
        if (syncTimeout) {
            clearTimeout(syncTimeout);
        }
        
        // Set a new timeout to debounce multiple online events
        syncTimeout = setTimeout(async () => {
            // Check if there are plants in local storage to sync and update
            const isTherePlantsToSync = await checkIfThereIsSyncPlantAndUpdate();
            // If there are no plants to sync, get plants from the server
            if (!isTherePlantsToSync) {
                console.log("Back online - syncing completed");
            }
            
            // After sync completes, clear the timeout
            syncTimeout = null;
        }, 1000); // Wait 1 second to debounce multiple events
    });
}
