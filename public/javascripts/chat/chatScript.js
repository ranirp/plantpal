/**
 * @fileoverview Real-time chat functionality implementation using Socket.IO.
 * Handles socket connections, message exchange, and offline/online state management.
 */

let socket;
document.addEventListener('DOMContentLoaded', function() {
    console.log("Initializing socket connection...");
    
    // Wait a bit for the page to fully load
    setTimeout(() => {
        // Initialize socket with connection options
        socket = io({
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 10,
            timeout: 20000,
            forceNew: false,
            transports: ['websocket', 'polling'] // Ensure fallback transport
        });
        
        // Socket connection events
        socket.on('connect', async function() {
            console.log('✅ Socket connected successfully');
            // Verify actual server connectivity before updating status
            const actuallyOnline = await checkServerConnectivity();
            updateChatStatus(actuallyOnline);
            // Rejoin room if we have plantId and we're actually online
            if (actuallyOnline && typeof plantId !== 'undefined' && plantId) {
                joinPlantChatRoom();
            }
        });
        
        socket.on('disconnect', function() {
            console.log('❌ Socket disconnected');
            updateChatStatus(false);
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
        
        console.log("Socket.io initialized");
    }, 500);
});

async function updateChatStatus(isOnline) {
    // If socket says we're online, verify actual server connectivity
    if (isOnline) {
        isOnline = await checkServerConnectivity();
    }
    
    const statusDot = document.getElementById('chatStatusDot');
    const statusText = document.getElementById('chatStatusText');
    
    if (isOnline) {
        statusDot.className = 'w-2 h-2 bg-green-500 rounded-full mr-2';
        statusText.textContent = 'Online';
    } else {
        statusDot.className = 'w-2 h-2 bg-red-500 rounded-full mr-2';
        statusText.textContent = 'Offline';
    }
    
    // Also update the general online/offline status
    changeOnlineStatus(isOnline);
}

const urlParams = new URLSearchParams(window.location.search);
var chatMessages = [];

function init() {
    console.log("Initializing chat...");
    
    // Make sure socket is initialized
    if (!socket) {
        console.log("Socket not initialized yet, waiting...");
        setTimeout(init, 500);
        return;
    }
    
    // Check if plantId exists
    if (typeof plantId === 'undefined' || !plantId) {
        console.error("plantId is not defined in init()");
        // Try to get it from URL if possible
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length > 2) {
            plantId = pathParts[2];
            console.log("Extracted plantId from URL:", plantId);
        }
    }
    
    // Check if loggedInUser exists
    if (typeof loggedInUser === 'undefined' || !loggedInUser) {
        console.error("loggedInUser is not defined in init()");
        // Try to get from DOM or set default
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

// Note: checkServerConnectivity is now loaded from utils/connectivityCheck.js

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
    
    // Periodic check every 15 seconds (more responsive)
    setInterval(async () => {
        if (navigator.onLine) {  // Only check server if browser reports online
            const actuallyOnline = await checkServerConnectivity();
            const currentStatus = document.getElementById('chatStatusText')?.textContent === 'Online';
            // Only update if status changed
            if (actuallyOnline !== currentStatus) {
                console.log(`🔄 Chat status changed: ${currentStatus ? 'ONLINE' : 'OFFLINE'} → ${actuallyOnline ? 'ONLINE' : 'OFFLINE'}`);
                updateChatStatus(actuallyOnline);
            }
        }
    }, 15000); // Check every 15 seconds
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
            event.preventDefault(); // Prevent default form submission
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
        username: loggedInUser,
        plantId: plantId,
        chattime: new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''),
    };

    // Check actual connectivity
    const isActuallyOnline = navigator.onLine && await checkServerConnectivity();
    
    if (isActuallyOnline) {
        // Online: Send message - DON'T render immediately
        // Let socket.io broadcast handle rendering for everyone including sender
        input.value = ""; // Clear input field
        console.log("Sending chat message (online):", chatMessage);
        
        // Save to database and emit to socket
        // The socket will broadcast back to everyone, including the sender
        addChatToDB(chatMessage);
        socket.emit("chat", chatMessage);
    } else {
        // Offline: Check if this is user's own plant
        if (await isUserOwnPlant(plantId, loggedInUser)) {
            // User can add messages to their own plants when offline
            input.value = ""; // Clear input field
            console.log("Adding offline message to user's own plant:", chatMessage);
            
            // Store message in IndexedDB for later sync
            openSyncChatsIDB().then((db) => {
                addNewChatToSync(db, chatMessage).then(() => {
                    console.log("Chat message queued for sync");
                    // Only render immediately for offline messages (no socket broadcast)
                    renderChatMessage([chatMessage]);
                });
            });
        } else {
            // Not user's plant - cannot chat offline
            alert("You can only send messages to your own plants when offline \n\nPlease connect to internet to chat with all plants");
            return;
        }
    }
}

