const sharp = require('sharp');

async function compressImage(buffer) {
    return await sharp(buffer)
        .rotate()
        .resize({
            width: 1920,
            withoutEnlargement: true
        })
        .webp({
            quality: 82
        })
        .toBuffer();
}

module.exports = compressImage;