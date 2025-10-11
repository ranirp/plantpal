/**
 * @fileoverview Chat router configuration.
 * Handles routes for plant-specific chat messages with connectivity checking.
 * Supports both adding new messages and retrieving message history per plant.
 * 
 * @requires express - Web application framework
 * @requires ../controllers/chatController - Chat message request handlers
 */

const express = require('express');
const chatController = require('../controllers/chatController');

const router = express.Router();

/**
 * GET /chat/ping - Health check endpoint for chat service
 * @route GET /ping
 * @returns {Object} 200 - Chat service status with timestamp
 */
router.get('/ping', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Chat service is online',
        timestamp: new Date().toISOString()
    });
});

/**
 * POST /chat/plants/:id/messages - Add new chat message for a specific plant
 * @route POST /plants/:id/messages
 * @param {string} id - Plant ID
 * @param {string} message - Message content (from request body)
 * @param {string} nickname - User nickname (from request body)
 * @returns {Object} 201 - Message created successfully
 */
router.post('/plants/:id/messages', (req, res, next) => {
    req.body.plantId = req.params.id;
    chatController.addChatMessage(req, res, next);
});

/**
 * GET /chat/plants/:id/messages - Retrieve all messages for a specific plant
 * @route GET /plants/:id/messages
 * @param {string} id - Plant ID
 * @returns {Object} 200 - Array of message objects
 */
router.get('/plants/:id/messages', chatController.getChatMessagesByPlantId);

module.exports = router;