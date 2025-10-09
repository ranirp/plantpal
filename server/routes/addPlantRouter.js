/**
 * @fileoverview Express router for plant-related endpoints.
 * Handles adding new plants (with photo upload), retrieving all plants with optional sorting,
 * and fetching a specific plant by its ID. Integrates with the AddPlant Mongoose model.
 */

var express = require('express');
const {
    renderAddPlantPage,
    addNewPlantToDB,
    getAllPlants,
    getPlantById,
    getPlantsByType,
} = require('../controllers/addPlantController');

// alias controller export to the expected name
const addPlantPage = renderAddPlantPage;
const upload = require('../middleware/multer.config.js');

var router = express.Router();

/**
 * Get /addAPlant
 * Render the page to add a new plant
 */
router.get('/', addPlantPage);

/**
 * POST /addPlant/addNewPlant
 * Add a new plant to the database 
 * Accepts multipart form data with optional photo 
 */
router.post('/addNewPlant', upload.single('photo'), addNewPlantToDB);

/** 
 * API Endpoints (for plant retrieval)
 */
router.get('/getAllPlants', getAllPlants);
router.get('/getPlantById/:id', getPlantById);
router.get('/getPlantsByType/:type', getPlantsByType);

// Export the router
module.exports = router;


