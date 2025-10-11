/**
 * @fileoverview Chat message rendering utilities.
 * Creates styled message bubbles with avatars, timestamps, and alignment.
 * Differentiates between own messages (right-aligned) and others (left-aligned).
 * 
 * Key Features:
 * - Avatar generation with user initials
 * - Message alignment based on ownership
 * - Timestamp formatting
 * - Color-coded message bubbles
 * - Responsive design with Tailwind classes
 */

/**
 * Create styled chat message element with avatar and formatting.
 * Right-aligns user's own messages, left-aligns others' messages.
 * 
 * @param {Object} message - Message object with username, text, timestamp
 * @returns {HTMLElement} Formatted message div element
 */
function createChatMessageDiv(message) {
    console.log("Creating message div with:", message);
    const chatContainer = document.createElement("div");
    
    const username = message.username || message.userName || 'Unknown';
    const isOwnMessage = username === loggedInUser;
    
    console.log("Message from:", username, "logged in user:", loggedInUser, "is own:", isOwnMessage);
    
    // Create message container with proper alignment
    chatContainer.classList.add("mb-2", "flex", "items-center", "gap-2", isOwnMessage ? "justify-end" : "justify-start");

    // Create avatar with initials inside colored circle
    const avatar = document.createElement("div");
    avatar.classList.add("avatar", "placeholder");
    avatar.style.marginTop = "-16px";

    const avatarInner = document.createElement("div");
    avatarInner.classList.add("rounded-full", "w-10", "h-10", "flex", "items-center", "justify-center");

    const initials = username.substring(0, 2).toUpperCase();

    const avatarText = document.createElement("span");
    avatarText.classList.add("text-sm", "font-bold");
    avatarText.textContent = initials;

    // Set colors based on message ownership
    if (isOwnMessage) {
        avatarInner.style.backgroundColor = "#8b5cf6"; 
        avatarText.style.color = "#ffffff"; 
    } else {
        avatarInner.style.backgroundColor = "#f3f4f6"; 
        avatarText.style.color = "#4b5563"; 
        avatarInner.style.border = "2px solid #9ca3af"; 
    }

    avatarInner.appendChild(avatarText);
    avatar.appendChild(avatarInner);
    
    // Create message wrapper
    const messageWrapper = document.createElement("div");
    messageWrapper.classList.add("max-w-xs", "lg:max-w-md");
    
    // Create message bubble
    const messageBubble = document.createElement("div");
    messageBubble.classList.add("messenger-bubble", "px-4", "py-2", "rounded-2xl", "shadow-sm", "text-sm", "leading-relaxed", "relative");

    // Apply different styles for own vs others' messages
    if (isOwnMessage) {
        messageBubble.classList.add("bg-gradient-to-r", "from-purple-400", "to-purple-500", "text-white", "rounded-xl", "message-bubble-right");
        messageBubble.style.background = "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)";
    } else {
        messageBubble.classList.add("bg-gray-200", "text-gray-800", "rounded-xl", "message-bubble-left");
        messageBubble.style.background = "#e5e7eb";
    }
    
    // Add message text 
    const messageText = document.createElement("span");
    const textContent = message.chatmessage || message.chatMessage || message.message || '';
    console.log("Message content:", textContent);
    messageText.textContent = textContent;
    messageBubble.appendChild(messageText);
    
    // Create user info 
    if (!isOwnMessage) {
        const userInfo = document.createElement("div");
        userInfo.classList.add("text-xs", "text-gray-500", "mb-1", "ml-1", "font-medium");
        userInfo.textContent = message.username || message.userName;
        messageWrapper.appendChild(userInfo);
    }
    
    messageWrapper.appendChild(messageBubble);
    
    // Create timestamp
    const timestamp = document.createElement("div");
    timestamp.classList.add("text-xs", "text-gray-400", "mt-1", "px-2");
    timestamp.style.textAlign = isOwnMessage ? "right" : "left";
    timestamp.textContent = message.chatTime;
    messageWrapper.appendChild(timestamp);

    // Append avatar and message wrapper to container
    if (isOwnMessage) {
        chatContainer.appendChild(messageWrapper);
        chatContainer.appendChild(avatar);
    } else {
        chatContainer.appendChild(avatar);
        chatContainer.appendChild(messageWrapper);
    }
    
    return chatContainer;
}

// Legacy function for compatibility 
function createChatBubble(message) {
    const chatBubbleDiv = document.createElement("div");
    chatBubbleDiv.classList.add("chat-bubble", "shadow", 'rounded-2xl');

    // Creating and appending the message text element
    const messageText = document.createElement("span");
    
    // Debug: Log the message object to see what properties it has
    console.log("Creating chat bubble for message:", message);
    console.log("Available properties:", Object.keys(message));
    
    // Handle both chatmessage and chatMessage property names
    const textContent = message.chatmessage || message.chatMessage || message.message || '';
    console.log("Message text content:", textContent);
    
    messageText.textContent = textContent;
    
    chatBubbleDiv.appendChild(messageText);
    return chatBubbleDiv;
}

// Legacy function for compatibility
function createChatFooter(chat) {
    const chatFooterDiv = document.createElement("div");
    if ((chat.username || chat.userName) === loggedInUser) {
        chatFooterDiv.classList.add("chat-footer", "flex", "flex-col", "items-end");
    } else {
        chatFooterDiv.classList.add("chat-footer", "flex", "flex-col", "items-start");
    }

    // Creating and appending the timestamp element
    const timestamp = document.createElement("time");
    timestamp.className = "text-xs opacity-50";
    timestamp.textContent = chat.chatTime;
    chatFooterDiv.appendChild(timestamp);

    return chatFooterDiv;
}