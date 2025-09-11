const mongoose = require("mongoose");
require("dotenv").config();

// MongoDB connection
const URI = process.env.MONGO_DB;
mongoose
    .connect(URI, {})
    .then(() => {
    console.log("Connected to MongoDB");
    })
    .catch((err) => {
        console.log("Error connecting to MongoDB", err);
    });