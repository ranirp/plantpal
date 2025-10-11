const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

async function convertJpgToPng(inputPath, outputPath, size) {
    try {
        const image = await loadImage(inputPath);
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        
        // Draw image on canvas (resizing if needed)
        ctx.drawImage(image, 0, 0, size, size);
        
        // Create PNG stream and save to file
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

async function main() {
    const imagesDir = path.join(__dirname, 'public', 'images');
    
    // Create the icons
    await convertJpgToPng(
        path.join(imagesDir, 'icon1.jpg'), 
        path.join(imagesDir, 'icon-512.png'),
        512
    );
    
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