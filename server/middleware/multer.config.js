/**
 * @fileoverview Multer middleware configuration for plant photo uploads.
 * Configures disk storage with unique filenames, image validation, and size limits.
 * Uploads are stored in public/images/uploads/ with timestamped filenames.
 * 
 * @requires multer - Multipart form-data processing middleware
 * @requires path - File path utilities
 */

const multer = require('multer');
const path = require('path');

/**
 * Configure disk storage engine with custom destination and filename logic.
 */
const storage = multer.diskStorage({
    /**
     * Set upload destination directory.
     * @param {Object} req - Express request object
     * @param {Object} file - Uploaded file object
     * @param {Function} cb - Callback function
     */
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../../public/images/uploads/');
        cb(null, uploadPath);
    },
    /**
     * Generate unique filename with timestamp and random suffix.
     * Format: fieldname-timestamp-randomNumber.ext
     * @param {Object} req - Express request object
     * @param {Object} file - Uploaded file object
     * @param {Function} cb - Callback function
     */
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

/**
 * File type validator - accepts only image files.
 * @param {Object} req - Express request object
 * @param {Object} file - Uploaded file object
 * @param {Function} cb - Callback function
 */
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

/**
 * Configured Multer instance with storage, validation, and size limits.
 * Maximum file size: 5MB
 */
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

module.exports = upload;