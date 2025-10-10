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

function listenForOnlineSync() {
    if (navigator.onLine) {
        changeOnlineStatus(true);
    } else {
        changeOnlineStatus(false);
    }

    window.addEventListener('online', function () {
        changeOnlineStatus(true);
        console.log("You are online now");
        openSyncChatsIDB().then((db) => {
            getAllSyncChatMessages(db).then((syncChats) => {
                syncChats.forEach((data) => {
                    console.log("Syncing data offline chat", data.value);
                    addChatToDB(data.value);
                    deleteAllSyncPlantsFromIDB(db, data.id);
                });
            });
        });
    });

    window.addEventListener('offline', function () {
        changeOnlineStatus(false);
        console.log("You are offline now");
    });
}

function changeOnlineStatus(isOnline) {
    const onlineColorDiv = document.getElementById('onlineColor');
    const onlineText = document.getElementById('onlineText');
    if (onlineColorDiv && onlineText) {
        if (isOnline) {
            onlineText.innerHTML = "Online";
            onlineColorDiv.classList.add("bg-red-500");
            onlineColorDiv.classList.remove("bg-green-500");
        } else {
            onlineText.innerHTML = "Offline";
            onlineColorDiv.classList.add("bg-red-500");
            onlineColorDiv.classList.remove("bg-green-500");
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

function sendMessage(isSuggestingName = false) {
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

    openSyncChatsIDB().then((db) => {
        addNewChatToSync(db, chatMessage).then((data) => {
            input.value = ""; // Clear input field

            if (navigator.onLine) {
                console.log("Sending chat message:", chatMessage);
                addChatToDB(chatMessage);
                socket.emit("chat", chatMessage);
                deleteSyncChatFromIDB(db, data.id);
            } else {
                console.log("Chat added to sync IDB (offline)");
                renderChatMessage([chatMessage]);
            }
        });
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
