/**
 * @fileoverview Homepage router configuration.
 * Defines routes for rendering the main homepage view.
 * 
 * @requires express - Web application framework
 * @requires ../controllers/homepageController - Homepage request handlers
 */

const express = require('express');
const { homepage } = require('../controllers/homepageController');

const router = express.Router();

/**
 * GET / - Render homepage
 * @route GET /
 * @returns {HTML} Rendered homepage view
 */
router.get('/', homepage);

module.exports = router;