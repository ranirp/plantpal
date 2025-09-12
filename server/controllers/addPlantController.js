/**
 * @fileoverview Controller for adding a new plant to the database.
 * Handles the logic for processing the request data and saving the plant using the AddPlant model.
 */

const AddPlant = require('../models/addPlantModel');

exports.addNewPlantToDB = async (req, res, next) => {
    const { plantName, type, description, nickname } = req.body;
    let photoPath = req.file ? req.file.filename : null;

    const newPlant = new AddPlant({
        plantName,
        type,
        description,
        photo: photoPath,
        nickname
    });

    return newPlant.save()
        .then((plant) => {
            console.log('Plant added successfully:', plant);
            res.json(plant);
        })
        .catch((error) => {
            console.error('Error adding plant:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error adding plant', 
                error: error.message
            });
        });
};