// Function to check if the current plant belongs to the logged-in user
async function isUserOwnPlant(plantId, username) {
    try {
        // First try to check from server if online
        if (navigator.onLine) {
            const response = await fetch(`/plantDetails/checkOwnership/${plantId}/${username}`);
            if (response.ok) {
                const data = await response.json();
                return data.isOwner;
            }
        }
        
        // Fallback: check from IndexedDB
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
        return false; // Default to not allowing offline chat if we can't verify
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
        console.log("Received chat message via socket:", message);
        console.log("Message properties:", Object.keys(message));
        console.log("Message content property 'chatmessage':", message.chatmessage);
        console.log("Message content property 'chatMessage':", message.chatMessage);
        renderChatMessage([message]); // Use single message render function
    });
}

function addChatToDB(message) {
    console.log("Sending message to database:", message);
    
    // Use the correct endpoint pattern: /api/chat/plants/{plantId}/messages
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
            // Don't render here - let socket handle it to avoid duplicates
            // The socket will emit back the message to all connected clients
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

function getChatHistory(plantId) {
    console.log("Fetching chat history for plant:", plantId);
    
    // Use the correct endpoint pattern: /api/chat/plants/{plantId}/messages
    const historyEndpoint = `/api/chat/plants/${plantId}/messages`;
    console.log("Using endpoint:", historyEndpoint);
    
    fetch(historyEndpoint)
        .then(async (response) => {
            console.log("Chat history response status:", response.status);
            if (response.ok) {
                return response.json();
            } else {
                throw new Error(`Failed to fetch chat history: ${response.status}`);
            }
        })
        .then((data) => {
            console.log("Chat history data received:", data);
            
            // Handle both response formats
            const chatMessages = data.messages || data;
            
            if (Array.isArray(chatMessages)) {
                console.log(`Fetched ${chatMessages.length} chat messages`);
                renderChatMessages(chatMessages);
            } else {
                console.error("Received invalid chat data format:", data);
                renderChatMessages([]);
            }
        })
        .catch((error) => {
            console.error("Error fetching chat history:", error.message);
            // Try to show offline messages if available
            renderChatMessages([]);
        });
}

function renderChatMessage(messages) {
    // Function to render new messages without clearing existing ones
    try {
        const chatContainer = document.getElementById("chatMessages");
        if (!chatContainer) {
            console.error("Chat container not found!");
            return;
        }

        console.log("Rendering new chat message:", messages);
        console.log("Number of messages to render:", messages.length);

        // Remove no messages div if present
        const noMessagesDiv = document.getElementById("noMessagesDiv");
        if (noMessagesDiv) {
            chatContainer.removeChild(noMessagesDiv);
        }

        messages.forEach((message, index) => {
            console.log(`Processing message ${index}:`, message);
            // Handle both chattime and chatTime formats
            let chatTime = new Date(message.chattime || message.chatTime);
            let formattedChatTime = chatTime.toLocaleString("en-US", {
                month: "long",
                day: "numeric", 
                year: "numeric",
                hour: "numeric",
                minute: "numeric",
                hour12: true,
            });
            message.chatTime = formattedChatTime;
            console.log("About to create chat message div for:", message);
            const chatMessageDiv = createChatMessageDiv(message);
            console.log("Created chat message div:", chatMessageDiv);
            chatContainer.appendChild(chatMessageDiv);
        });

        // Scroll to the bottom of the chat container
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) {
        console.error("Error rendering chat message:", error.message);
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
                // Handle both chattime and chatTime formats
                let chatTime = new Date(message.chattime || message.chatTime);
                let formattedChatTime = chatTime.toLocaleString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                });
                message.chatTime = formattedChatTime;
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
