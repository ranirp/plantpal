/**
 * @fileoverview Real-time chat functionality with offline support.
 * Manages Socket.IO connection, message sending/receiving, and offline queueing.
 * Implements connection stability monitoring and automatic reconnection.
 * 
 * Key Features:
 * - Socket.IO real-time messaging
 * - Offline message queueing with IndexedDB
 * - Connection stability detection with debouncing
 * - Automatic room management per plant
 * - Message persistence and sync
 * - Connectivity-aware UI updates
 */

// Socket.IO instance for real-time communication
let socket;
// Number of attempts to initialize socket
let socketInitAttempts = 0;
// Timer for debouncing status updates
let statusUpdateDebounceTimer = null;
// Tracks if the connection is currently stable
let connectionStable = false;
// Timestamp of the last status update
let lastStatusUpdate = null;
// Array to hold chat messages
let chatMessages = [];
// Set to track rendered message IDs and prevent duplicates
let renderedMessageIds = new Set();

/**
 * Initialize chat when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function () {
    console.log("Chat DOM loaded, initializing...");
    // Wait for dependencies to be available before initializing
    setTimeout(() => {
        initializeSocket();
        if (typeof init === 'function') {
            init();
        } else {
            setTimeout(() => {
                if (typeof init === 'function') init();
            }, 1500);
        }
    }, 1000);
});

/**
 * Initialize Socket.IO connection with reconnection and connectivity checks
 */
async function initializeSocket() {
    if (socket) {
        console.log("Socket already initialized");
        return;
    }

    console.log("Initializing socket connection...");

    // Wait for connectivity check function to be available
    if (typeof checkServerConnectivity !== 'function') {
        socketInitAttempts++;
        if (socketInitAttempts > 10) {
            console.error("checkServerConnectivity not available");
            updateChatStatus(navigator.onLine);
            return;
        }
        setTimeout(initializeSocket, 500);
        return;
    }

    try {
        // Check if server is reachable before connecting
        const hasConnectivity = await checkServerConnectivity();
        console.log(`Server connectivity: ${hasConnectivity ? 'ONLINE' : 'OFFLINE'}`);

        // Initialize Socket.IO client with recommended options
        socket = io({
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            reconnectionAttempts: 5,
            timeout: 20000,
            transports: ['websocket', 'polling']
        });

        // Handle successful connection
        socket.on('connect', async function () {
            console.log('✅ Socket connected');
            clearTimeout(statusUpdateDebounceTimer);
            statusUpdateDebounceTimer = setTimeout(async () => {
                const online = await checkServerConnectivity();
                updateChatStatus(online);
                if (online && typeof plantId !== 'undefined' && plantId) {
                    joinPlantChatRoom();
                    // Sync any pending messages from offline
                    await syncPendingMessages();
                }
                connectionStable = true;
                lastStatusUpdate = Date.now();
            }, 1000);
        });

        // Handle disconnection
        socket.on('disconnect', function () {
            console.log('Socket disconnected');
            clearTimeout(statusUpdateDebounceTimer);
            statusUpdateDebounceTimer = setTimeout(() => {
                updateChatStatus(false);
                connectionStable = false;
                lastStatusUpdate = Date.now();
            }, 3000);
        });

        // Handle reconnection
        socket.on('reconnect', async function () {
            console.log('Socket reconnected');
            if (typeof plantId !== 'undefined' && plantId) {
                joinPlantChatRoom();
                await syncPendingMessages();
            }
        });

        console.log("Socket initialized");

    } catch (error) {
        console.error("Socket initialization error:", error);
        updateChatStatus(false);
    }
}

/**
 * Sync all pending messages stored offline when back online
 */
