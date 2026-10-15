import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const rawPhotosDir = 'C:\\Users\\User\\Projects\\heritage-hunt\\raw_photos';
const files = ['IMG_9264.jpeg', 'IMG_9345.jpeg', 'IMG_9385.jpeg', 'FullSizeRender.jpeg'];

for (const file of files) {
  const filePath = path.join(rawPhotosDir, file);
  // Auto-rotate based on EXIF orientation!
  const buffer = await sharp(filePath)
    .rotate() // automatically rotates according to EXIF Orientation tag
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 65, mozjpeg: true })
    .toBuffer();

  const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
  const sizeKb = Buffer.byteLength(base64, 'utf8') / 1024;
  console.log(`${file}: original size ${(fs.statSync(filePath).size / (1024*1024)).toFixed(2)}MB -> compressed base64 size ${sizeKb.toFixed(1)} KB`);
}
