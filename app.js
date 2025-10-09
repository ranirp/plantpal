const express = require('express');
const http = require('http');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Database connection
require('./server/database/database');

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routers
const homepageRouter = require('./server/routes/homepageRouter');
const addPlantRouter = require('./server/routes/addPlantRouter');
const plantDetailsRouter = require('./server/routes/plantDetailsRouter');

//Routes
app.use('/', homepageRouter);
app.use('/addPlant', addPlantRouter);
app.use('/plantDetails', plantDetailsRouter);

// API Routes 
app.use('/api/plants', require('./server/routes/addPlantRouter'));

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🌱 Plant Sharing Community server running on port ${PORT}`);
    console.log(`📱 Access at: http://localhost:${PORT}`);
});

module.exports = app;