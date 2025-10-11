/**
 * @fileoverview Plant details router configuration.
 * Handles routes for viewing individual plant details and checking ownership.
 * 
 * @requires express - Web application framework
 * @requires ../controllers/plantDetailController - Plant detail request handlers
 */

const express = require('express');
const { plantDetailPage, checkPlantOwnership } = require('../controllers/plantDetailController');

const router = express.Router();

/**
 * GET /plantDetails/checkOwnership/:plantId/:username - Verify plant ownership
 * @route GET /checkOwnership/:plantId/:username
 * @param {string} plantId - Plant ID
 * @param {string} username - User nickname
 * @returns {Object} 200 - Ownership status (isOwner: boolean)
 */
router.get('/checkOwnership/:plantId/:username', checkPlantOwnership);

/**
 * GET /plantDetails/:plantID/:userName - Render plant details page
 * @route GET /:plantID/:userName
 * @param {string} plantID - Plant ID
 * @param {string} userName - Current user nickname
 * @returns {HTML} Plant details view
 */
router.get('/:plantID/:userName', plantDetailPage);

module.exports = router;