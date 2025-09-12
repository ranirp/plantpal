/**
 * @fileoverview Mongoose model for chat messages associated with plants.
 * Each chat message includes the message content, user nickname, a reference to the related plant,
 * and a timestamp indicating when the message was created.
 */

let mongoose = require('mongoose');
let Schema = mongoose.Schema;

// Define the Chat schema
let ChatSchema = new Schema({
    message: { type: String, required: true },
    nickname: { type: String, required: true }, // user nickname
    plantId: { type: mongoose.Schema.Types.ObjectId, ref: 'addPlants', required: true }, // reference to the plant
    createdAt: { type: Date, default: Date.now }
});

ChatSchema.set("toObject", { getters: true, virtuals: true });
let ChatMessage = mongoose.model('chatMessages', ChatSchema);
module.exports = ChatMessage;