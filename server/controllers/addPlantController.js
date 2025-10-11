/**
 * @fileoverview Plant management controller.
 * Handles plant creation, retrieval, validation, and rate limiting.
 * Implements in-memory rate limiting to prevent spam submissions.
 * 
 * @requires ../models/addPlantModel - Plant database model
 */

const AddPlant = require('../models/addPlantModel');

const submissionTracker = new Map();
const RATE_LIMIT_WINDOW = 10000;
const MAX_SUBMISSIONS = 3;

/**
 * Check if an IP address has exceeded the rate limit.
 * Cleans up old submissions outside the time window.
 * 
 * @param {string} ip - Client IP address
 * @returns {boolean} True if rate limited, false otherwise
 */
function isRateLimited(ip) {
    const now = Date.now();
    const userSubmissions = submissionTracker.get(ip) || [];
    
    const recentSubmissions = userSubmissions.filter(time => now - time < RATE_LIMIT_WINDOW);
    submissionTracker.set(ip, recentSubmissions);
    
    return recentSubmissions.length >= MAX_SUBMISSIONS;
}

/**
 * Record a new submission timestamp for rate limiting.
 * 
 * @param {string} ip - Client IP address
 */
function recordSubmission(ip) {
    const now = Date.now();
    const userSubmissions = submissionTracker.get(ip) || [];
    userSubmissions.push(now);
    submissionTracker.set(ip, userSubmissions);
}

/**
 * Render the add plant form page.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.addPlantPage = (req, res, next) => {
    res.render("addPlant/addPlant", { 
        title: "Share your Plant",
    });
};

/**
 * Create and save a new plant to the database.
 * Validates required fields, plant type, and enforces rate limiting.
 * Handles optional photo upload via Multer middleware.
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing plant data
 * @param {string} req.body.plantName - Name of the plant
 * @param {string} req.body.type - Plant type (must be from valid enum)
 * @param {string} req.body.description - Plant description
 * @param {string} req.body.nickname - User nickname
 * @param {Object} req.file - Uploaded file object from Multer (optional)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} 201 - Created plant object
 * @returns {Object} 400 - Validation error
 * @returns {Object} 429 - Rate limit exceeded
 * @returns {Object} 500 - Server error
 */
exports.addNewPlantToDB = async (req, res, next) => {
    try {
        const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
        
        // Check rate limiting
        if (isRateLimited(clientIP)) {
            return res.status(429).json({
                success: false,
                message: "Too many submissions. Please wait 30 seconds before trying again.",
            });
        }

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
            console.log('File uploaded successfully:', req.file.filename);
        } else {
            console.log('No file was uploaded - photo will be null');
            // Photo is optional - this is fine
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
        
        // Record this submission for rate limiting
        recordSubmission(clientIP);
        
        console.log('Plant added successfully:', savedPlant);

        const response = {
            success: true,
            message: "Plant added successfully",
            plant: savedPlant
        };
        
        console.log('Server response structure:', {
            success: response.success,
            plantId: response.plant._id,
            plantData: response.plant ? 'present' : 'missing'
        });

        res.status(201).json(response);
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
        // Prevent HTTP caching of API responses
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

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
        