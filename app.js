const express = require('express');
const http = require('http');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Database connection
require('./server/database/database');

// Socket.io setup
const io = require('socket.io')(server);
const socketIOController = require('./server/controllers/socketIOController');
socketIOController.init(io);

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use('/images/uploads', express.static(path.join(__dirname, 'public/images/uploads')));

// Import routers
const homepageRouter = require('./server/routes/homepageRouter');
const addPlantRouter = require('./server/routes/addPlantRouter');
const plantDetailsRouter = require('./server/routes/plantDetailsRouter');
const offlineRouter = require('./server/routes/offlineRouter');
const chatRouter = require('./server/routes/chatRouter');
const { timeStamp } = require('console');

//Routes
app.use('/', homepageRouter);
app.use('/addPlant', addPlantRouter);
app.use('/plantDetails', plantDetailsRouter);
app.use('/', offlineRouter);
app.use('/chat', chatRouter);

// API Routes - MUST come before wildcard routes
app.use('/api/plants', require('./server/routes/addPlantRouter'));
app.use("/api/chat", chatRouter);

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Plant Sharing Community',
        version: "2.0"
    });
});

// Error handling - 404
app.use((req, res, next) => {
    res.status(404).render('error/404-error', { 
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.',
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Error:", err);
    const statusCode = err.status || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.stack : {}
    });
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🌱 Plant Sharing Community server running on port ${PORT}`);
    console.log(`📱 Access at: http://localhost:${PORT}`);
    console.log(`💬 Socket.IO enabled for real-time chat`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;