const { objectId } = require('mongodb');
const addPlant = require('../models/addPlantModel');

/**
 * Get plant by plant ID
 */
async function getPlant(plantId) {
    try {
        const plant = await addPlant.findOne({ _id: plantId });
        return plant;
    } catch (err) {
        console.error('Error fetching plant by ID:', err);
        return null;
    }
}

/**
 * Render plant detail page
 */
/**
 * Render plant detail page
 */
exports.plantDetailPage = async (req, res) => {
    try {
        const userName = req.params.userName || req.query.user || "Guest"; 
        const plant = await getPlant(req.params.plantID);

        if (!plant) {
            return res.status(404).render('error/error', { 
                title: 'Plant not found',
                message: 'The plant you are looking for does not exist.'
            });
        }

        console.log('Rendering plant detail page for plant:', plant.plantName);

        res.render('details/plantDetails', { 
            title: `${plant.plantName} - Plant Details`,
            data: plant,
            username: userName,
        });
    } catch (err) {
        console.error('Error rendering plant detail page:', err);
        res.status(500).render('error/error', { 
            title: 'Server Error',
            message: 'An error occurred while loading the plant details.'
        });
    }
};

/**
 * Check if a user owns a specific plant
 */
exports.checkPlantOwnership = async (req, res) => {
    try {
        const { plantId, username } = req.params;
        
        if (!plantId || !username) {
            return res.status(400).json({
                success: false,
                message: 'Plant ID and username are required'
            });
        }

        const plant = await getPlant(plantId);
        
        if (!plant) {
            return res.status(404).json({
                success: false,
                message: 'Plant not found',
                isOwner: false
            });
        }

        const isOwner = plant.nickname === username;
        
        res.json({
            success: true,
            isOwner: isOwner,
            plantId: plantId,
            username: username,
            plantOwner: plant.nickname
        });
    } catch (err) {
        console.error('Error checking plant ownership:', err);
        res.status(500).json({
            success: false,
            message: 'Error checking plant ownership',
            isOwner: false
        });
    }
};