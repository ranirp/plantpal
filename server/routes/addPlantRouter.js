/**
 * @fileoverview Plant management router configuration.
 * Handles routes for adding new plants with photo uploads and retrieving plant data.
 * Implements multipart/form-data processing with Multer for image uploads.
 * 
 * @requires express - Web application framework
 * @requires multer - Multipart form-data processing middleware
 * @requires ../controllers/addPlantController - Plant request handlers
 * @requires ../middleware/multer.config - File upload configuration
 */

const express = require('express');
const multer = require('multer');
const {
    addPlantPage,
    addNewPlantToDB,
    getAllPlants,
    getPlantById,
    getPlantsByType,
} = require('../controllers/addPlantController');
const upload = require('../middleware/multer.config.js');

const router = express.Router();

/**
 * GET /addPlant - Render add plant form page
 * @route GET /
 * @returns {HTML} Add plant form view
 */
router.get('/', addPlantPage);

/**
 * POST /addPlant/addNewPlant - Create new plant entry with optional photo
 * @route POST /addNewPlant
 * @param {string} plantName - Name of the plant
 * @param {string} type - Plant type (succulent, fern, houseplant, etc.)
 * @param {string} description - Plant description
 * @param {file} photo - Optional plant photo (processed by Multer)
 * @param {string} nickname - User nickname
 * @returns {Object} 201 - Plant created successfully
 * @returns {Object} 400 - Validation or upload error
 */
router.post('/addNewPlant', (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
        if (err) {
            console.error('File upload error:', err);
            return res.status(400).json({
                success: false,
                message: err instanceof multer.MulterError 
                    ? `Upload error: ${err.message}` 
                    : `File error: ${err.message}`
            });
        }
        next();
    });
}, addNewPlantToDB);

/**
 * GET /addPlant/getAllPlants - Retrieve all plants
 * @route GET /getAllPlants
 * @returns {Object} 200 - Array of plant objects
 */
router.get('/getAllPlants', getAllPlants);

/**
 * GET /addPlant/getPlantById/:id - Retrieve specific plant by ID
 * @route GET /getPlantById/:id
 * @param {string} id - Plant ID
 * @returns {Object} 200 - Plant object
 */
router.get('/getPlantById/:id', getPlantById);

/**
 * GET /addPlant/getPlantsByType/:type - Retrieve plants filtered by type
 * @route GET /getPlantsByType/:type
 * @param {string} type - Plant type
 * @returns {Object} 200 - Array of filtered plant objects
 */
router.get('/getPlantsByType/:type', getPlantsByType);

module.exports = router;


