/**
 * @fileoverview Chat message IndexedDB utilities.
 * Manages chat message persistence, caching, and sync queue for offline chat.
 * Implements three stores: chatMessages (active), chats (sync queue), chatCache (offline viewing).
 * 
 * Key Features:
 * - Message persistence for offline viewing
 * - Sync queue for offline message sending
 * - Plant-specific chat caching
 * - Automatic cache updates
 * - Last updated timestamp tracking
 */

const CHAT_IDB_NAME = "chatIDB";
const CHAT_IDB_STORE = "chatMessages";
const SYNC_CHAT_STORE_NAME = "chats";
const CHAT_CACHE_STORE_NAME = "chatCache"; 
const SYNC_CHAT_EVENT = "chat";

/**
 * Initialize chat IndexedDB with required object stores.
 * Creates stores for active messages, sync queue, and cache.
 * 
 * @returns {Promise<IDBDatabase>} Opened database instance
 */
function initChatDatabase() {
    return new Promise((resolve, reject) => {
        console.log("Initializing chat database...");
        
        const request = indexedDB.open(CHAT_IDB_NAME, 2); 
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create chat messages store if it doesn't exist
            if (!db.objectStoreNames.contains(CHAT_IDB_STORE)) {
                db.createObjectStore(CHAT_IDB_STORE, { keyPath: "id", autoIncrement: true });
                console.log("Created chat messages store");
            }
            
            // Create sync store if it doesn't exist
            if (!db.objectStoreNames.contains(SYNC_CHAT_STORE_NAME)) {
                db.createObjectStore(SYNC_CHAT_STORE_NAME, { 
                    keyPath: "id", 
                    autoIncrement: true 
                });
                console.log("Created chat sync store");
            }
            
            // Create chat cache store for offline viewing
            if (!db.objectStoreNames.contains(CHAT_CACHE_STORE_NAME)) {
                const cacheStore = db.createObjectStore(CHAT_CACHE_STORE_NAME, { 
                    keyPath: "plantID" 
                });
                cacheStore.createIndex("lastUpdated", "lastUpdated", { unique: false });
                console.log("Created chat cache store for offline viewing");
            }
        };
        
        request.onsuccess = (event) => {
            console.log("Chat database initialized successfully");
            resolve(event.target.result);
        };
        
        request.onerror = (event) => {
            console.error("Error initializing chat database:", event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Get singleton database connection.
 * Ensures only one database connection is created and reused.
 * Lazy initializes database on first call.
 * 
 * @returns {Promise<IDBDatabase>} Database connection promise
 */
let dbPromise = null;
function getChatDatabase() {
    if (!dbPromise) {
        dbPromise = initChatDatabase();
    }
    return dbPromise;
}

/**
 * Add a new chat message to the sync queue for offline persistence.
 * Creates a transaction to store the message and retrieves the stored entry.
 * 
 * @param {IDBDatabase} syncChatTDB - Database connection
 * @param {Object} message - Chat message to store
 * @returns {Promise<Object>} Stored message with assigned ID
 */
const addNewChatToSync = (syncChatTDB, message) => {
    return new Promise((resolve, reject) => {
        // Start a readwrite transaction on the sync store
        const transaction = syncChatTDB.transaction([SYNC_CHAT_STORE_NAME], "readwrite");
        const chatStore = transaction.objectStore(SYNC_CHAT_STORE_NAME);
        const addRequest = chatStore.add({ value: message });

        // Attach error handler immediately so we catch failures to add
        addRequest.addEventListener("error", (event) => {
            reject(event.target.error);
        });

        addRequest.addEventListener("success", () => {
            try {
                console.log(`Added#${addRequest.result}: ${JSON.stringify(message)}`);
            } catch (e) {
                console.log("Added#%s: (message)", addRequest.result);
            }

            const getRequest = chatStore.get(addRequest.result);
            getRequest.addEventListener("success", () => {
                resolve(getRequest.result);
            });
            getRequest.addEventListener("error", (event) => {
                reject(event.target.error);
            });
        });
    });
};

const getAllSyncChatMessages = (syncChatTDB) => {
    return new Promise((resolve, reject) => {
        const transaction = syncChatTDB.transaction([SYNC_CHAT_STORE_NAME]);
        const chatStore = transaction.objectStore(SYNC_CHAT_STORE_NAME);
        const getAllRequest = chatStore.getAll();

        getAllRequest.addEventListener("success", () => {
            resolve(getAllRequest.result);
        });

        getAllRequest.addEventListener("error", (event) => {
            reject(event.target.error);
        });
    });
};

// Function to delete a sync chat from IndexedDB
const deleteSyncChatFromIDB = (syncChatTDB, id) => {
    return new Promise((resolve, reject) => {
        const transaction = syncChatTDB.transaction([SYNC_CHAT_STORE_NAME], "readwrite");
        const chatStore = transaction.objectStore(SYNC_CHAT_STORE_NAME);
        const deleteRequest = chatStore.delete(id);

        deleteRequest.addEventListener("success", () => {
            console.log(`Deleted sync chat with id ${id}`);
            resolve();
        });

        deleteRequest.addEventListener("error", (event) => {
            reject(event.target.error);
        });
    });
}

// Function to open the sync chats IndexedDB
function openSyncChatsIDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(SYNC_CHAT_STORE_NAME, 1);

        request.onerror = function (event) {
            reject(new Error(`Database error: ${event.target}`));
        };

        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            db.createObjectStore(SYNC_CHAT_STORE_NAME, {
                keyPath: "id",
                autoIncrement: true,
            });
        };

        request.onsuccess = function (event) {
            const db = event.target.result;
            resolve(db);
        };
    });
}

