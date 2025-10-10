// Constants for chat and chat messages
const CHAT_IDB_NAME = "chatIDB";
const CHAT_IDB_STORE = "chatMessages";
const SYNC_CHAT_STORE_NAME = "chats";
const SYNC_CHAT_EVENT = "chat";

const addNewChatToSync = (syncChatTDB, message) => {
    return new Promise((resolve, reject) => {
        const transaction = syncChatTDB.transaction([SYNC_CHAT_STORE_NAME], "readwrite");
        const chatStore = transaction.objectStore(SYNC_CHAT_STORE_NAME);
        const addRequest = chatStore.add({ value: message});
        addRequest.addEventListener("success", () => {
            console.log("Added" + "#" + addRequest.result + ": " + message);
            const getRequest = chatStore.get(addRequest.result);
            getRequest.addEventListener("success", () => {
                resolve(getRequest.result);
            });
            getRequest.addEventListener("error", (event) => {
                reject(event.target.error);
            });
            addRequest.addEventListener("error", (event) => {
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
