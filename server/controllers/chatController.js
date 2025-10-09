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
        const plantID = req.params.plantID;
        console.log("Getting chat messages for plantID:", plantID);

        const chats = await ChatMessage.find({ plantID: plantID }).sort({ chatTime: -1 });

        console.log(`Chat messages retrieved successfully! Count: ${chats.length}`);
        res.json(chats);
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
        const chatMessage = req.body.chatMessage;

        // Validate required fields
        if (!chatMessage || !chatMessage.plantID || !chatMessage.username || !chatMessage.chatMessage) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
                required: ["plantID", "username", "chatMessage"]
            });
        }

        const timestamp = new Date()
            .toISOString()
            .replace('T', ' ')
            .replace(/\..+/, '');

        const newChatMessage = new ChatMessage({
            plantID: chatMessage.plantID,
            username: chatMessage.username,
            chatMessage: chatMessage.chatMessage,
            chatTime: chatMessage.chatTime || timestamp
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
