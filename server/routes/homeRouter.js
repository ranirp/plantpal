// Import necessary modules and controllers
var express = require('express');
const { homepage, getAllPlantDetails } = require('../controllers/homepageController');

// Create a router instance
var router = express.Router();

// Route to render the homepage with all plants
router.get('/', homepage);

// Route to get all plant details
router.get('/getAllPlantDetails', getAllPlantDetails);

// Export the router 
module.exports = router;