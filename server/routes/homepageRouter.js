// Import necessary modules and controllers
var express = require('express');
const { homepage } = require('../controllers/homepageController');

// Create a router instance
var router = express.Router();

// Route to render the homepage with all plants
router.get('/', homepage);

// Export the router 
module.exports = router;