/**
 * Cache chat messages for offline viewing
 * @param {string} plantID - The plant ID
 * @param {Array} messages - Array of chat messages
 * @returns {Promise<void>}
 */
async function cacheChatMessages(plantID, messages) {
    if (!plantID || !messages || !Array.isArray(messages)) {
        console.error("Invalid parameters for cacheChatMessages", { plantID, messages });
        return Promise.reject(new Error("Invalid parameters"));
    }
    
    try {
        const db = await getChatDatabase();
        const tx = db.transaction([CHAT_CACHE_STORE_NAME], "readwrite");
        const store = tx.objectStore(CHAT_CACHE_STORE_NAME);
        
        const cacheEntry = {
            plantID: plantID,
            messages: messages,
            lastUpdated: Date.now()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(cacheEntry);
            
            request.onsuccess = () => {
                console.log(`✅ Cached ${messages.length} messages for plant ${plantID}`);
                resolve();
            };
            
            request.onerror = () => {
                console.error("❌ Error caching chat messages:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("❌ Error in cacheChatMessages:", error);
        throw error;
    }
}

/**
 * Retrieve cached chat messages for offline viewing
 * @param {string} plantID - The plant ID
 * @returns {Promise<Array>} Array of messages or empty array
 */
async function getCachedChatMessages(plantID) {
    if (!plantID) {
        console.error("Plant ID required for getCachedChatMessages");
        return Promise.resolve([]);
    }
    
    try {
        const db = await getChatDatabase();
        const tx = db.transaction([CHAT_CACHE_STORE_NAME], "readonly");
        const store = tx.objectStore(CHAT_CACHE_STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.get(plantID);
            
            request.onsuccess = () => {
                const cachedData = request.result;
                if (cachedData && Array.isArray(cachedData.messages)) {
                    console.log(`📦 Retrieved ${cachedData.messages.length} cached messages for plant ${plantID}`);
                    resolve(cachedData.messages);
                } else {
                    console.log(`ℹ️ No cached messages found for plant ${plantID}`);
                    resolve([]);
                }
            };
            
            request.onerror = () => {
                console.error("❌ Error retrieving cached messages:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("❌ Error in getCachedChatMessages:", error);
        return [];
    }
}
