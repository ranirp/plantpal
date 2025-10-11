/**
 * @fileoverview Multer configuration for handling file uploads in the Plant Sharing Community.
 * Configures file storage, naming conventions, and validation for plant photos.
 * 
 * @module multer.config
 * @requires multer
 * @requires path
 * 
 * @typedef {Object} MulterConfig
 * @property {Object} storage - Storage engine configuration
 * @property {Function} fileFilter - File type validation function
 */

const multer = require('multer');
const path = require('path');

// Set up storage engine for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use absolute path to ensure files are saved in the correct location
        const uploadPath = path.join(__dirname, '../../public/images/uploads/');
        cb(null, uploadPath); // Directory to save uploaded files
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter to validate image files
const fileFilter = (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Set upload size limits and other options
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB file size limit
    }
});

module.exports = upload;