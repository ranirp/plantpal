/**
 * @fileoverview Express router for chat-related endpoints.
 * Handles adding new chat messages and retrieving messages for a specific plant using the ChatMessage model.
 */

var express = require('express');
const chatController = require('../controllers/chatController');

var router = express.Router();

// Ping endpoint for checking chat connectivity
router.get('/ping', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Chat service is online',
        timestamp: new Date().toISOString()
    });
});

// Route to add a new chat message for a specific plant
router.post('/plants/:id/messages', (req, res, next) => {
    // Attach plantId from URL params to request body
    req.body.plantId = req.params.id;
    chatController.addChatMessage(req, res, next);
});

// Route to get all chat messages for a specific plant
router.get('/plants/:id/messages', chatController.getChatMessagesByPlantId);

module.exports = router;