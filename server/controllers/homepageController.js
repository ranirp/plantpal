const addPlant = require('../models/addPlantModel');

/**
 * Render the homepage 
 */
exports.homepage = async (req, res) => {
    res.render("homepage/homepage", { 
        title: "Plant Sharing Community - Homepage",
    });
};

/**
 * Get all plant details from the database
 * Supports sorting by type, createdAt, or plantName
 */
exports.getAllPlantDetails = async (req, res) => {
    try {
        const { sortBy = 'createdAt', order = 'desc' } = req.query;

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

        console.log('Getting all plant details with sort options:', sortOptions);

        const plants = await addPlant.find({}).sort(sortOptions);

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
};
            