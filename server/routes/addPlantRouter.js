/**
 * @fileoverview Express router for plant-related endpoints.
 * Handles adding new plants (with photo upload), retrieving all plants with optional sorting,
 * and fetching a specific plant by its ID. Integrates with the AddPlant Mongoose model.
 */

var express = require('express');
const addPlantController = require('../controllers/addPlantController');
const upload = require('./multer.config');

var router = express.Router();

// Route to handle adding a new plant
router.post('/plants', upload.single('photo'), addPlantController.addNewPlantToDB);

// Route to get all plants with optional sorting
router.get('/plants', async (req, res) => {
    try {
        const { sortBy = 'createdAt', order = 'desc' } = req.query;

        let sortOptions = {};
        if (sortBy === 'type') {
            sortOptions.type = order === 'desc' ? -1 : 1;
        } else {
            sortOptions.createdAt = order === 'desc' ? -1 : 1;
        }

        const AddPlant = require('../models/addPlantModel');
        const plants = await AddPlant.find({}).sort(sortOptions);
        res.json(plants);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }      
});

// Route to get a specific plant by ID
router.get('/plants/:id', async (req, res) => {
    try {
        const AddPlant = require('../models/addPlantModel');
        const plant = await AddPlant.findById(req.params.id);
        if (!plant) {
            return res.status(404).json({ error: 'Plant not found' });
        }
        res.json(plant);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;