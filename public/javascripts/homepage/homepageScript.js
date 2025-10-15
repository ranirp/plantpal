/**
 * @fileoverview Homepage main script for Plant Sharing Community.
 * Manages plant list display, filtering, sorting, online/offline synchronization,
 * and user authentication. Implements offline-first architecture with IndexedDB.
 * 
 * Key Features:
 * - Automatic online/offline detection and sync
 * - Plant filtering by type (succulent, fern, houseplant, etc.)
 * - Sorting by date or name
 * - IndexedDB caching for offline access
 * - Background sync queue management
 * - Real-time connectivity monitoring
 */

// List of all plants currently loaded in memory
let plantLists = [];

// Current filter for plant type.
let currentFilter = 'all';

// Current sort type for plant list.
let currentSort = 'date';

// Prevents double initialization of homepage.
let isInitialized = false;

async function init() {
    if (isInitialized) {
        console.log("Init already running");
        return;
    }
    isInitialized = true;

    console.log("HOMEPAGE INIT STARTED");

    checkIfUserLoggedIn();

    // Check if we just added a new plant
    checkForNewlyAddedPlant();

    // STEP 1: Load from IndexedDB FIRST (instant display)
    console.log("Step 1: Loading cached plants for instant display...");
    await getPlantsFromIDB();

    // STEP 2: Setup sync listener
    listenForOnlineSync();

    // STEP 3: Check if online and sync
    const isActuallyOnline = typeof checkServerConnectivity === 'function'
        ? await checkServerConnectivity()
        : navigator.onLine;

    console.log(`Connectivity: ${isActuallyOnline ? 'ONLINE' : 'OFFLINE'}`);

    if (isActuallyOnline) {
        // Sync and refresh if online
        console.log("Step 2: Online - syncing and refreshing...");
        await checkIfThereIsSyncPlantAndUpdate();
        await getPlantsFromServer();
    } else {
        console.log("Step 2: Offline - using cached data");
    }

    await updateQueueCounter();

    console.log("Init complete");
}

function checkForNewlyAddedPlant() {
    try {
        const newPlantAdded = sessionStorage.getItem('newPlantAdded');
        const newPlantData = sessionStorage.getItem('newPlantData');
        
        if (newPlantAdded === 'true' && newPlantData) {
            console.log("New plant detected!");
            
            const plant = JSON.parse(newPlantData);
            console.log("New plant data:", plant);
            
            // Show notification
            if (typeof showNotification === 'function') {
                const status = plant.__isServerPlant ? 'added' : 'saved offline';
                showNotification(`${plant.plantName} ${status} successfully!`, 'success');
            }
            
            // Clear flags
            sessionStorage.removeItem('newPlantAdded');
            sessionStorage.removeItem('newPlantData');
        }
    } catch (error) {
        console.error("Error checking for new plant:", error);
    }
}

async function getPlantsFromIDB() {
    console.log("Loading from IndexedDB...");
    
    try {
        let allPlants = await getAllPlantsFromIDB();
        console.log(`Found ${allPlants.length} total items`);

        if (allPlants.length === 0) {
            plantLists = [];
            applyFilterAndSort();
            return;
        }

        // Deduplicate plants by signature
        const plantMap = new Map();

        allPlants.forEach(plant => {
            const signature = `${plant.plantName}|${plant.nickname}|${plant.type}`.toLowerCase();
            const isServer = plant.__isServerPlant === true;
            const isPending = plant.__syncStatus === 'pending';

            if (!plantMap.has(signature)) {
                plantMap.set(signature, plant);
            } else {
                const existing = plantMap.get(signature);
                const existingIsServer = existing.__isServerPlant === true;

                // Replace if this one is better
                if (isServer && !existingIsServer) {
                    console.log(`Replacing with server version: ${plant.plantName}`);
                    plantMap.set(signature, plant);
                } else if (isPending && !existingIsServer) {
                    plantMap.set(signature, plant);
                }
            }
        });

        plantLists = Array.from(plantMap.values());

        console.log(`Loaded ${plantLists.length} plants (after dedup)`);
        console.log("Breakdown:", {
            server: plantLists.filter(p => p.__isServerPlant).length,
            pending: plantLists.filter(p => p.__syncStatus === 'pending').length,
            offline: plantLists.filter(p => p._id?.startsWith('offline_')).length
        });

        applyFilterAndSort();

    } catch (error) {
        console.error("Error loading from IndexedDB:", error);
        plantLists = [];
        applyFilterAndSort();
    }
}

