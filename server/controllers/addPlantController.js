/**
 * @fileoverview Controller for adding a new plant to the database.
 * Handles the logic for processing the request data and saving the plant using the AddPlant model.
 */

const AddPlant = require('../models/addPlantModel');

/**
 * Renders the add plant page
 */
exports.addPlantPage = (req, res, next) => {
    res.render("addPlant/addPlant", { 
        title: "Share your Plant",
    });
};

/**
 * Adds a new plant to the database
 * Required fields: plantName, type, description, nickname
 * Optional field: photo (filename of the uploaded image)
 */
exports.addNewPlantToDB = async (req, res, next) => {
    try {
        const { plantName, type, description, nickname } = req.body;
        
        // Validate required fields
        if (!plantName || !type || !description || !nickname) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
                requiredFields: ['plantName', 'type', 'description', 'nickname'],
            });
        }

        // Validate plant type
        const validTypes = [
            'succulent', 
            'fern', 
            'houseplant', 
            'vegetable', 
            'flowering', 
            'herb', 
            'other'
        ];
        if (!validTypes.includes(type.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid plant type'
            });
        }

        let photoPath = null;
        if (req.file && req.file.filename) {
            photoPath = req.file.filename; // Multer sets the filename property on successful upload
            console.log('File uploaded successfully:', req.file);
        } else {
            console.log('No file was uploaded or file upload failed');
            // Use a default image if needed
            // photoPath = 'default-plant.jpg';
        }

        // Create a new plant instance
        const newPlant = new AddPlant({
            plantName,
            type,
            description,
            nickname,
            photo: photoPath
        });

        console.log('Adding new plant:', newPlant);

        // Save the new plant to the database
        const savedPlant = await newPlant.save();
        console.log('Plant added successfully:', savedPlant);

        res.status(201).json({
            success: true,
            message: "Plant added successfully",
            plant: savedPlant
        });
    } catch (err) {
        console.error('Error adding new plant:', err);
        
        // Handle validation errors specifically
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({
                success: false,
                message: validationErrors.join('. '),
                error: err.message,
                validationErrors: validationErrors
            });
        }
        
        // Handle other errors
        res.status(500).json({
            success: false,
            message: "Error adding new plant",
            error: err.message
        });
    }
};

/**
 * Get all plants with optional sorting
 * Supports: sortBy (type, createdAt, plantName), order (asc, desc)
 */
exports.getAllPlants = async (req, res, next) => {
    try {
        const { sortBy = 'createdAt', order = 'desc', since } = req.query;

        let sortOptions = {};

        switch (sortBy) {
            case 'type':
                sortOptions.type = order === 'desc' ? -1 : 1;
                break;
            case 'plantName':
                sortOptions.plantName = order === 'desc' ? -1 : 1;
                break;
            case 'createdAt':
            default:
                sortOptions.createdAt = order === 'desc' ? -1 : 1;
                break;
        }

        // Build query; if `since` provided, only return plants created after that timestamp
        const query = {};
        if (since) {
            const sinceDate = new Date(since);
            if (!isNaN(sinceDate.getTime())) {
                query.createdAt = { $gt: sinceDate };
            } else {
                console.warn('Invalid since query param:', since);
            }
        }

        const plants = await AddPlant.find(query).sort(sortOptions);

        console.log(`Plants retrieved successfully! Count: ${plants.length}`);

        res.json({ 
            success: true, 
            count: plants.length, 
            plants 
        });
    } catch (err) {
        console.error('Error retrieving plants:', err);
        res.status(500).json({
            success: false,
            message: "Error retrieving plants",
            error: err.message
        });
    }
}


/**
 * Get a specific plant by its ID
 */
exports.getPlantById = async (req, res, next) => {
    try {
        const plant = await AddPlant.findById(req.params.id);

        if (!plant) {
            return res.status(404).json({
                success: false,
                message: "Plant not found"
            });
        }

        console.log('Plant retrieved successfully:', plant);

        res.json({ 
            success: true, 
            plant 
        });
    } catch (err) {
        console.error('Error retrieving plant:', err);
        res.status(500).json({
            success: false,
            message: "Error retrieving plant",
            error: err.message
        });
    }
};

/**
 * Get plants filtered by type
 */
exports.getPlantsByType = async (req, res, next) => {
    try {
        const { type } = req.params;

        // Validate plant type
        const validTypes = [
            'succulent', 
            'fern', 
            'houseplant', 
            'vegetable', 
            'flowering', 
            'herb', 
            'other'
        ];

        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid plant type',
                validTypes
            });
        }

        const plants = await AddPlant.find({ type }).sort({ createdAt: -1 });

        console.log(`Plants of type ${type} retrieved successfully! Count: ${plants.length}`);

        res.json({ 
            success: true, 
            count: plants.length, 
            plants 
        });
    } catch (err) {
        console.error('Error retrieving plants by type:', err);
        res.status(500).json({
            success: false,
            message: "Error retrieving plants by type",
            error: err.message
        });
    }
}
        