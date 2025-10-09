/**
 * @fileoverview Mongoose model for chat messages associated with plants.
 * Each chat message includes the message content, user nickname, a reference to the related plant,
 * and a timestamp indicating when the message was created.
 */

let mongoose = require('mongoose');
let Schema = mongoose.Schema;

// Define the Chat schema
let ChatSchema = new Schema({
    chatMessage: {
        type: String,
        required: true,
        maxlength: 500,
        trim: true
    },
    username: {
        type: String,
        required: true,
        trim: true
    },
    chatTime: {
        type: Date,
        default: Date.now,
        required: true
    },
    plantID: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Configure the toObject option for schema to include virtuals and getters
ChatSchema.set('toObject', { virtuals: true, getters: true });
ChatSchema.set('toJSON', { virtuals: true, getters: true });

// Create index for efficient queries
ChatSchema.index({ plantID: 1, chatTime: -1 });

// Create mongoose model on defined schema
let chatMessage = mongoose.model('ChatMessages', ChatSchema);

module.exports = chatMessage;


    