async function getPlantsFromServer() {
    try {
        console.log("Fetching from server...");

        // Use cache buster to avoid stale data
        const cacheBuster = Date.now();
        const response = await fetch(`/api/plants/getAllPlants?sortBy=createdAt&order=desc&_=${cacheBuster}`, {
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        const serverPlants = data.plants || data;

        console.log(`Received ${serverPlants.length} plants from server`);

        // Update UI immediately
        plantLists = serverPlants;
        applyFilterAndSort();

        // Background: cache to IndexedDB
        await addAllPlantsToIDB(serverPlants);

    } catch (error) {
        console.error("Failed to fetch from server:", error.message);
        console.log("Using cached data");
    }
}

async function checkIfThereIsSyncPlantAndUpdate() {
    console.log("Checking for plants to sync...");
    
    try {
        const db = await openSyncPlantIDB();
        const syncEntries = await getAllSyncPlants(db);
        
        console.log(`Found ${syncEntries.length} items in queue`);
        
        let syncedCount = 0;
        
        for (const entry of syncEntries) {
            const plant = entry.value || entry;
            const localId = entry.id;
            
            const needsSync = (!plant._id || plant._id.startsWith('offline_')) 
                            && plant.__syncStatus !== 'synced' 
                            && !plant.__isServerPlant;
            
            if (needsSync && navigator.onLine) {
                console.log(`Syncing: ${plant.plantName}`);
                
                try {
                    await addPlantToMongoDB(plant, localId);
                    syncedCount++;
                    
                    // Remove offline version from display
                    plantLists = plantLists.filter(p => {
                        const sig = `${p.plantName}|${p.nickname}|${p.type}`.toLowerCase();
                        const plantSig = `${plant.plantName}|${plant.nickname}|${plant.type}`.toLowerCase();
                        return sig !== plantSig || p.__isServerPlant;
                    });
                    
                } catch (error) {
                    console.error(`Failed to sync ${plant.plantName}:`, error);
                }
            }
        }
        
        if (syncedCount > 0) {
            console.log(`✅ Synced ${syncedCount} plants`);
            
            if (typeof showNotification === 'function') {
                showNotification(`✅ Synced ${syncedCount} offline plant${syncedCount > 1 ? 's' : ''}`, 'success');
            }
            
            applyFilterAndSort();
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error("❌ Sync error:", error);
        return false;
    }
}

function addPlantToMongoDB(plantDetails, plantId = null) {
    console.log("Syncing to server:", plantDetails.plantName);

    return new Promise(async (resolve, reject) => {
        const formData = new FormData();
        formData.append("plantName", plantDetails.plantName);
        formData.append("type", plantDetails.type);
        formData.append("description", plantDetails.description);
        formData.append("nickname", plantDetails.nickname);

        if (plantDetails.photo) {
            if (plantDetails.photo instanceof File || plantDetails.photo instanceof Blob) {
                formData.append("photo", plantDetails.photo);
            }
        }

        fetch("/api/plants/addNewPlant", {
            method: "POST",
            body: formData
        })
        .then(async response => {
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const responseData = await response.json();
            const serverId = responseData.plant?._id || responseData._id;
            
            console.log("Synced successfully, serverId:", serverId);

            if (plantId && serverId) {
                try {
                    const db = await openSyncPlantIDB();
                    const transaction = db.transaction(['plants'], 'readwrite');
                    const store = transaction.objectStore('plants');
                    
                    // Delete offline version
                    const deleteReq = store.delete(plantId);
                    
                    deleteReq.addEventListener('success', async () => {
                        console.log('Removed from offline queue:', plantId);
                        try {
                            await updateQueueCounter();
                        } catch (e) {
                            console.error('updateQueueCounter error:', e);
                        }
                        resolve();
                    });
                    
                    deleteReq.addEventListener('error', (ev) => {
                        console.error('Error deleting:', ev.target.error);
                        resolve();
                    });
                } catch (error) {
                    console.error("Error updating IndexedDB:", error);
                    resolve();
                }
            } else {
                resolve();
            }
        })
        .catch(error => {
            console.error("Error syncing:", error);
            reject(error);
        });
    });
}

async function addAllPlantsToIDB(plants) {
    console.log(`Caching ${plants.length} plants...`);
    
    try {
        const db = await openSyncPlantIDB();
        const existingPlants = await getAllSyncPlants(db);
        
        const existingServerMap = new Map();
        const offlineToCleanup = [];
        
        existingPlants.forEach(item => {
            const plant = item.value || item;
            
            if (plant.__isServerPlant && plant._id) {
                existingServerMap.set(plant._id, item.id);
            } else if (plant._id?.startsWith('offline_')) {
                offlineToCleanup.push({ plant, localId: item.id });
            }
        });
        
        const transaction = db.transaction(['plants'], 'readwrite');
        const store = transaction.objectStore('plants');
        
        // Build server signatures
        const serverSignatures = new Set();
        plants.forEach(plant => {
            const sig = `${plant.plantName}|${plant.nickname}|${plant.type}`.toLowerCase();
            serverSignatures.add(sig);
        });
        
        // Remove synced offline plants
        for (const { plant, localId } of offlineToCleanup) {
            const sig = `${plant.plantName}|${plant.nickname}|${plant.type}`.toLowerCase();
            if (serverSignatures.has(sig)) {
                console.log(`🗑️ Removing synced: ${plant.plantName}`);
                store.delete(localId);
            }
        }
        
        // Add/update server plants
        for (const plant of plants) {
            const serverPlant = {
                ...plant,
                __isServerPlant: true,
                __syncStatus: 'synced',
                __lastSyncTime: Date.now()
            };
            
            if (existingServerMap.has(plant._id)) {
                const localId = existingServerMap.get(plant._id);
                store.put({ id: localId, value: serverPlant });
            } else {
                store.add({ value: serverPlant });
            }
        }
        
        await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
        });
        
        console.log(`Cached ${plants.length} plants`);
        
        await updateQueueCounter();
        
    } catch (error) {
        console.error("Error caching:", error);
    }
}

function listenForOnlineSync() {
    let syncTimeout = null;

    window.addEventListener("online", async () => {
        console.log("ONLINE event");

        if (syncTimeout) clearTimeout(syncTimeout);

        // Debounce sync to avoid rapid firing
        syncTimeout = setTimeout(async () => {
            const isActuallyOnline = typeof checkServerConnectivity === 'function'
                ? await checkServerConnectivity()
                : true;

            if (isActuallyOnline) {
                console.log("Server reachable, syncing...");
                await checkIfThereIsSyncPlantAndUpdate();
                await getPlantsFromServer();
            }

            syncTimeout = null;
        }, 1000);
    });
}

function applyFilterAndSort() {
    console.log(`Rendering ${plantLists.length} plants`);
    
    let filteredPlants = [...plantLists];
    
    // Apply filter
    if (currentFilter !== 'all') {
        filteredPlants = filteredPlants.filter(plant => {
            const plantType = (plant.type || '').toLowerCase();
            return plantType === currentFilter.toLowerCase();
        });
    }
    
    // Apply sort
    if (currentSort === 'name') {
        filteredPlants.sort((a, b) => (a.plantName || '').localeCompare(b.plantName || ''));
    } else if (currentSort === 'date') {
        filteredPlants.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
            const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
            return dateB - dateA;
        });
    } else if (currentSort === 'type') {
        filteredPlants.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
    }
    
    console.log(`Displaying ${filteredPlants.length} plants`);
    renderPlantList(filteredPlants);
}

