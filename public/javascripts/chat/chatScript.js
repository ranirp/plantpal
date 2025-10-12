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

let socket;
let socketInitAttempts = 0;
let statusUpdateDebounceTimer = null;
let connectionStable = false;
let lastStatusUpdate = null;

/**
 * Initialize chat system when DOM is ready.
 * Delays initialization to ensure all required scripts are loaded.
 * Creates socket connection and calls init function when ready.
 */
/**
 * Update chat header with formatted plant name
 */
function updateChatHeader() {
    const chatHeaderElement = document.querySelector('.text-xl.font-medium');
    if (chatHeaderElement) {
        const plantName = chatHeaderElement.textContent.replace('Chat on: ', '').trim();
        chatHeaderElement.textContent = `Chat on: ${formatPlantName(plantName)}`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("Chat DOM loaded, waiting for scripts to initialize...");
    
    // Format plant name in chat header
    updateChatHeader();
    
    // Delay initialization to ensure dependencies are loaded
    setTimeout(() => {
        initializeSocket();
        // Call init function after socket is initialized
        if (typeof init === 'function') {
            init();
        } else {
            setTimeout(() => {
                if (typeof init === 'function') {
                    init();
                } else {
                    console.error("Chat init function not available after waiting");
                }
            }, 1500);
        }
    }, 1000);
});

/**
 * Initialize Socket.IO connection with connectivity validation.
 * Implements retry logic and connection stability monitoring.
 * Debounces status updates to prevent UI flickering.
 */
async function initializeSocket() {
    // Ensure we're not initializing multiple times
    if (socket) {
        console.log("Socket already initialized, skipping");
        return;
    }
    
    console.log("Initializing socket connection...");
    
    // Make sure connectivity check is available
    if (typeof checkServerConnectivity !== 'function') {
        socketInitAttempts++;
        if (socketInitAttempts > 10) {
            console.error("Failed to initialize socket: checkServerConnectivity function not available");
            updateChatStatus(navigator.onLine); // Fall back to navigator.onLine
            return;
        }
        console.log(`Waiting for connectivity check script (attempt ${socketInitAttempts}/10)...`);
        setTimeout(initializeSocket, 500);
        return;
    }
    
    // Check actual server connectivity before initializing socket
    try {
        const hasConnectivity = await checkServerConnectivity();
        console.log(`Server connectivity check: ${hasConnectivity ? 'ONLINE' : 'OFFLINE'}`);
        
        // Initialize socket with improved connection options and path-relative URL
        socket = io({
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 2000,      
            reconnectionDelayMax: 10000,  
            reconnectionAttempts: 5,      
            timeout: 20000,
            forceNew: true,
            transports: ['websocket', 'polling'],
            forceNew: false,
            transports: ['websocket', 'polling']
        });
        
        // Socket connection events with debounced status updates
        socket.on('connect', async function() {
            console.log('✅ Socket connected successfully');
            
            // Use a debounce mechanism to avoid frequent UI changes
            clearTimeout(statusUpdateDebounceTimer);
            statusUpdateDebounceTimer = setTimeout(async () => {
                const actuallyOnline = await checkServerConnectivity();
                if (connectionStable || Date.now() - (lastStatusUpdate || 0) > 5000) {
                    updateChatStatus(actuallyOnline);
                    
                    // Rejoin room if we're actually online and have a plantId
                    if (actuallyOnline && typeof plantId !== 'undefined' && plantId) {
                        joinPlantChatRoom();
                    }
                    connectionStable = true;
                    lastStatusUpdate = Date.now();
                }
            }, 1000);
        });
        
        socket.on('disconnect', function() {
            console.log('❌ Socket disconnected');
            
            // Use a debounce mechanism to avoid frequent UI changes
            clearTimeout(statusUpdateDebounceTimer);
            statusUpdateDebounceTimer = setTimeout(() => {
                if (connectionStable || Date.now() - (lastStatusUpdate || 0) > 5000) {
                    updateChatStatus(false);
                    connectionStable = false;
                    lastStatusUpdate = Date.now();
                }
            }, 3000); 
        });
        
        socket.on('connect_error', function(error) {
            console.error('❌ Socket connection error:', error);
        });
        
        socket.on('reconnect', function() {
            console.log('🔄 Socket reconnected');
            // Rejoin room after reconnection 
            if (typeof plantId !== 'undefined' && plantId) {
                joinPlantChatRoom();
            }
        });
        
        console.log("Socket.io initialized successfully");
        
    } catch (error) {
        console.error("Error during socket initialization:", error);
        updateChatStatus(false);
    }
}

