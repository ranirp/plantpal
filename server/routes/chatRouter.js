/**
 * @fileoverview Express router for chat-related endpoints.
 * Handles adding new chat messages and retrieving messages for a specific plant using the ChatMessage model.
 */

var express = require('express');
const chatController = require('../controllers/chatController');

var router = express.Router();

// Route to add a new chat message for a specific plant
router.post('/plants/:id/messages', (req, res, next) => {
    // Attach plantId from URL params to request body
    req.body.plantId = req.params.id;
    chatController.addChatMessage(req, res, next);
});

// Route to get all chat messages for a specific plant
router.get('/plants/:id/messages', chatController.getChatMessagesByPlantId);

module.exports = router;