async function syncPendingMessages() {
    console.log("Checking for pending messages to sync...");

    try {
        if (typeof window.ChatDB === 'undefined') {
            console.error("ChatDB not available for sync");
            return;
        }

        // Retrieve all messages queued for sync
        const pendingMessages = await window.ChatDB.getAllPendingMessages();

        if (pendingMessages.length === 0) {
            console.log("No pending messages to sync");
            return;
        }

        console.log(`Syncing ${pendingMessages.length} pending messages...`);

        for (const message of pendingMessages) {
            try {
                console.log(`Syncing message ${message.localId}:`, message);

                // Save to server DB
                await addChatToServerDB(message);

                // Emit to socket if connected
                if (socket && socket.connected) {
                    socket.emit("chat", message);
                }

                // Remove from pending queue
                await window.ChatDB.deletePendingMessage(message.localId);

                console.log(`Synced and removed message ${message.localId}`);

            } catch (error) {
                console.error(`Failed to sync message ${message.localId}:`, error);
            }
        }

        console.log("Finished syncing pending messages");

        // Refresh chat to show synced messages
        await getChatHistory(plantId);

    } catch (error) {
        console.error("Error in syncPendingMessages:", error);
    }
}

/**
 * Update chat status UI and notify other components
 * @param {boolean} isOnline
 */
