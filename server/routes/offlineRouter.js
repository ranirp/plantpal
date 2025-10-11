/**
 * @fileoverview Offline and error page router configuration.
 * Handles routes for displaying offline and 404 error pages.
 * 
 * @requires express - Web application framework
 */

const express = require('express');
const router = express.Router();

/**
 * GET /offline - Render offline error page
 * @route GET /offline
 * @returns {HTML} No connection error view
 */
router.get("/offline", (req, res) => {
    res.render("error/no-connection");
});

/**
 * GET /404_error - Render 404 error page
 * @route GET /404_error
 * @returns {HTML} 404 error view
 */
router.get("/404_error", (req, res) => {
    res.render("error/404_error");
});

module.exports = router;
