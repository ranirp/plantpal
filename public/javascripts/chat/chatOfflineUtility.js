/**
 * @fileoverview Chat offline utilities for message queueing and caching.
 * Manages offline chat message storage, pending message queue, and message sync.
 * Separate from chatIDBUtility.js for alternative database structure.
 * 
 * Database Structure:
 * - chatMessages: Active chat messages
 * - pendingMessages: Messages queued for sending when back online
 * - cachedMessages: Cached message history per plant
 * 
 * Key Features:
 * - Offline message composition
 * - Automatic message sync on reconnection
 * - Plant-specific message caching
 * - Timestamp-based ordering
 * - Local ID generation for offline messages
 */

const CHAT_IDB_NAME = "plantpalChatDB";
const CHAT_IDB_VERSION = 2;
const CHAT_MESSAGES_STORE = "chatMessages";
const SYNC_CHAT_STORE = "pendingMessages";
const CHAT_CACHE_STORE = "cachedMessages"; 

/**
 * Initialize chat database with message stores.
 * Creates stores for active messages, pending sync queue, and cache.
 * 
 * @returns {Promise<IDBDatabase>} Initialized database instance
 */
const initChatDatabase = () => {
    return new Promise((resolve, reject) => {
        console.log("Initializing chat database...");
        
        const request = indexedDB.open(CHAT_IDB_NAME, CHAT_IDB_VERSION);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            console.log("Upgrading chat database to version", CHAT_IDB_VERSION);
            
            // Create stores if they don't exist
            if (!db.objectStoreNames.contains(CHAT_MESSAGES_STORE)) {
                const messagesStore = db.createObjectStore(CHAT_MESSAGES_STORE, { 
                    keyPath: "localId", 
                    autoIncrement: true 
                });
                messagesStore.createIndex("plantID", "plantID", { unique: false });
                messagesStore.createIndex("timestamp", "timestamp", { unique: false });
                console.log("Created chat messages store");
            }
            
            if (!db.objectStoreNames.contains(SYNC_CHAT_STORE)) {
                const syncStore = db.createObjectStore(SYNC_CHAT_STORE, { 
                    keyPath: "localId", 
                    autoIncrement: true 
                });
                syncStore.createIndex("plantID", "plantID", { unique: false });
                syncStore.createIndex("timestamp", "timestamp", { unique: false });
                console.log("Created pending messages store");
            }
            
            if (!db.objectStoreNames.contains(CHAT_CACHE_STORE)) {
                const cacheStore = db.createObjectStore(CHAT_CACHE_STORE, { 
                    keyPath: "plantID" 
                });
                cacheStore.createIndex("lastUpdated", "lastUpdated", { unique: false });
                console.log("Created chat cache store");
            }
        };
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            console.log("Chat database initialized successfully");
            resolve(db);
        };
        
        request.onerror = (event) => {
            console.error("Error initializing chat database:", event.target.error);
            reject(event.target.error);
        };
    });
};

/**
 * Get or initialize the chat database
 * @returns {Promise<IDBDatabase>} The chat database
 */
let dbPromise = null;
const getChatDatabase = () => {
    if (!dbPromise) {
        dbPromise = initChatDatabase();
    }
    return dbPromise;
};

/**
 * Store a message in the pending messages store for later syncing
 * @param {Object} message The message to store
 * @returns {Promise<number>} The local ID of the stored message
 */
const addMessageToPendingSync = async (message) => {
    try {
        const db = await getChatDatabase();
        
        // Add timestamp if not present
        if (!message.timestamp) {
            message.timestamp = Date.now();
        }
        
        // Mark as pending sync
        message.syncStatus = 'pending';
        
        // Store in both pending sync and main messages store
        const syncTx = db.transaction([SYNC_CHAT_STORE, CHAT_MESSAGES_STORE], "readwrite");
        
        // Add to pending sync
        const pendingStore = syncTx.objectStore(SYNC_CHAT_STORE);
        const syncRequest = pendingStore.add(message);
        
        // Add to regular messages for display
        const messagesStore = syncTx.objectStore(CHAT_MESSAGES_STORE);
        messagesStore.add(message);
        
        return new Promise((resolve, reject) => {
            syncRequest.onsuccess = () => {
                const localId = syncRequest.result;
                console.log(`Added message to pending sync queue, localId: ${localId}`);
                resolve(localId);
            };
            
            syncRequest.onerror = () => {
                console.error("Error adding message to pending sync:", syncRequest.error);
                reject(syncRequest.error);
            };
        });
    } catch (error) {
        console.error("Error in addMessageToPendingSync:", error);
        throw error;
    }
};

/**
 * Cache messages for a plant for offline viewing
 * @param {string} plantID The plant ID
 * @param {Array} messages Array of messages to cache
 * @returns {Promise<void>}
 */
