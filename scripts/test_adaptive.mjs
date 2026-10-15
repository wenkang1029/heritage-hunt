import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const rawPhotosDir = 'C:\\Users\\User\\Projects\\heritage-hunt\\raw_photos';
const files = ['IMG_9264.jpeg', 'IMG_9345.jpeg', 'IMG_9385.jpeg', 'FullSizeRender.jpeg'];

for (const file of files) {
  const filePath = path.join(rawPhotosDir, file);
  // Test WebP
  const webpBuffer = await sharp(filePath)
    .rotate()
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 65 })
    .toBuffer();
  const webpBase64 = `data:image/webp;base64,${webpBuffer.toString('base64')}`;

  // Test JPEG with adaptive quality to ensure < 110 KB
  let q = 65;
  let maxDim = 800;
  let jpegBuffer = await sharp(filePath)
    .rotate()
    .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: q, mozjpeg: true })
    .toBuffer();

  while (jpegBuffer.length * 1.34 > 110 * 1024 && q > 40) {
    q -= 5;
    jpegBuffer = await sharp(filePath)
      .rotate()
      .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: q, mozjpeg: true })
      .toBuffer();
  }
  const jpegBase64 = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;

  console.log(`${file}:`);
  console.log(`  WebP (q=65): ${(Buffer.byteLength(webpBase64, 'utf8') / 1024).toFixed(1)} KB`);
  console.log(`  JPEG (q=${q}): ${(Buffer.byteLength(jpegBase64, 'utf8') / 1024).toFixed(1)} KB`);
}
