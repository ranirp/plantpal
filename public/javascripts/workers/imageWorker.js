// Web worker for image processing and compression
self.addEventListener('message', function (e) {
    const { type , data } = e.data;

    switch (type) {
        case 'COMPRESS_IMAGE':
            compressImage(data.file, data.maxWidth, data.maxHeight, data.quality);
            break;
        case 'VALIDATE_IMAGE':
            validateImage(data.file);
            break;
        case 'GENERAL_THUMBNAIL':
            generalThumbnail(data.file, data.size);
            break;
        default:
            this.self.postMessage({
                type: 'ERROR',
                message: 'Unknown task type'
            });
    }
});

/**
 * Compress image to reduce file size
 */
function compressImage(file, maxWidth = 800, maxHeight = 600, quality=0.8) {
    const reader = new FileReader();

    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = new OffscreenCanvas(maxWidth, maxHeight);
            const ctx = canvas.getContext('2d');

            //Calculating scaling
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;

            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);

            canvas.convertToBlob({ type: 'image/jpeg', quality: quality })
                .then(blob => {
                self.postMessage({
                    type: 'COMPRESS_SUCCESS',
                    blob: blob,
                    originalSize: file.size,
                    compressedSize: blob.size,
                    reduction: ((1 - (blob.size / file.size)) * 100).toFixed(2)
                });
            })
            .catch(error => {
                self.postMessage({
                    type: 'ERROR',
                    message: 'Compression failed: ' + error.message
                });
            });
        };
        img.src = event.target.result;
    };
    
    reader.onerror = function() {
        self.postMessage({
            type: 'ERROR',
            message: 'Failed to read file'
        });
    };
    reader.readAsDataURL(file);
}

/**
 * Validate image file type and size
 */
function validateImage(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    const errors = [];

    if (!validTypes.includes(file.type)) {
        errors.push('Invalid file type. Accepted types: JPEG, PNG, GIF, WEBP.');
    }

    if (file.size > maxSize) {
        errors.push('File size exceeds 5MB limit.');
    }

    if (errors.length > 0) {
        self.postMessage({
            type: 'VALIDATION_FAILED',
            errors: errors
        });
    } else {
        self.postMessage({
            type: 'VALIDATION_SUCCESS',
            message: 'Image is valid.'
        });
    }
}

/**
 * Generate a general thumbnail for an image
 */
function generalThumbnail(file, size = 150) {
    const reader = new FileReader();

    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = new OffscreenCanvas(size, size);
            const ctx = canvas.getContext('2d');

            // Create a square thumbnail
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;

            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

            canvas.convertToBlob({ type: 'image/png', quality: 0.7 })
                .then(blob => {
                    self.postMessage({
                        type: 'THUMBNAIL_SUCCESS',
                        blob: blob,
                    });
                })
                .catch(error => {
                    self.postMessage({
                        type: 'ERROR',
                        message: 'Thumbnail generation failed: ' + error.message
                    });
                });
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

console.log('Image processing web worker initialized');