/**
 * Update chat UI status with debounce to prevent flickering
 * @param {boolean} isOnline - Whether the chat is currently online
 */
async function updateChatStatus(isOnline) {
    if (lastStatusUpdate && Date.now() - lastStatusUpdate < 3000) {
        console.log("🔄 Skipping rapid status update to prevent flickering");
        return;
    }
    
    if (isOnline && typeof checkServerConnectivity === 'function') {
        isOnline = await checkServerConnectivity();
    }
    
    const statusDot = document.getElementById('chatStatusDot');
    const statusText = document.getElementById('chatStatusText');
    
    if (!statusDot || !statusText) {
        console.error("Chat status elements not found in DOM");
        return;
    }
    
    if (isOnline) {
        statusDot.className = 'w-2 h-2 bg-green-500 rounded-full mr-2';
        statusText.textContent = 'Online';
    } else {
        statusDot.className = 'w-2 h-2 bg-red-500 rounded-full mr-2';
        statusText.textContent = 'Offline';
    }
    
    if (typeof changeOnlineStatus === 'function') {
        changeOnlineStatus(isOnline);
    }
    
    lastStatusUpdate = Date.now();
    console.log(`Chat status updated to: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
}

const urlParams = new URLSearchParams(window.location.search);
var chatMessages = [];

// Add a global function to refresh chat
window.refreshChat = function() {
    console.log("🔄 Chat refresh function called but is now deprecated");
}

// Make these functions globally accessible
window.init = function() {
    console.log("Initializing chat...");
    
    // Socket is initialized
    if (!socket) {
        console.log("Socket not initialized yet, waiting...");
        setTimeout(init, 500);
        return;
    }
    
    // Check if plantId exists
    if (typeof plantId === 'undefined' || !plantId) {
        console.error("plantId is not defined in init()");
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length > 2) {
            plantId = pathParts[2];
            console.log("Extracted plantId from URL:", plantId);
        }
    }
    
    // Check if loggedInUser exists
    if (typeof loggedInUser === 'undefined' || !loggedInUser) {
        console.error("loggedInUser is not defined in init()");
        loggedInUser = "Guest";
    }
    
    console.log("Chat initialized with plantId:", plantId, "user:", loggedInUser);
    
    getChatHistory(plantId);
    registerSocket();
    registerFormSubmit();
    listenForOnlineSync();
    
    // Join room after socket is connected
    if (socket && socket.connected) {
        joinPlantChatRoom();
    } else {
        // Wait for socket to connect
        socket.on('connect', function() {
            joinPlantChatRoom();
        });
    }
}

function listenForOnlineSync() {
    // Check initial status with server connectivity
    console.log("🔍 Checking initial connectivity for chat...");
    checkServerConnectivity().then(isOnline => {
        console.log(`Chat connectivity check: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        updateChatStatus(isOnline);
    });

    window.addEventListener('online', async function () {
        console.log("🌐 Navigator reports online, checking server connectivity...");
        // Add a small delay to let network stabilize
        await new Promise(resolve => setTimeout(resolve, 1500));
        const actuallyOnline = await checkServerConnectivity();
        updateChatStatus(actuallyOnline);
        
        if (actuallyOnline) {
            console.log("✅ You are online now - syncing offline chat messages");
            
            // Sync offline chat messages
            openSyncChatsIDB().then((db) => {
                getAllSyncChatMessages(db).then((syncChats) => {
                    if (syncChats.length > 0) {
                        console.log(`📤 Found ${syncChats.length} offline chat messages to sync`);
                        syncChats.forEach((data) => {
                            console.log("Syncing offline chat message:", data.value);
                            addChatToDB(data.value);
                            deleteSyncChatFromIDB(db, data.id);
                        });
                    } else {
                        console.log("No offline chat messages to sync");
                    }
                });
            });
        } else {
            console.log("⚠️  Navigator says online but server is unreachable");
        }
    });

    window.addEventListener('offline', function () {
        updateChatStatus(false);
        console.log("❌ You are offline now");
    });
    
    // Periodic check every 15 seconds 
    setInterval(async () => {
        if (navigator.onLine) { 
            const actuallyOnline = await checkServerConnectivity();
            const currentStatus = document.getElementById('chatStatusText')?.textContent === 'Online';
            if (actuallyOnline !== currentStatus) {
                console.log(`🔄 Chat status changed: ${currentStatus ? 'ONLINE' : 'OFFLINE'} → ${actuallyOnline ? 'ONLINE' : 'OFFLINE'}`);
                updateChatStatus(actuallyOnline);
            }
        }
    }, 15000);
}

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
            
            // Show offline info and check if user can chat
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
                });
            }
        }
    }
}

