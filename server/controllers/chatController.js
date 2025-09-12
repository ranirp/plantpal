/**
 * @fileoverview Controller for chat message operations.
 * Handles adding new chat messages and retrieving messages by plant ID using the ChatMessage model.
 */

const ChatMessage = require('../models/chatModel');

exports.addChatMessage = async (req, res, next) => {
    const { message, nickname, plantId } = req.body;

    const newChatMessage = new ChatMessage({
        message,
        nickname,
        plantId
    });

    return newChatMessage.save()
        .then((chat) => {
            res.json(chat);
        })
        .catch((error) => {
            res.status(500).json({
                success: false,
                message: 'Error adding chat message',
                error: error.message
            });
        });
};

exports.getChatMessagesByPlantId = async (req, res, next) => {
    const plantId = req.params.plant_id;
    return ChatMessage.find({ plantId: plantId })
        .then((chat) => {
            res.json(chat);
        })
        .catch((error) => {
            res.status(500).json({
                success: false,
                message: 'Error fetching chat messages',
                error: error.message
            });
        });
};