const { create } = require("../../../server/models/chatModel");

function createChatMessageElement(message) {
    const chatMessageDiv = document.createElement("div");
    chatMessageDiv.classList.add(
        "chat",
        message.userName === loggedInUser ? "chat-end" : "chat-start"
    );

    const chatImageDiv = document.createElement("div");
    chatImageDiv.classList.add("chat-image", "avatar");
    chatImageDiv.innerHTML = `
        <div class="avatar placeholder rounded-full border bg-neutral p-1">
            <div class="text-neutral-content rounded-full bg-white w-8">
                <span class="text font-extrabold text-neutral">${message.userName
                    .substring(0, 2)
                    .toUpperCase()}</span>
            </div>
        </div>
    `;

    const chatHeaderDiv = document.createElement("div");
    chatHeaderDiv.classList.add("chat-header");
    chatHeaderDiv.textContent = message.userName;

    const chatBubbleDiv = createChatBubble(message);
    const chatFooterDiv = createChatFooter(message);

    // Append elements to chat container
    chatMessageDiv.appendChild(chatImageDiv);
    chatMessageDiv.appendChild(chatHeaderDiv);
    chatMessageDiv.appendChild(chatBubbleDiv);
    chatMessageDiv.appendChild(chatFooterDiv);

    return chatMessageDiv;
}

function createChatBubble(message) {
    const chatBubbleDiv = document.createElement("div");
    chatBubbleDiv.classList.add("chat-bubble", "shadow");

    // Creating and appending the message text element
    const messageText = document.createElement("span");
    messageText.textContent = message.chatMessage;
    
    chatBubbleDiv.appendChild(messageText);
    return chatBubbleDiv;
}

function createChatFooter(chat) {
    const chatFooterDiv = document.createElement("div");
    if (chat.userName === loggedInUser) {
        chatFooterDiv.classList.add("chat-footer", "flex", "flex-col", "items-end");
    } else {
        chatFooterDiv.classList.add("chat-footer", "flex", "flex-col", "items-start");
    }

    // Creating and appending the timestamp element
    const timestamp = document.createElement("time");
    timeElement.className = "text-xs opacity-50";
    timeElement.textContent = chat.chatTime.toLocaleString();
    chatFooterDiv.appendChild(timestamp);

    return chatFooterDiv;
}