async function updateChatStatus(isOnline) {
    // Debounce status updates to avoid UI flicker
    if (lastStatusUpdate && Date.now() - lastStatusUpdate < 3000) {
        return;
    }

    // Double-check server connectivity if online
    if (isOnline && typeof checkServerConnectivity === 'function') {
        isOnline = await checkServerConnectivity();
    }

    const statusDot = document.getElementById('chatStatusDot');
    const statusText = document.getElementById('chatStatusText');

    if (statusDot && statusText) {
        if (isOnline) {
            statusDot.className = 'w-2 h-2 bg-green-500 rounded-full mr-2';
            statusText.textContent = 'Online';
        } else {
            statusDot.className = 'w-2 h-2 bg-red-500 rounded-full mr-2';
            statusText.textContent = 'Offline';
        }
    }

    // Notify other UI elements of status change
    if (typeof changeOnlineStatus === 'function') {
        changeOnlineStatus(isOnline);
    }

    lastStatusUpdate = Date.now();
    console.log(`Chat status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
}

/**
 * Initialize chat functionality
 */
window.init = function () {
    console.log("Initializing chat functionality...");

    if (!socket) {
        console.log("Waiting for socket...");
        setTimeout(init, 500);
        return;
    }

    // Extract plantId from URL if not set
    if (typeof plantId === 'undefined' || !plantId) {
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length > 2) {
            plantId = pathParts[2];
        }
    }

    // Default to Guest if user not set
    if (typeof loggedInUser === 'undefined' || !loggedInUser) {
        loggedInUser = "Guest";
    }

    console.log(`Chat initialized: plantId=${plantId}, user=${loggedInUser}`);

    getChatHistory(plantId);
    registerSocket();
    registerFormSubmit();
    listenForOnlineSync();

    if (socket && socket.connected) {
        joinPlantChatRoom();
    }
};

/**
 * Register form submit handler
 */
function registerFormSubmit() {
    const chatForm = document.getElementById("chatForm");
    if (chatForm) {
        chatForm.addEventListener("submit", function(event) {
            event.preventDefault();
            sendMessage();
        });
    }
}

/**
 * Send chat message (handles both online and offline scenarios)
 */
async function sendMessage() {
    const input = document.getElementById("chatInput");
    if (!input || input.value.trim() === "") {
        return;
    }

    const messageText = input.value.trim();

    // Construct message object with all required fields
    const chatMessage = {
        chatmessage: messageText,
        chatMessage: messageText,
        username: loggedInUser,
        userName: loggedInUser,
        plantId: plantId,
        chattime: new Date().toISOString(),
        chatTime: new Date().toISOString(),
        timestamp: Date.now()
    };

    // Check connectivity before sending
    const isOnline = navigator.onLine && await checkServerConnectivity();

    if (isOnline) {
        // ONLINE: Clear input and send message to server
        input.value = "";
        console.log("Sending message online:", messageText);

        try {
            await addChatToServerDB(chatMessage);
            if (socket && socket.connected) {
                socket.emit("chat", chatMessage);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message. Please try again.");
        }

    } else {
        // OFFLINE: Check plant ownership before allowing offline chat
        console.log("Offline mode - checking ownership...");

        const canChatOffline = await isUserOwnPlant(plantId, loggedInUser);

        if (!canChatOffline) {
            // BLOCKED: User doesn't own plant
            console.log("BLOCKED: User doesn't own this plant");
            alert("Offline Mode Restriction\n\nYou can only send messages to plants that YOU added when offline.\n\nConnect to the internet to chat about all plants.");
            return;
        }

        // ALLOWED: User owns plant, proceed with offline save
        input.value = "";
        console.log("User owns plant - saving message offline");

        try {
            // Ensure ChatDB is available
            if (typeof window.ChatDB === 'undefined') {
                throw new Error("ChatDB not available");
            }

            // Add to pending sync queue
            const localId = await window.ChatDB.addMessageToPendingSync(chatMessage);
            chatMessage.localId = localId;
            chatMessage.syncStatus = 'pending';

            console.log(`Message queued for sync with localId: ${localId}`);

            // Update cache for offline display
            try {
                const cachedMessages = await window.ChatDB.getCachedChatMessages(plantId);
                cachedMessages.push(chatMessage);
                await window.ChatDB.cacheChatMessages(plantId, cachedMessages);
            } catch (cacheError) {
                console.warn("Cache update failed:", cacheError);
            }

            // Display message immediately in UI
            renderChatMessage([chatMessage]);

            // Show success notification
            if (typeof showNotification === 'function') {
                showNotification("Message saved. Will sync when online.", 'info');
            }

        } catch (error) {
            console.error("Error saving offline message:", error);
            alert("Failed to save message offline. Please try again.");
            input.value = messageText;
        }
    }
}

/**
 * Check if user owns the plant
 */
async function isUserOwnPlant(plantId, username) {
    console.log(`Checking ownership: plantId=${plantId}, username=${username}`);
    
    try {
        // Try server check first if online
        if (navigator.onLine) {
            try {
                const response = await fetch(`/plantDetails/checkOwnership/${plantId}/${username}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`Server ownership check: ${data.isOwner ? 'OWNED' : 'NOT OWNED'}`);
                    return data.isOwner;
                }
            } catch (error) {
                console.log('Server check failed, using offline method');
            }
        }
        
        // Offline check using IndexedDB
        console.log('📱 Using offline IndexedDB ownership check');
        
        const db = await openSyncPlantIDB();
        const plants = await getAllSyncPlants(db);
        
        console.log(`Found ${plants.length} plants in offline storage`);
        
        if (plants.length === 0) {
            console.log('No plants in offline storage');
            return false;
        }
        
        // Check each plant for match
        for (const p of plants) {
            const plantData = p.value || p;
            
            // Extract IDs (handle different formats)
            const storedPlantId = plantData._id || plantData.id;
            const storedUsername = plantData.nickname || plantData.username || plantData.addedBy;
            
            console.log(`Checking plant: id=${storedPlantId}, owner=${storedUsername}`);
            
            // STRICT matching
            const idMatch = (storedPlantId === plantId);
            const userMatch = (storedUsername === username);
            
            if (idMatch && userMatch) {
                console.log(`MATCH FOUND: User ${username} owns plant ${plantId}`);
                return true;
            }
        }
        
        console.log(`NO MATCH: User ${username} does NOT own plant ${plantId}`);
        return false;
        
    } catch (error) {
        console.error("Error checking ownership:", error);
        return false;
    }
}

/**
 * DEBUGGING HELPER: Add this to check what's in your IndexedDB
 * Call this in browser console: debugPlantOwnership()
 */