function registerFormSubmit() {
    const chatForm = document.getElementById("chatForm");
    if (chatForm) {
        chatForm.addEventListener("submit", function (event) {
            event.preventDefault(); 
            sendMessage();
        });
    } else {
        console.error("Chat form not found!");
    }
}

async function sendMessage(isSuggestingName = false) {
    var input = document.getElementById("chatInput");
    if (!input || input.value.trim() === "") {
        return;
    }
    
    var chatMessage = {
        chatmessage: input.value.trim(),
        chatMessage: input.value.trim(),  
        username: loggedInUser,
        userName: loggedInUser,  
        plantId: plantId,
        chattime: new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''),
        chatTime: new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''),
    };

    // Check actual connectivity
    const isActuallyOnline = navigator.onLine && await checkServerConnectivity();
    
    if (isActuallyOnline) {
        input.value = ""; 
        console.log("Sending chat message (online):", chatMessage);
        
        addChatToDB(chatMessage);
        socket.emit("chat", chatMessage);
    } else {
        if (await isUserOwnPlant(plantId, loggedInUser)) {
            input.value = ""; 
            console.log("📱 Adding offline message to user's own plant:", chatMessage);
            
            try {
                chatMessage.__offlineCreated = true;
                chatMessage.__syncStatus = 'pending';
                chatMessage.__timestamp = Date.now();
                
                const db = await getChatDatabase(); 
                
                // Store in pending sync
                await addNewChatToSync(db, chatMessage);
                console.log("📦 Chat message queued for sync");
                
                try {
                    const cachedMessages = await getCachedChatMessages(plantId);
                    cachedMessages.push(chatMessage);
                    await cacheChatMessages(plantId, cachedMessages);
                    console.log("📦 Updated offline chat cache with new message");
                } catch (cacheError) {
                    console.error("❌ Error updating chat cache:", cacheError);
                }
                
                // Display message immediately for offline use
                console.log("📱 Displaying offline message in UI...");
                renderChatMessage([chatMessage]);
                console.log("✅ Offline message displayed successfully");
                
            } catch (error) {
                console.error("❌ Error saving offline message:", error);
                if (typeof showNotification === 'function') {
                    showNotification("Failed to save your message for later sync. Please try again.", 'error');
                } else {
                    alert("Failed to save your message for later sync. Please try again.");
                }
            }
        } else {
            if (typeof showNotification === 'function') {
                showNotification("⚠️ Offline Mode Restriction\n\nYou can only send messages to plants that you added when offline.\n\nPlease connect to the internet to chat about all plants.", 'info');
            } else {
                alert("⚠️ Offline Mode Restriction\n\nYou can only send messages to plants that you added when offline.\n\nPlease connect to the internet to chat about all plants.");
            }
            return;
        }
    }
}

// Function to check if the current plant belongs to the logged-in user
async function isUserOwnPlant(plantId, username) {
    try {
        if (navigator.onLine) {
            const response = await fetch(`/plantDetails/checkOwnership/${plantId}/${username}`);
            if (response.ok) {
                const data = await response.json();
                return data.isOwner;
            }
        }
        
        try {
            const db = await openSyncPlantIDB();
            const plants = await getAllSyncPlants(db);
            const plant = plants.find(p => {
                const plantData = p.value || p;
                return (plantData._id === plantId || p.id === plantId) && plantData.nickname === username;
            });
            
            return !!plant;
        } catch (idbError) {
            console.log('IndexedDB fallback failed:', idbError);
            return false;
        }
    } catch (error) {
        console.error("Error checking plant ownership:", error);
        return false; 
    }
}

