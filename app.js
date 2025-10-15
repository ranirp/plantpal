/**
 * @fileoverview Main application entry point for Plant Sharing Community.
 * Configures Express server with Socket.IO, middleware, routing, and error handling.
 * Supports real-time chat and offline-first Progressive Web App functionality.
 * 
 * @requires express - Web application framework
 * @requires http - HTTP server for Socket.IO integration
 * @requires socket.io - Real-time bidirectional event-based communication
 * @requires dotenv - Environment variable management
 */

const express = require('express');
const http = require('http');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Initialize MongoDB connection
require('./server/database/database');

// Initialize Socket.IO for real-time chat functionality
const io = require('socket.io')(server);
const socketIOController = require('./server/controllers/socketIOController');
socketIOController.init(io);

// Configure EJS view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Configure middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve user-uploaded plant images
app.use('/images/uploads', express.static(path.join(__dirname, 'public/images/uploads')));

// Import application routers
const homepageRouter = require('./server/routes/homepageRouter');
const addPlantRouter = require('./server/routes/addPlantRouter');
const plantDetailsRouter = require('./server/routes/plantDetailsRouter');
const offlineRouter = require('./server/routes/offlineRouter');
const chatRouter = require('./server/routes/chatRouter');

// Configure page routes
app.use('/', homepageRouter);
app.use('/addPlant', addPlantRouter);
app.use('/plantDetails', plantDetailsRouter);
app.use('/', offlineRouter);
app.use('/chat', chatRouter);

// Configure API routes
app.use('/api/plants', require('./server/routes/addPlantRouter'));
app.use("/api/chat", chatRouter);

/**
 * Health check endpoint for connectivity monitoring.
 * Supports both HEAD and GET methods for efficient network status verification.
 * @route HEAD /health
 * @route GET /health
 * @returns {Object} 200 - Server health status with timestamp and version
 */
// Handle HEAD requests for efficient connectivity checks
app.head('/health', (req, res) => {
    res.status(200).end();
});

// Handle GET requests for detailed health information
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'PlantPal',
        version: "2.0"
    });
});

/**
 * 404 error handler - catches all undefined routes.
 * Renders custom 404 error page for better user experience.
 */
app.use((req, res, next) => {
    res.status(404).render('error/404-error', { 
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.',
    });
});

/**
 * Global error handler middleware.
 * Logs errors and returns appropriate JSON response.
 * Stack traces are only shown in development environment.
 */
app.use((err, req, res, next) => {
    console.error("Error:", err);
    const statusCode = err.status || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.stack : {}
    });
});

// Start server and listen on configured port
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🌱 Plant Sharing Community server running on port ${PORT}`);
    console.log(`📱 Access at: http://localhost:${PORT}`);
    console.log(`💬 Socket.IO enabled for real-time chat`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;