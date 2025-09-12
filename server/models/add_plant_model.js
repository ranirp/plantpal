/**
 * @fileoverview Mongoose model for user-added plants.
 * Defines the schema for storing plant details such as name, type, description,
 * photo filename, user nickname, and creation timestamp in MongoDB.
 */

let mongoose = require('mongoose');
let { Schema } = mongoose;

// Define the Plant schema
let AddPlantSchema = new Schema({
    plantName: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['succulent', 'fern', 'houseplant', 'vegetable', 'flowering', 'herb', 'other']
    },
    description: { type: String, required: true },
    photo: { type: String }, // filename from multer
    nickname: { type: String, required: true }, // user nickname
    createdAt: { type: Date, default: Date.now }
});

let AddPlant = mongoose.model('AddPlant', AddPlantSchema);
module.exports = AddPlant;