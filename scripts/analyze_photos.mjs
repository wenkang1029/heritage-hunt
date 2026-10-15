import fs from 'fs';
import path from 'path';
import exifr from 'exifr';
import sharp from 'sharp';

const rawPhotosDir = 'C:\\Users\\User\\Projects\\heritage-hunt\\raw_photos';
const files = fs.readdirSync(rawPhotosDir).filter(f => f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.jpg'));

console.log(`Found ${files.length} photos.`);

const ZONES = [
  { id: 'dutch-square', name: 'Dutch Square & Stadhuys', center: { latitude: 2.1942, longitude: 102.2493 } },
  { id: 'jonker-street', name: 'Jonker Street', center: { latitude: 2.1963, longitude: 102.2472 } },
  { id: 'jalan-tokong', name: 'Harmony Street', center: { latitude: 2.1977, longitude: 102.2462 } },
  { id: 'a-famosa', name: 'A Famosa & Porta de Santiago', center: { latitude: 2.1918, longitude: 102.2505 } },
  { id: 'st-pauls-hill', name: "St. Paul's Hill", center: { latitude: 2.1928, longitude: 102.2494 } },
];

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getClosestZone(lat, lng) {
  let minDistance = Infinity;
  let closestZone = ZONES[0].id;
  for (const zone of ZONES) {
    const d = haversineDistance(lat, lng, zone.center.latitude, zone.center.longitude);
    if (d < minDistance) {
      minDistance = d;
      closestZone = zone.id;
    }
  }
  return { zoneId: closestZone, distance: minDistance };
}

const photoData = [];

for (const file of files) {
  const filePath = path.join(rawPhotosDir, file);
  const metadata = await sharp(filePath).metadata();
  const gps = await exifr.gps(filePath);
  const exif = await exifr.parse(filePath, ['DateTimeOriginal', 'CreateDate', 'Make', 'Model']);

  let lat = gps?.latitude;
  let lng = gps?.longitude;

  let zoneInfo = null;
  if (lat && lng) {
    zoneInfo = getClosestZone(lat, lng);
  }

  photoData.push({
    file,
    width: metadata.width,
    height: metadata.height,
    hasGps: Boolean(lat && lng),
    latitude: lat,
    longitude: lng,
    zoneId: zoneInfo?.zoneId,
    distanceToZone: Math.round(zoneInfo?.distance || 0),
    dateTime: exif?.DateTimeOriginal || exif?.CreateDate,
  });
}

// Sort by file name or date
console.log('Summary:');
const withoutGps = photoData.filter(p => !p.hasGps);
console.log(`Photos with GPS: ${photoData.length - withoutGps.length}`);
console.log(`Photos without GPS: ${withoutGps.length}`);
if (withoutGps.length > 0) {
  console.log('Without GPS:', withoutGps.map(p => p.file));
}

const zoneCounts = {};
for (const p of photoData) {
  const z = p.zoneId || 'unknown';
  zoneCounts[z] = (zoneCounts[z] || 0) + 1;
}
console.log('Zone counts:', zoneCounts);

fs.writeFileSync('C:\\Users\\User\\Projects\\heritage-hunt\\scripts\\photo_analysis.json', JSON.stringify(photoData, null, 2));
console.log('Saved to scripts/photo_analysis.json');
