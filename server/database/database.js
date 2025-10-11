/**
 * @fileoverview MongoDB database connection configuration using Mongoose.
 * Establishes connection with timeout settings and monitors connection status.
 * Sets global availability flag for application-wide database status checks.
 * 
 * @requires mongoose - MongoDB object modeling tool
 * @requires dotenv - Environment variable loader
 */

const mongoose = require("mongoose");
require("dotenv").config();

const URI = process.env.MONGO_DB;

/**
 * Initialize MongoDB connection with optimized timeout settings.
 * Uses shorter timeouts (5s server selection, 45s socket timeout) for faster failure detection.
 */
mongoose
    .connect(URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    })
    .then(() => {
        console.log("✅ Successfully connected to MongoDB");
    })
    .catch((err) => {
        console.error("❌ Error connecting to MongoDB:", err.message);
        console.error("Please check that MongoDB is running and connection string is correct");
        global.isMongoDBAvailable = false;
    });

/**
 * Monitor Mongoose connection events and update global availability status.
 * Used by controllers to provide graceful degradation when database is unavailable.
 */
mongoose.connection.on('connected', () => {
    console.log('🔄 Mongoose connection established');
    global.isMongoDBAvailable = true;
});

mongoose.connection.on('disconnected', () => {
    console.log('🔄 Mongoose disconnected');
    global.isMongoDBAvailable = false;
});

mongoose.connection.on('error', (err) => {
    console.error('🔄 Mongoose connection error:', err.message);
    global.isMongoDBAvailable = false;
});