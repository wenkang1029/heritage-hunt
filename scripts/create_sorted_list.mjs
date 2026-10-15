import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scripts/photo_analysis.json', 'utf8'));
data.sort((a,b) => new Date(a.dateTime) - new Date(b.dateTime));

const output = data.map((p, idx) => ({
  index: idx + 1,
  file: p.file,
  time: p.dateTime?.substring(11, 19),
  zone: p.zoneId,
  lat: Number(p.latitude.toFixed(6)),
  lng: Number(p.longitude.toFixed(6)),
  dist: p.distanceToZone,
}));

fs.writeFileSync('scripts/sorted_photos.json', JSON.stringify(output, null, 2));
console.log('Saved sorted_photos.json');
