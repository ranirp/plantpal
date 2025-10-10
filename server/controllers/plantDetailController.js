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