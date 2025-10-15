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

const CHAT_DB_NAME = "chatIDB";
const CHAT_DB_VERSION = 3;
const CHAT_MESSAGES_STORE = "chatMessages";
const PENDING_SYNC_STORE = "pendingMessages";
const CHAT_CACHE_STORE = "chatCache";

/**
 * Initialize chat database with all required stores
 */
function initChatDatabase() {
    return new Promise((resolve, reject) => {
        console.log("🔧 Initializing unified chat database...");
        
        const request = indexedDB.open(CHAT_DB_NAME, CHAT_DB_VERSION);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            console.log(`Upgrading database to version ${CHAT_DB_VERSION}`);
            
            // Create chat messages store (for display)
            if (!db.objectStoreNames.contains(CHAT_MESSAGES_STORE)) {
                const messagesStore = db.createObjectStore(CHAT_MESSAGES_STORE, { 
                    keyPath: "localId", 
                    autoIncrement: true 
                });
                messagesStore.createIndex("plantID", "plantID", { unique: false });
                messagesStore.createIndex("timestamp", "timestamp", { unique: false });
                console.log("✅ Created chatMessages store");
            }
            
            // Create pending sync store (for offline messages)
            if (!db.objectStoreNames.contains(PENDING_SYNC_STORE)) {
                const syncStore = db.createObjectStore(PENDING_SYNC_STORE, { 
                    keyPath: "localId", 
                    autoIncrement: true 
                });
                syncStore.createIndex("plantID", "plantID", { unique: false });
                syncStore.createIndex("timestamp", "timestamp", { unique: false });
                console.log("✅ Created pendingMessages store");
            }
            
            // Create cache store (for offline viewing)
            if (!db.objectStoreNames.contains(CHAT_CACHE_STORE)) {
                const cacheStore = db.createObjectStore(CHAT_CACHE_STORE, { 
                    keyPath: "plantID" 
                });
                cacheStore.createIndex("lastUpdated", "lastUpdated", { unique: false });
                console.log("✅ Created chatCache store");
            }
        };
        
        request.onsuccess = (event) => {
            console.log("✅ Chat database initialized successfully");
            resolve(event.target.result);
        };
        
        request.onerror = (event) => {
            console.error("❌ Error initializing chat database:", event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Singleton database connection
 */
let dbPromise = null;
function getChatDatabase() {
    if (!dbPromise) {
        dbPromise = initChatDatabase();
    }
    return dbPromise;
}

/**
 * Add message to pending sync queue (for offline messages)
 */
async function addMessageToPendingSync(message) {
    try {
        const db = await getChatDatabase();
        
        // Add metadata
        if (!message.timestamp) {
            message.timestamp = Date.now();
        }
        message.syncStatus = 'pending';
        message.offlineCreated = true;
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction([PENDING_SYNC_STORE], "readwrite");
            const store = tx.objectStore(PENDING_SYNC_STORE);
            const request = store.add(message);
            
            request.onsuccess = () => {
                const localId = request.result;
                console.log(`📦 Added message to pending sync queue, localId: ${localId}`);
                resolve(localId);
            };
            
            request.onerror = () => {
                console.error("❌ Error adding message to pending sync:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("❌ Error in addMessageToPendingSync:", error);
        throw error;
    }
}

/**
 * Get all pending messages that need to be synced
 */
async function getAllPendingMessages() {
    try {
        const db = await getChatDatabase();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction([PENDING_SYNC_STORE], "readonly");
            const store = tx.objectStore(PENDING_SYNC_STORE);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const messages = request.result || [];
                console.log(`📤 Found ${messages.length} pending messages to sync`);
                resolve(messages);
            };
            
            request.onerror = () => {
                console.error("❌ Error getting pending messages:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("❌ Error in getAllPendingMessages:", error);
        return [];
    }
}

/**
 * Delete message from pending sync queue after successful sync
 */
async function deletePendingMessage(localId) {
    try {
        const db = await getChatDatabase();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction([PENDING_SYNC_STORE], "readwrite");
            const store = tx.objectStore(PENDING_SYNC_STORE);
            const request = store.delete(localId);
            
            request.onsuccess = () => {
                console.log(`✅ Deleted pending message ${localId}`);
                resolve();
            };
            
            request.onerror = () => {
                console.error("❌ Error deleting pending message:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("❌ Error in deletePendingMessage:", error);
        throw error;
    }
}

/**
 * Cache messages for offline viewing
 */
async function cacheChatMessages(plantID, messages) {
    if (!plantID || !Array.isArray(messages)) {
        console.error("❌ Invalid parameters for cacheChatMessages");
        return Promise.reject(new Error("Invalid parameters"));
    }
    
    try {
        const db = await getChatDatabase();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction([CHAT_CACHE_STORE], "readwrite");
            const store = tx.objectStore(CHAT_CACHE_STORE);
            
            const cacheEntry = {
                plantID: plantID,
                messages: messages,
                lastUpdated: Date.now()
            };
            
            const request = store.put(cacheEntry);
            
            request.onsuccess = () => {
                console.log(`✅ Cached ${messages.length} messages for plant ${plantID}`);
                resolve();
            };
            
            request.onerror = () => {
                console.error("❌ Error caching messages:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("❌ Error in cacheChatMessages:", error);
        throw error;
    }
}

/**
 * Get cached messages for offline viewing
 */
async function getCachedChatMessages(plantID) {
    if (!plantID) {
        console.error("❌ Plant ID required");
        return [];
    }
    
    try {
        const db = await getChatDatabase();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction([CHAT_CACHE_STORE], "readonly");
            const store = tx.objectStore(CHAT_CACHE_STORE);
            const request = store.get(plantID);
            
            request.onsuccess = () => {
                const cachedData = request.result;
                if (cachedData && Array.isArray(cachedData.messages)) {
                    console.log(`📦 Retrieved ${cachedData.messages.length} cached messages for plant ${plantID}`);
                    resolve(cachedData.messages);
                } else {
                    console.log(`ℹ️ No cached messages for plant ${plantID}`);
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

/**
 * Clear all pending messages (use with caution)
 */
async function clearAllPendingMessages() {
    try {
        const db = await getChatDatabase();
        
        return new Promise((resolve, reject) => {
            const tx = db.transaction([PENDING_SYNC_STORE], "readwrite");
            const store = tx.objectStore(PENDING_SYNC_STORE);
            const request = store.clear();
            
            request.onsuccess = () => {
                console.log("✅ Cleared all pending messages");
                resolve();
            };
            
            request.onerror = () => {
                console.error("❌ Error clearing pending messages:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("❌ Error in clearAllPendingMessages:", error);
        throw error;
    }
}

// Expose functions globally for use in other scripts
window.ChatDB = {
    getChatDatabase,
    addMessageToPendingSync,
    getAllPendingMessages,
    deletePendingMessage,
    cacheChatMessages,
    getCachedChatMessages,
    clearAllPendingMessages
};

