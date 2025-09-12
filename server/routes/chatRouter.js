/**
 * @fileoverview Express router for plant chat message endpoints.
 * Handles adding new chat messages and retrieving messages associated with a specific plant.
 * Integrates with the ChatMessage Mongoose model.
 */

var express = require('express');
const ChatMessage = require('../models/chatModel');

var router = express.Router();

// Route to get all chat messages for a specific plant
router.post('/plants/:id/messages', async (req, res) => {    
    try {
        const { message, nickname } = req.body;
        const plantId = req.params.id;

        const newMessage = new ChatMessage({
            message,
            nickname,
            plantId
        });

        const savedMessage = await newMessage.save();
        res.status(201).json(savedMessage);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;