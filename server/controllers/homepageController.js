/**
 * @fileoverview Homepage controller for Plant Sharing Community.
 * Handles homepage rendering and plant data retrieval with sorting and connectivity checking.
 * 
 * @requires ../models/addPlantModel - Plant database model
 */

const addPlant = require('../models/addPlantModel');

/**
 * Render the homepage view.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.homepage = async (req, res) => {
    res.render("homepage/homepage", { 
        title: "PlantPal - Homepage",
    });
};

/**
 * Retrieve all plant details with optional sorting and connectivity checking.
 * Supports query parameters for sort field, order, and connection status check.
 * Disables HTTP caching to ensure fresh data for offline-first functionality.
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query.sortBy - Sort field (type, plantName, createdAt)
 * @param {Object} req.query.order - Sort order (asc, desc)
 * @param {Object} req.query.check - Connectivity check flag (true)
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with plant array or connectivity status
 */
exports.getAllPlantDetails = async (req, res) => {
    try {
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        if (req.query.check === 'true') {
            return res.status(200).json({
                status: 'online',
                message: 'Server is available',
                timestamp: new Date().toISOString(),
                mongoStatus: global.isMongoDBAvailable !== false ? 'connected' : 'disconnected'
            });
        }

        const { sortBy = 'createdAt', order = 'desc' } = req.query;

        let sortOptions = {};

        switch (sortBy) {
            case 'type':
                sortOptions.type = order === 'desc' ? -1 : 1;
                break;
            case 'plantName':
                sortOptions.plantName = order === 'desc' ? -1 : 1;
                break;
            case 'createdAt':
            default:
                sortOptions.createdAt = order === 'desc' ? -1 : 1;
                break;
        }

        console.log('Getting all plant details with sort options:', sortOptions);

        const plants = await addPlant.find({}).sort(sortOptions);

        console.log(`Plants retrieved successfully! Count: ${plants.length}`);

        res.json({ 
            success: true, 
            count: plants.length, 
            plants 
        });
    } catch (err) {
        console.error('Error retrieving plants:', err);
        res.status(500).json({
            success: false,
            message: "Error retrieving plants",
            error: err.message
        });
    }
};
            