const cacheMessagesForPlant = async (plantID, messages) => {
    if (!plantID || !messages || !Array.isArray(messages)) {
        console.error("Invalid parameters for cacheMessagesForPlant", { plantID, messages });
        return Promise.reject(new Error("Invalid parameters"));
    }
    
    try {
        const db = await getChatDatabase();
        const tx = db.transaction([CHAT_CACHE_STORE], "readwrite");
        const store = tx.objectStore(CHAT_CACHE_STORE);
        
        const cacheEntry = {
            plantID,
            messages,
            lastUpdated: Date.now()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(cacheEntry);
            
            request.onsuccess = () => {
                console.log(`Cached ${messages.length} messages for plant ${plantID}`);
                resolve();
            };
            
            request.onerror = () => {
                console.error("Error caching messages:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("Error in cacheMessagesForPlant:", error);
        throw error;
    }
};

/**
 * Get cached messages for a plant
 * @param {string} plantID The plant ID
 * @returns {Promise<Array>} Array of cached messages or empty array if none
 */
const getCachedMessagesForPlant = async (plantID) => {
    try {
        const db = await getChatDatabase();
        const tx = db.transaction([CHAT_CACHE_STORE], "readonly");
        const store = tx.objectStore(CHAT_CACHE_STORE);
        
        return new Promise((resolve, reject) => {
            const request = store.get(plantID);
            
            request.onsuccess = () => {
                const cachedData = request.result;
                if (cachedData && cachedData.messages) {
                    console.log(`Retrieved ${cachedData.messages.length} cached messages for plant ${plantID}`);
                    resolve(cachedData.messages);
                } else {
                    console.log(`No cached messages found for plant ${plantID}`);
                    resolve([]);
                }
            };
            
            request.onerror = () => {
                console.error("Error retrieving cached messages:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("Error in getCachedMessagesForPlant:", error);
        return [];
    }
};

/**
 * Get all pending messages that need to be synced
 * @returns {Promise<Array>} Array of pending messages
 */
const getPendingSyncMessages = async () => {
    try {
        const db = await getChatDatabase();
        const tx = db.transaction([SYNC_CHAT_STORE], "readonly");
        const store = tx.objectStore(SYNC_CHAT_STORE);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            
            request.onsuccess = () => {
                const pendingMessages = request.result;
                console.log(`Found ${pendingMessages.length} pending messages to sync`);
                resolve(pendingMessages);
            };
            
            request.onerror = () => {
                console.error("Error getting pending messages:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("Error in getPendingSyncMessages:", error);
        return [];
    }
};

/**
 * Remove a message from the pending sync queue after successful sync
 * @param {number} localId The local ID of the message to remove
 * @returns {Promise<void>}
 */
const removePendingSyncMessage = async (localId) => {
    try {
        const db = await getChatDatabase();
        const tx = db.transaction([SYNC_CHAT_STORE], "readwrite");
        const store = tx.objectStore(SYNC_CHAT_STORE);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(localId);
            
            request.onsuccess = () => {
                console.log(`Removed pending message ${localId} from sync queue`);
                resolve();
            };
            
            request.onerror = () => {
                console.error("Error removing pending message:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("Error in removePendingSyncMessage:", error);
        throw error;
    }
};

/**
 * Mark a message in the main message store as synced
 * @param {number} localId The local ID of the message
 * @param {string} serverId The server-assigned ID
 * @returns {Promise<void>}
 */
const markMessageAsSynced = async (localId, serverId) => {
    try {
        const db = await getChatDatabase();
        const tx = db.transaction([CHAT_MESSAGES_STORE], "readwrite");
        const store = tx.objectStore(CHAT_MESSAGES_STORE);
        
        return new Promise((resolve, reject) => {
            const getRequest = store.get(localId);
            
            getRequest.onsuccess = () => {
                const message = getRequest.result;
                if (!message) {
                    console.warn(`Message ${localId} not found in messages store`);
                    resolve();
                    return;
                }
                
                message.syncStatus = 'synced';
                message.serverId = serverId;
                
                const putRequest = store.put(message);
                
                putRequest.onsuccess = () => {
                    console.log(`Marked message ${localId} as synced with server ID ${serverId}`);
                    resolve();
                };
                
                putRequest.onerror = () => {
                    console.error("Error marking message as synced:", putRequest.error);
                    reject(putRequest.error);
                };
            };
            
            getRequest.onerror = () => {
                console.error("Error retrieving message to mark as synced:", getRequest.error);
                reject(getRequest.error);
            };
        });
    } catch (error) {
        console.error("Error in markMessageAsSynced:", error);
        throw error;
    }
};

// Export all functions for use in other modules
window.ChatOfflineUtility = {
    initChatDatabase,
    getChatDatabase,
    addMessageToPendingSync,
    cacheMessagesForPlant,
    getCachedMessagesForPlant,
    getPendingSyncMessages,
    removePendingSyncMessage,
    markMessageAsSynced
};