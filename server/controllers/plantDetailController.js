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
exports.plantDetailPage = async (req, res) => {
    try {
        const userName = req.params.userName || req.query.user || "Guest";
        const plantId = req.params.plantID;
        
        // Check if this is an offline plant ID (starts with "offline_")
        if (plantId.startsWith('offline_')) {
            console.log('Rendering offline plant detail page for:', plantId);
            // Render the plant details page but with offline mode enabled
            // The frontend will load the plant data from IndexedDB
            return res.render('details/plantDetails', { 
                title: 'Plant Details (Offline)',
                data: { 
                    _id: plantId,
                    isOfflinePlant: true,
                    plantName: 'Loading...',
                    description: 'Loading from local storage...',
                    nickname: userName,
                    type: 'unknown'
                },
                username: userName,
                isOfflineMode: true
            });
        }
        
        const plant = await getPlant(plantId);

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
            isOfflineMode: false
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
        // Prevent HTTP caching of API responses
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

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