function sortList(sortBy) {
    currentSort = sortBy;
    applyFilterAndSort();
}

function filterByType() {
    const filterSelect = document.getElementById("typeFilter");
    currentFilter = filterSelect.value;
    applyFilterAndSort();
}

function sortPlants(sortType) {
    sortList(sortType);
}

async function updateQueueCounter() {
    try {
        const syncDB = await openSyncPlantIDB();
        const syncPlants = await getAllSyncPlants(syncDB) || [];
        
        // Only count truly pending plants
        const pendingCount = syncPlants.filter(item => {
            const plant = item.value || item;
            return plant.__syncStatus === 'pending' && !plant.__isServerPlant;
        }).length;
        
        const counter = document.getElementById('queue_counter');
        if (counter) {
            if (pendingCount > 0) {
                counter.textContent = pendingCount;
                counter.classList.remove('hidden');
            } else {
                counter.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Error updating queue counter:', error);
    }
}

function showDetailsPage(id) {
    window.location.href = "/plantDetails/" + id + "/" + loggedInUser;
}

function openAddPlantPage() {
    window.location.href = "/addPlant";
}

// Export for compatibility
window.refreshHomepagePlants = async function() {
    console.log("Manual refresh");
    await getPlantsFromIDB();
};

// Sort button handlers
document.addEventListener('DOMContentLoaded', () => {
    const sortDateBtn = document.getElementById('sortDate');
    const sortNameBtn = document.getElementById('sortName');
    const sortTypeBtn = document.getElementById('sortType');
    
    if (sortDateBtn) {
        sortDateBtn.addEventListener('click', () => sortList('date'));
    }
    if (sortNameBtn) {
        sortNameBtn.addEventListener('click', () => sortList('name'));
    }
    if (sortTypeBtn) {
        sortTypeBtn.addEventListener('click', () => sortList('type'));
    }
});
