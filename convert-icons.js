/**
 * This script converts JPG images to PNG format with various sizes for PWA icons
 * It uses the node-canvas library to perform image processing
 * 
 * Required input files:
 * - public/images/icon1.jpg: Source for larger icons (512px, 384px)
 * - public/images/icon2.jpg: Source for smaller icons (192px, 96px, 72px, 48px)
 * 
 * Generated output:
 * - icon-512.png: Splash screen and store listing
 * - icon-384.png: Large device home screens
 * - icon-192.png: Medium device home screens
 * - icon-96.png: Smaller device home screens
 * - icon-72.png: Legacy device support
 * - icon-48.png: Notification icons
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

/**
 * Converts a JPG image to PNG format with specified size
 * @param {string} inputPath - Path to source JPG file
 * @param {string} outputPath - Path where PNG will be saved
 * @param {number} size - Width and height of output image
 * @returns {Promise<void>}
 */
async function convertJpgToPng(inputPath, outputPath, size) {
    try {
        const image = await loadImage(inputPath);
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        
        // Draw image on canvas with specified dimensions
        ctx.drawImage(image, 0, 0, size, size);
        
        // Stream the canvas content to a PNG file
        const pngStream = canvas.createPNGStream();
        const out = fs.createWriteStream(outputPath);
        
        return new Promise((resolve, reject) => {
            pngStream.pipe(out);
            out.on('finish', () => {
                console.log(`Converted ${inputPath} to ${outputPath}`);
                resolve();
            });
            out.on('error', reject);
        });
    } catch (error) {
        console.error(`Error converting ${inputPath}:`, error);
        throw error;
    }
}

/**
 * Main execution function that generates all required PWA icons
 * Processes images in sequence to avoid memory issues
 */
async function main() {
    const imagesDir = path.join(__dirname, 'public', 'images');
    
    // Generate large format icons from icon1.jpg
    await convertJpgToPng(
        path.join(imagesDir, 'icon1.jpg'), 
        path.join(imagesDir, 'icon-512.png'),
        512
    );
    
    // Generate medium format icons from icon2.jpg
    await convertJpgToPng(
        path.join(imagesDir, 'icon2.jpg'), 
        path.join(imagesDir, 'icon-192.png'),
        192
    );
    
    // Add more sizes for better compatibility
    await convertJpgToPng(
        path.join(imagesDir, 'icon1.jpg'), 
        path.join(imagesDir, 'icon-384.png'),
        384
    );
    
    await convertJpgToPng(
        path.join(imagesDir, 'icon2.jpg'), 
        path.join(imagesDir, 'icon-96.png'),
        96
    );
    
    await convertJpgToPng(
        path.join(imagesDir, 'icon2.jpg'), 
        path.join(imagesDir, 'icon-72.png'),
        72
    );
    
    await convertJpgToPng(
        path.join(imagesDir, 'icon2.jpg'), 
        path.join(imagesDir, 'icon-48.png'),
        48
    );
    
    console.log('All icons converted successfully!');
}

main().catch(console.error);