window.debugPlantOwnership = async function() {
    console.log("DEBUG: Checking plant ownership data...");
    console.log(`Current plantId: ${plantId}`);
    console.log(`Current user: ${loggedInUser}`);
    
    try {
        const db = await openSyncPlantIDB();
        const plants = await getAllSyncPlants(db);
        
        console.log(`Found ${plants.length} plants in IndexedDB:`);
        
        plants.forEach((p, index) => {
            const plantData = p.value || p;
            console.log(`\nPlant ${index + 1}:`, {
                id: plantData._id || plantData.id,
                name: plantData.name || plantData.plantname,
                owner: plantData.nickname || plantData.username || plantData.addedBy,
                fullData: plantData
            });
        });
        
        // Check current plant
        const canChat = await isUserOwnPlant(plantId, loggedInUser);
        console.log(`\n Can user ${loggedInUser} chat with plant ${plantId}? ${canChat ? 'YES' : 'NO'}`);
        
    } catch (error) {
        console.error("Debug error:", error);
    }
};

/**
 * Plant IndexedDB helper functions
 */
async function openSyncPlantIDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('plants', 1);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('plants')) {
                db.createObjectStore('plants', { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
    });
}

async function getAllSyncPlants(db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['plants'], 'readonly');
        const store = tx.objectStore('plants');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Listen for online/offline events
 */
function listenForOnlineSync() {
    checkServerConnectivity().then(isOnline => {
        updateChatStatus(isOnline);
    });
    
    window.addEventListener('online', async function() {
        console.log("Device reports online...");
        await new Promise(resolve => setTimeout(resolve, 1500));
        const online = await checkServerConnectivity();
        updateChatStatus(online);
        
        if (online) {
            console.log("Connection verified - syncing messages");
            await syncPendingMessages();
        }
    });
    
    window.addEventListener('offline', function() {
        updateChatStatus(false);
        console.log("Device offline");
    });
    
    // Periodic connectivity check
    setInterval(async () => {
        if (navigator.onLine) {
            const online = await checkServerConnectivity();
            const currentStatus = document.getElementById('chatStatusText')?.textContent === 'Online';
            if (online !== currentStatus) {
                updateChatStatus(online);
            }
        }
    }, 15000);
}

/**
 * Register socket event handlers
 */
function registerSocket() {
    if (!socket) {
        setTimeout(registerSocket, 1000);
        return;
    }
    
    console.log("📡 Registering socket handlers...");
    
    socket.off("joined");
    socket.off("left");
    socket.off("chatmessage");
    
    socket.on("joined", function(room, userId) {
        console.log(`User ${userId} joined room ${room}`);
    });
    
    socket.on("left", function(room, userId) {
        console.log(`User ${userId} left room ${room}`);
    });
    
    socket.on("chatmessage", function(message) {
        console.log("Received socket message:", message);
        
        // Normalize properties
        if (message.chatmessage && !message.chatMessage) message.chatMessage = message.chatmessage;
        if (message.username && !message.userName) message.userName = message.username;
        if (message.chattime && !message.chatTime) message.chatTime = message.chattime;
        
        // Render only if not already rendered (prevent duplicates)
        const messageId = message._id || message.id || `${message.userName}-${message.chatTime}`;
        if (!renderedMessageIds.has(messageId)) {
            renderChatMessage([message]);
        }
    });
}

/**
 * Send message to server database
 */
