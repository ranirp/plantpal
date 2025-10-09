/**
 * @fileoverview Mongoose model for user-added plants.
 * Defines the schema for storing plant details such as name, type, description,
 * photo filename, user nickname, and creation timestamp in MongoDB.
 */

let mongoose = require('mongoose');
let { Schema } = mongoose;

// Define the Plant schema
let AddPlantSchema = new Schema({
    plantName: { 
        type: String, 
        required: [true, 'Plant name is required'],
        trim: true,
        minlength: [2, 'Plant name must be at least 2 characters'],
        maxlength: [100, 'Plant name cannot exceed 100 characters'],
    },
    type: {
        type: String,
        required: [true, 'Plant type is required'],
        enum: {
            values: [
                'succulent', 
                'fern', 
                'houseplant', 
                'vegetable', 
                'flowering', 
                'herb', 
                'other'
            ],
            message: '{VALUE} is not a valid plant type',
        },
        lowercase: true,
        trim: true,
    },
    description: { 
        type: String, 
        required: [true, 'Description is required'],
        trim: true,
        minlength: [10, 'Description must be at least 10 characters'],
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    photo: { 
        type: String,
        default: null,
        trim: true,
    }, 
    nickname: { 
        type: String, 
        required: [true, 'Nickname is required'],
        trim: true,
        minlength: [2, 'Nickname must be at least 2 characters'],
        maxlength: [50, 'Nickname cannot exceed 50 characters'],
    }, // user nickname
    createdAt: { 
        type: Date, 
        default: Date.now,
        index: true,
    },
},
{
    timestamps: true,
    collection: "plants",
});;

// Create indexes for efficient querying
AddPlantSchema.index({ plantName: 1 }); // Index on plantName for quick search
AddPlantSchema.index({ type: 1, createdAt: -1 }); // Compound index on type and createdAt for filtering and sorting
AddPlantSchema.index({ nickname: 1, createdAt: -1 }); // Compound index on nickname and createdAt

// Virtual for formatted date display
AddPlantSchema.virtual('formattedDate').get(function() {
    return this.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
});

// Virtual for formatted date and time display
AddPlantSchema.virtual('formattedDateTime').get(function() {
    return this.createdAt.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
});

// Pre-save hook for additional validation or processing
AddPlantSchema.pre('save', function(next) {
    // Ensure type is lowercase
    if (this.type) {
        this.type = this.type.toLowerCase();
    }
    // Additional validation or processing can be added here
    next();
});

// Instance method to get a summary of the plant
AddPlantSchema.methods.getSummary = function() {
    return {
        id: this._id,
        plantName: this.plantName,
        type: this.type,
        nickname: this.nickname,
        createdAt: this.formattedDate,
    };
};

// Static method to find plants by type
AddPlantSchema.statics.findByType = function(type) {
    return this.find({ type: type.toLowerCase() }).sort({ createdAt: -1 });
};

// Static method to get recent plants
AddPlantSchema.statics.getRecentPlants = function(limit = 10) {
    return this.find({}).sort({ createdAt: -1 }).limit(limit);
};

// Virtuals are included when converting to JSON
AddPlantSchema.set('toJSON', { 
    virtuals: true,
    transform: function(doc, ret) {
        delete ret.__v; // Remove version key
        ret.id = ret._id; // Add id field
        delete ret._id; // Remove _id field
    }
});
AddPlantSchema.set('toObject', { virtuals: true });

// Create and export the model
let AddPlant = mongoose.model('addPlants', AddPlantSchema);

module.exports = AddPlant;