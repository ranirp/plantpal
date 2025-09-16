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

// Routes for rendering pages
app.get('/', async (req, res) => {
    try {
        const AddPlant = require('./server/models/addPlantModel');
        const plants = await AddPlant.find({}).sort({ createdAt: -1 });
        res.render('index', { plants, title: 'Plant Collection' });
    } catch (error) {
        console.error('Error fetching plants:', error);
        res.render('index', { plants: [], title: 'Plant Collection' });
    }
});

// Route to render the form for adding a new plant
app.get('/plants/new', (req, res) => {
    res.render('newPlant', { title: 'Add New Plant' });
});

// Route to render details of a specific plant
app.get('/plants/:id', async (req, res) => {
    try {
        const AddPlant = require('./server/models/addPlantModel');
        const plant = await AddPlant.findById(req.params.id);
        if (!plant) {
            return res.status(404).render('error', { message: 'Plant not found' });
        }
        res.render('plantDetails', { plant, title: plant.plantName });
    } catch (error) {
        res.status(500).render('error', { message: 'Error loading plant details' });
    }
});

// API Routes
const addPlantRouter = require('./server/routes/addPlantRouter');
const chatRouter = require('./server/routes/chatRouter');

app.use('/api', addPlantRouter);
app.use('/api', chatRouter);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🌱 Plant Sharing Community server running on port ${PORT}`);
    console.log(`📱 Access at: http://localhost:${PORT}`);
});

module.exports = app;