async function addChatToServerDB(message) {
    console.log("Saving to server DB:", message);
    
    const response = await fetch(`/api/chat/plants/${message.plantId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chatmessage: message.chatmessage,
            username: message.username,
            plantId: message.plantId,
            chattime: message.chattime
        })
    });
    
    if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("✅ Saved to server:", data);
    return data;
}

/**
 * Join plant chat room
 */
function joinPlantChatRoom() {
    if (!socket || !socket.connected) {
        console.log("⏳ Waiting for socket connection...");
        return;
    }
    
    console.log(`Joining room for plant ${plantId} as ${loggedInUser}`);
    socket.emit("createorjoin", plantId, loggedInUser);
}

/**
 * Get chat history
 */
async function getChatHistory(plantID) {
    const container = document.getElementById("chatMessages");
    if (!container) {
        console.error("Chat container not found");
        return;
    }
    
    console.log("Fetching chat history...");
    
    const isOnline = await checkServerConnectivity();
    
    if (isOnline) {
        container.innerHTML = '<div class="flex justify-center p-4"><div class="spinner"></div></div>';
        
        try {
            const response = await fetch(`/api/chat/plants/${plantID}/messages`);
            const data = await response.json();
            chatMessages = data.messages || [];
            
            console.log(`Loaded ${chatMessages.length} messages from server`);
            
            // Cache for offline use
            if (window.ChatDB) {
                await window.ChatDB.cacheChatMessages(plantID, chatMessages);
            }
            
            renderChatMessages(chatMessages);
            
        } catch (error) {
            console.error("Server fetch failed:", error);
            await loadCachedMessages(plantID, container);
        }
        
    } else {
        console.log("📱 Offline - loading cached messages");
        await loadCachedMessages(plantID, container);
    }
}

/**
 * Load cached messages for offline viewing
 */
async function loadCachedMessages(plantID, container) {
    try {
        if (!window.ChatDB) {
            throw new Error("ChatDB not available");
        }
        
        const cached = await window.ChatDB.getCachedChatMessages(plantID);
        
        if (cached.length > 0) {
            console.log(`📦 Loaded ${cached.length} cached messages`);
            chatMessages = cached;
            renderChatMessages(cached);
        } else {
            showNoMessagesUI(container);
        }
    } catch (error) {
        console.error("Cache load failed:", error);
        showNoMessagesUI(container);
    }
}

/**
 * Show no messages UI
 */
function showNoMessagesUI(container) {
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full p-4">
            <i class="fas fa-comments text-4xl text-gray-400 mb-4"></i>
            <p class="text-gray-600 text-center">
                No messages yet.<br>Start the conversation!
            </p>
        </div>
    `;
}

/**
 * Render single message (append)
 */
function renderChatMessage(messages) {
    const container = document.getElementById("chatMessages");
    if (!container) return;
    
    messages.forEach(msg => {
        // Check for duplicates
        const msgId = msg._id || msg.id || msg.localId || `${msg.userName}-${msg.timestamp || msg.chatTime}`;
        
        if (renderedMessageIds.has(msgId)) {
            console.log(`Skipping duplicate message: ${msgId}`);
            return;
        }
        
        // Normalize message properties
        normalizeMessageProperties(msg);
        
        // Format timestamp
        formatMessageTime(msg);
        
        // Create and append message div
        const messageDiv = createChatMessageDiv(msg);
        container.appendChild(messageDiv);
        
        // Track rendered message
        renderedMessageIds.add(msgId);
    });
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

/**
 * Render all messages (replace)
 */
function renderChatMessages(messages) {
    const container = document.getElementById("chatMessages");
    if (!container) return;
    
    // Clear container and tracking
    container.innerHTML = '';
    renderedMessageIds.clear();
    
    if (!messages || messages.length === 0) {
        showNoMessagesUI(container);
        return;
    }
    
    console.log(`Rendering ${messages.length} messages`);
    
    messages.forEach(msg => {
        normalizeMessageProperties(msg);
        formatMessageTime(msg);
        
        const messageDiv = createChatMessageDiv(msg);
        container.appendChild(messageDiv);
        
        const msgId = msg._id || msg.id || msg.localId || `${msg.userName}-${msg.timestamp}`;
        renderedMessageIds.add(msgId);
    });
    
    container.scrollTop = container.scrollHeight;
}

/**
 * Normalize message properties for consistency
 */
function normalizeMessageProperties(msg) {
    if (msg.chatmessage && !msg.chatMessage) msg.chatMessage = msg.chatmessage;
    if (msg.chatMessage && !msg.chatmessage) msg.chatmessage = msg.chatMessage;
    if (msg.username && !msg.userName) msg.userName = msg.username;
    if (msg.userName && !msg.username) msg.username = msg.userName;
    if (msg.chattime && !msg.chatTime) msg.chatTime = msg.chattime;
    if (msg.chatTime && !msg.chattime) msg.chattime = msg.chatTime;
}

/**
 * Format message timestamp
 */
function formatMessageTime(msg) {
    let timeToFormat = msg.chatTime || msg.chattime || msg.timestamp;
    
    if (!timeToFormat) {
        msg.chatTime = 'Just now';
        msg.chattime = 'Just now';
        return;
    }
    
    try {
        const date = new Date(timeToFormat);
        if (isNaN(date.getTime())) {
            msg.chatTime = 'Just now';
            msg.chattime = 'Just now';
            return;
        }
        
        const formatted = date.toLocaleString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
            hour12: true
        });
        
        msg.chatTime = formatted;
        msg.chattime = formatted;
        
        // Add pending indicator for offline messages
        if (msg.syncStatus === 'pending') {
            msg.chatTime += ' (Pending sync)';
            msg.chattime += ' (Pending sync)';
        }
        
    } catch (error) {
        console.error("Error formatting time:", error);
        msg.chatTime = 'Just now';
        msg.chattime = 'Just now';
    }
}

