const { render } = require("ejs");
const chatMessage = require("../../../server/models/chatModel");

let socket = io();
const urlParams = new URLSearchParams(window.location.search);
var chatMessages = [];

function init() {
    joinPlantChatRoom();
    getChatHistory(plantId);
    registerSocket();
    registerFormSubmit();
    listenForOnlineSync();
}

// Function to check actual server connectivity
async function checkServerConnectivity() {
    if (!navigator.onLine) {
        return false; // If browser says offline, don't bother checking
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced timeout
        
        const response = await fetch("/api/plants/getAllPlants?check=true", {
            method: "GET",
            cache: "no-cache",
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.log("Server connectivity check failed:", error.message);
        return false;
    }
}

function listenForOnlineSync() {
    // Check initial status with server connectivity
    console.log("🔍 Checking initial connectivity for chat...");
    checkServerConnectivity().then(isOnline => {
        console.log(`Chat connectivity check: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        changeOnlineStatus(isOnline);
    });

    window.addEventListener('online', async function () {
        console.log("🌐 Navigator reports online, checking server connectivity...");
        // Add a small delay to let network stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
        const actuallyOnline = await checkServerConnectivity();
        changeOnlineStatus(actuallyOnline);
        
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
        changeOnlineStatus(false);
        console.log("❌ You are offline now");
    });
    
    // More aggressive periodic check every 10 seconds
    setInterval(async () => {
        const actuallyOnline = await checkServerConnectivity();
        const currentStatus = document.getElementById('onlineText')?.innerHTML === 'Online';
        // Only update if status changed
        if (actuallyOnline !== currentStatus) {
            console.log(`🔄 Chat status changed: ${currentStatus ? 'ONLINE' : 'OFFLINE'} → ${actuallyOnline ? 'ONLINE' : 'OFFLINE'}`);
            changeOnlineStatus(actuallyOnline);
        }
    }, 10000); // Check every 10 seconds
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
        // Online: Send message directly
        input.value = ""; // Clear input field
        console.log("Sending chat message (online):", chatMessage);
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
                    renderChatMessage([chatMessage]); // Show message immediately in UI
                });
            });
        } else {
            // Not user's plant - cannot chat offline
            alert("You can only send messages to your own plants when offline.\n\nWhen offline, you can:\n✅ Message plants you created\n❌ Not message other users' plants\n\nPlease connect to internet to chat with all plants.");
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
        const db = await openSyncPlantIDB();
        const plants = await getAllSyncPlants(db);
        const plant = plants.find(p => {
            const plantData = p.value || p;
            return (plantData._id === plantId || p.id === plantId) && plantData.nickname === username;
        });
        
        return !!plant;
    } catch (error) {
        console.error("Error checking plant ownership:", error);
        return false; // Default to not allowing offline chat if we can't verify
    }
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
        console.log("Received chat message:", message);
        renderChatMessages([message]);
    });
}

function addChatToDB(message) {
    fetch('/chat/addChatMessage', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chatMessage: message,
        }),
    })
        .then(async (response) => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error("Failed to add chat message");
            }
        })
        .then((chatMessage) => {
            console.log("Chat message added to DB:", chatMessage);
        })
        .catch((error) => {
            console.error("Error adding chat message to DB:", error.message);
        });
}

function joinPlantChatRoom() {
    console.log("Joining plant chat room:");
    var roomNo = plantId;
    var name = loggedInUser;
    socket.emit("create or join", roomNo, name);
}

function getChatHistory(plantId) {
    fetch(`/chat/getChatMessages/${plantId}`)
        .then(async (response) => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error("Failed to fetch chat history");
            }
        })
        .then((chatMessages) => {
            console.log("Chat history fetched:", chatMessages);
            renderChatMessages(chatMessages);
        })
        .catch((error) => {
            console.error("Error fetching chat history:", error.message);
        });
}

function renderChatMessages(messages) {
    try {
        const chatContainer = document.getElementById("chatmessages");
        if (!chatContainer) 
            return;

        // Clear no messages div if present
        const noMessagesDiv = document.getElementById("noMessagesDiv");
        if (noMessagesDiv) {
            chatContainer.removeChild(noMessagesDiv);
        }

        if (chatMessages.length === 0) {
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
            noMessagesText.classList.add("text-lg", "text-gray-500");
            noMessagesText.textContent = "No messages yet. Start the conversation!";

            noMessagesDiv.appendChild(noMessagesImg);
            noMessagesDiv.appendChild(noMessagesText);
            chatContainer.appendChild(noMessagesDiv);
        } else {
            chatMessages.forEach((message) => {
                let chatTime = new Date(message.chattime);
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
