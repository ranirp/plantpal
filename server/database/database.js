const mongoose = require("mongoose");
require("dotenv").config();

// MongoDB connection
const URI = process.env.MONGO_DB;

// Enhanced MongoDB connection with more robust error handling
mongoose
    .connect(URI, {
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
        socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    })
    .then(() => {
        console.log("✅ Successfully connected to MongoDB");
    })
    .catch((err) => {
        console.error("❌ Error connecting to MongoDB:", err.message);
        console.error("Please check that MongoDB is running and connection string is correct");
        
        // Notify the application that MongoDB is not available
        global.isMongoDBAvailable = false;
    });

// Set up connection status monitoring
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