/**
 * Create chat message div element
 */
function createChatMessageDiv(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'mb-4 p-3 rounded-lg';
    
    const isOwnMessage = message.userName === loggedInUser || message.username === loggedInUser;
    
    if (isOwnMessage) {
        messageDiv.classList.add('bg-blue-100', 'ml-auto', 'max-w-[80%]');
    } else {
        messageDiv.classList.add('bg-gray-100', 'mr-auto', 'max-w-[80%]');
    }
    
    // Add pending indicator styling
    if (message.syncStatus === 'pending') {
        messageDiv.classList.add('border-l-4', 'border-yellow-500', 'opacity-80');
    }
    
    const userDiv = document.createElement('div');
    userDiv.className = 'font-semibold text-sm mb-1';
    userDiv.textContent = message.userName || message.username || 'Unknown';
    
    const messageText = document.createElement('div');
    messageText.className = 'text-gray-800';
    messageText.textContent = message.chatMessage || message.chatmessage || '';
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'text-xs text-gray-500 mt-1';
    timeDiv.textContent = message.chatTime || message.chattime || 'Just now';
    
    messageDiv.appendChild(userDiv);
    messageDiv.appendChild(messageText);
    messageDiv.appendChild(timeDiv);
    
    return messageDiv;
}

/**
 * Update online status UI elements
 */
function changeOnlineStatus(isOnline) {
    const onlineColorDiv = document.getElementById('onlineColor');
    const onlineText = document.getElementById('onlineText');
    const offlineInfo = document.getElementById('offlineInfo');
    const offlineInfoText = document.getElementById('offlineInfoText');
    
    if (onlineColorDiv && onlineText) {
        if (isOnline) {
            onlineText.innerHTML = "Online";
            onlineColorDiv.classList.remove("bg-red-500");
            onlineColorDiv.classList.add("bg-green-500");
            if (offlineInfo) offlineInfo.classList.add('hidden');
        } else {
            onlineText.innerHTML = "Offline";
            onlineColorDiv.classList.remove("bg-green-500");
            onlineColorDiv.classList.add("bg-red-500");
            
            if (offlineInfo && offlineInfoText) {
                isUserOwnPlant(plantId, loggedInUser).then(canChatOffline => {
                    if (canChatOffline) {
                        offlineInfoText.textContent = "Offline: You can still message your own plant";
                        offlineInfo.classList.remove('hidden');
                        offlineInfo.classList.add('text-blue-600');
                        offlineInfo.classList.remove('text-red-600');
                    } else {
                        offlineInfoText.textContent = "Offline: Cannot message other users' plants";
                        offlineInfo.classList.remove('hidden');
                        offlineInfo.classList.add('text-red-600');
                        offlineInfo.classList.remove('text-blue-600');
                    }
                }).catch(error => {
                    console.error('Error checking ownership:', error);
                    offlineInfoText.textContent = "Offline: Limited chat functionality";
                    offlineInfo.classList.remove('hidden');
                });
            }
        }
    }
}

