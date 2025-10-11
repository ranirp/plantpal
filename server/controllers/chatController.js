/**
 * @fileoverview Controller for chat message operations.
 * Handles adding new chat messages and retrieving messages by plant ID using the ChatMessage model.
 */

const ChatMessage = require('../models/chatModel');

/**
 * Renders the chat page for a specific user and plant
 */
exports.chatPage =  async (req, res, next) => {
    const plantID = req.params.plantID;
    const username = req.session.username || req.query.user || 'Guest';
    res.render("chat/chatPage", {
        userName: username,
        plantID: plantID,
    });
};

/**
 * Retrieves chat messages for a specific plant from the database
 */
exports.getChatMessagesByPlantId = async (req, res, next) => {
    try {
        // Handle both parameter formats: :plantID and :id
        const plantID = req.params.plantID || req.params.id;
        console.log("Getting chat messages for plantID:", plantID);

        if (!plantID) {
            return res.status(400).json({
                success: false,
                message: "Plant ID is required"
            });
        }

        const chats = await ChatMessage.find({ plantID: plantID }).sort({ chatTime: 1 }); // Changed to ascending order (oldest first)

        console.log(`Chat messages retrieved successfully! Count: ${chats.length}`);
        res.json({
            success: true,
            count: chats.length,
            messages: chats
        });
    } catch (err) {
        console.error('Error retrieving chat messages:', err);
        res.status(500).json({
            success: false,
            message: "Error retrieving chat messages",
            error: err.message
        });
    }
};

/**
 * Adds a new chat message to the database
 */
exports.addChatMessage = async (req, res, next) => {
    try {
        // Check if we're receiving data through req.body directly or via req.body.chatMessage
        let chatData;
        
        if (req.body.chatmessage) {
            // Direct structure from client
            chatData = {
                plantID: req.body.plantId || req.params.id,
                username: req.body.username,
                chatMessage: req.body.chatmessage,
                chatTime: req.body.chattime
            };
        } else if (req.body.chatMessage) {
            // Nested structure
            chatData = {
                plantID: req.body.chatMessage.plantID || req.params.id,
                username: req.body.chatMessage.username,
                chatMessage: req.body.chatMessage.chatMessage,
                chatTime: req.body.chatMessage.chatTime
            };
        } else {
            // Try direct access for backward compatibility
            chatData = {
                plantID: req.body.plantId || req.params.id,
                username: req.body.username,
                chatMessage: req.body.chatmessage || req.body.message,
                chatTime: req.body.chattime || req.body.timestamp
            };
        }

        // Log the received data for debugging
        console.log("Received chat data:", req.body);
        console.log("Processed chat data:", chatData);

        // Validate required fields
        if (!chatData.plantID || !chatData.username || !chatData.chatMessage) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
                required: ["plantID", "username", "chatMessage"],
                received: chatData
            });
        }

        const timestamp = new Date()
            .toISOString()
            .replace('T', ' ')
            .replace(/\..+/, '');

        const newChatMessage = new ChatMessage({
            plantID: chatData.plantID,
            username: chatData.username,
            chatMessage: chatData.chatMessage,
            chatTime: chatData.chatTime || timestamp
        });
        
        console.log("Adding new chat message:", newChatMessage);

        const savedChat = await newChatMessage.save();
        console.log("Chat message saved successfully:", savedChat);

        res.status(201).json({
            success: true,
            message: "Chat message added successfully",
            chat: savedChat,
        });
    } catch (err) {
        console.error('Error adding chat message:', err);
        res.status(500).json({
            success: false,
            message: "Error adding chat message",
            error: err.message
        });
    }
};