// Placeholder functions for plant IndexedDB operations
async function openSyncPlantIDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('plants', 1);
        
        request.onerror = function (event) {
            reject(new Error(`Database error: ${event.target}`));
        };
        
        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('plants')) {
                db.createObjectStore('plants', {
                    keyPath: 'id',
                    autoIncrement: true,
                });
            }
        };
        
        request.onsuccess = function (event) {
            const db = event.target.result;
            resolve(db);
        };
    });
}

async function getAllSyncPlants(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['plants'], 'readonly');
        const store = transaction.objectStore('plants');
        const request = store.getAll();
        
        request.onsuccess = function() {
            resolve(request.result || []);
        };
        
        request.onerror = function() {
            reject(request.error);
        };
    });
}

function registerSocket() {
    // Make sure socket exists before registering events
    if (!socket) {
        console.error("Cannot register socket events - socket not initialized");
        setTimeout(registerSocket, 1000); 
        return;
    }
    
    console.log("🔄 Registering socket event handlers...");
    
    // Remove any existing handlers to avoid duplicates
    socket.off("joined");
    socket.off("left");
    socket.off("chatmessage");
    
    // Now register the event handlers
    socket.on("joined", function (room, userId, totalUsers) {
        if (userId === loggedInUser) {
            console.log("You joined the room");
        } else {
            console.log("Someone joined the room");
        }
    });

    socket.on("left", function (room, userId, totalUsers) {
        console.log("user" + userId + " left the room: " + room);
    });

    socket.on("chatmessage", function (message) {
        console.log("🎯 Received chat message via socket:", message);
        console.log("🎯 Message properties:", Object.keys(message));
        
        // Normalize the message properties
        if (message.chatmessage && !message.chatMessage) message.chatMessage = message.chatmessage;
        if (message.chatMessage && !message.chatmessage) message.chatmessage = message.chatMessage;
        if (message.username && !message.userName) message.userName = message.username;
        if (message.userName && !message.username) message.username = message.userName;
        if (message.chattime && !message.chatTime) message.chatTime = message.chattime;
        if (message.chatTime && !message.chattime) message.chattime = message.chatTime;
        
        console.log("Normalized message:", message);
        
        // Render message only once
        renderChatMessage([message]);
    });
}

function addChatToDB(message) {
    console.log("Sending message to database:", message);
    
    const chatEndpoint = `/api/chat/plants/${message.plantId}/messages`;
    console.log("Using endpoint:", chatEndpoint);
    
    fetch(chatEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chatmessage: message.chatmessage,
            username: message.username,
            plantId: message.plantId,
            chattime: message.chattime
        })
    })
    .then(response => {
        console.log("Chat response status:", response.status);
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('✅ Chat message saved to database:', data);
        } else {
            console.error('❌ Failed to save chat message:', data);
        }
    })
    .catch(error => {
        console.error('❌ Error saving chat message:', error);
    });
}

function joinPlantChatRoom() {
    console.log("Joining plant chat room:");
    if (typeof plantId === 'undefined') {
        console.error('plantId is not defined');
        return;
    }
    
    if (!socket || !socket.connected) {
        console.log('Socket not connected, waiting...');
        // Wait for socket to connect
        if (socket) {
            socket.on('connect', function() {
                console.log('Socket connected, now joining room');
                var roomNo = plantId;
                var name = loggedInUser;
                socket.emit("createorjoin", roomNo, name);
            });
        }
        return;
    }
    
    var roomNo = plantId;
    var name = loggedInUser;
    console.log(`Joining room ${roomNo} as ${name}`);
    socket.emit("createorjoin", roomNo, name);
}

/**
 * Format plant name with title case (first letter of each word capitalized)
 * @param {string} name - Plant name to format
 * @returns {string} Formatted plant name
 */
function formatPlantName(name) {
    if (!name) return '';
    return name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Process plant form submission.
 */

async function getChatHistory(plantID) {
    let messageContainer = document.getElementById("chatMessages");
    
    if (!messageContainer) {
        console.error("❌ Chat container not found! Looking for element with ID 'chatMessages'");
        return;
    }
    
    // Update the page to show we're fetching data
    messageContainer.innerHTML = `
        <div class="flex justify-center items-center p-4">
            <div class="spinner"></div>
            <span class="ml-2">Loading messages...</span>
        </div>
    `;

    console.log("Fetching chat history for plant:", plantID);
    
    // First check if we're online
    const isOnline = await checkServerConnectivity();
    
    if (isOnline) {
        console.log("🌐 Online - fetching chat messages from server");
        
        // Fetch chat messages from the server
        fetch(`/api/chat/${plantID}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                return response.json();
            })
            .then(async data => {
                chatMessages = data.messages;
                console.log(`✅ Received ${chatMessages.length} messages from server`);
                
                // Cache messages for offline viewing
                try {
                    await cacheChatMessages(plantID, chatMessages);
                    console.log("📦 Successfully cached chat messages for offline use");
                } catch (error) {
                    console.warn("⚠️ Failed to cache chat messages:", error);
                }
                
                renderChatMessages(chatMessages);
            })
            .catch(async error => {
                console.error("❌ Error fetching chat history:", error);
                // Try to load from cache if server request fails
                try {
                    const cachedMessages = await getCachedChatMessages(plantID);
                    if (cachedMessages.length > 0) {
                        console.log(`📦 Using ${cachedMessages.length} cached messages`);
                        chatMessages = cachedMessages;
                        renderChatMessages(chatMessages);
                    } else {
                        await showOfflineMessage(messageContainer);
                    }
                } catch (cacheError) {
                    console.error("❌ Error retrieving cached messages:", cacheError);
                    await showOfflineMessage(messageContainer);
                }
            });
    } else {
        console.log("🔴 Offline - checking for cached messages");
        
        // Try to load from cache since we're offline
        try {
            const cachedMessages = await getCachedChatMessages(plantID);
            if (cachedMessages.length > 0) {
                console.log(`📦 Using ${cachedMessages.length} cached messages (offline)`);
                chatMessages = cachedMessages;
                renderChatMessages(chatMessages);
            } else {
                await showOfflineMessage(messageContainer);
            }
        } catch (error) {
            console.error("❌ Error retrieving cached messages:", error);
            await showOfflineMessage(messageContainer);
        }
    }
}

async function showOfflineMessage(container) {
    const isOnline = typeof checkServerConnectivity === 'function' 
        ? await checkServerConnectivity() 
        : navigator.onLine;
    
    const message = isOnline 
        ? 'No messages yet. Be the first to start the conversation!'
        : "You're offline. Chat messages will be sent when you're back online.";
    
    const iconClass = isOnline ? 'text-blue-500' : 'text-yellow-500';
    const iconName = isOnline ? 'fa-comments' : 'fa-exclamation-circle';
    
    container.innerHTML = `
        <div class="p-4 text-center">
            <div class="${iconClass}">
                <i class="fas ${iconName} text-xl"></i>
            </div>
            <p class="mt-2">
                ${message}
            </p>
        </div>
    `;
}

function renderChatMessage(messages) {
    // Function to render new messages without clearing existing ones
    try {
        const chatContainer = document.getElementById("chatMessages");
        if (!chatContainer) {
            console.error("❌ Chat container not found! Looking for element with ID 'chatMessages'");
            // Try to find any chat container as a fallback
            const possibleContainers = document.querySelectorAll('.chat-container, .message-container');
            if (possibleContainers.length > 0) {
                console.log("Found possible alternative container:", possibleContainers[0]);
                chatContainer = possibleContainers[0];
            } else {
                console.error("No chat container alternatives found. Cannot render messages.");
                return;
            }
        }

        console.log("🟢 Rendering new chat message:", messages);
        console.log("🔢 Number of messages to render:", messages.length);

        // Remove no messages div if present
        const noMessagesDiv = document.getElementById("noMessagesDiv");
        if (noMessagesDiv) {
            chatContainer.removeChild(noMessagesDiv);
        }

        messages.forEach((message, index) => {
            console.log(`Processing message ${index}:`, message);
            
            // Ensure consistent property names
            if (!message.username && message.userName) message.username = message.userName;
            if (!message.userName && message.username) message.userName = message.username;
            if (!message.chatMessage && message.chatmessage) message.chatMessage = message.chatmessage;
            if (!message.chatmessage && message.chatMessage) message.chatmessage = message.chatMessage;
            
            if (message.chatTime && !message.chatTime.includes(',')) {
            } else if (message.chattime || message.chatTime) {
                let chatTime = new Date(message.chattime || message.chatTime);
                if (!isNaN(chatTime.getTime())) {
                    let formattedChatTime = chatTime.toLocaleString("en-US", {
                        month: "long",
                        day: "numeric", 
                        year: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                        hour12: true,
                    });
                    message.chatTime = formattedChatTime;
                    message.chattime = formattedChatTime;
                } else {
                    message.chatTime = message.chattime || message.chatTime || 'Just now';
                }
            } else {
                let chatTime = new Date();
                let formattedChatTime = chatTime.toLocaleString("en-US", {
                    month: "long",
                    day: "numeric", 
                    year: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                });
                message.chatTime = formattedChatTime;
                message.chattime = formattedChatTime;
            }
            
            console.log("About to create chat message div for:", message);
            
            const chatMessageDiv = createChatMessageDiv(message);
            console.log("Created chat message div:", chatMessageDiv);
            chatContainer.appendChild(chatMessageDiv);
        });

        // Scroll to the bottom of the chat container
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) {
        console.error("Error rendering chat message:", error);
        console.error("Stack trace:", error.stack);
    }
}

function renderChatMessages(messages) {
    try {
        const chatContainer = document.getElementById("chatMessages");
        if (!chatContainer) {
            console.error("Chat container not found!");
            return;
        }

        console.log("Rendering chat messages:", messages);

        // Clear no messages div if present
        const noMessagesDiv = document.getElementById("noMessagesDiv");
        if (noMessagesDiv) {
            chatContainer.removeChild(noMessagesDiv);
        }

        if (!messages || messages.length === 0) {
            const noMessagesDiv = document.createElement("div");
            noMessagesDiv.id = "noMessagesDiv";
            noMessagesDiv.classList.add(
                "flex",
                "flex-col",
                "w-full",
                "h-full",
                "items-center",
                "place-content-center",
            );

            const noMessagesImg = document.createElement("img");
            noMessagesImg.src = "/images/chat.jpg";
            noMessagesImg.classList.add("w-80");

            const noMessagesText = document.createElement("div");
            noMessagesText.classList.add("text-lg", "text-gray-500", "text-center");
            noMessagesText.innerHTML = "No messages yet <br> Start the conversation!";
            
            noMessagesDiv.appendChild(noMessagesImg);
            noMessagesDiv.appendChild(noMessagesText);
            chatContainer.appendChild(noMessagesDiv);
        } else {
            // Clear the chat container first to prevent duplicate messages
            chatContainer.innerHTML = '';
            
            messages.forEach((message) => {
                // Ensure consistent property names
                if (message.chatmessage && !message.chatMessage) message.chatMessage = message.chatmessage;
                if (message.chatMessage && !message.chatmessage) message.chatmessage = message.chatMessage;
                if (message.username && !message.userName) message.userName = message.username;
                if (message.userName && !message.username) message.username = message.userName;
                
                // Handle both chattime and chatTime formats
                let chatTime;
                if (message.chattime || message.chatTime) {
                    chatTime = new Date(message.chattime || message.chatTime);
                } else {
                    // If no timestamp, use current time
                    chatTime = new Date();
                }
                
                let formattedChatTime = chatTime.toLocaleString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                });
                
                message.chatTime = formattedChatTime;
                message.chattime = formattedChatTime;
                
                console.log("Rendering message with properties:", Object.keys(message));
                console.log("Message content:", message.chatMessage || message.chatmessage);
                console.log("Message user:", message.username || message.userName);
                
                const chatMessageDiv = createChatMessageDiv(message);
                chatContainer.appendChild(chatMessageDiv);
            });

            // Scroll to the bottom of the chat container
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    } catch (error) {
        console.error("Error rendering chat messages:", error.message);
    }
}
