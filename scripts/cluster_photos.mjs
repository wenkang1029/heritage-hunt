import fs from 'fs';

const clusters = JSON.parse(fs.readFileSync('scripts/clusters_geocoded.json', 'utf8'));
const allPhotos = [];

for (const c of clusters) {
  for (const p of c.photos) {
    allPhotos.push({
      file: p.file,
      time: p.time,
      zone: c.zone,
      lat: p.lat,
      lng: p.lng,
      clusterId: c.id,
      osmName: c.osmName,
      road: c.road || c.address?.road || c.address?.pedestrian || '',
    });
  }
}

allPhotos.sort((a,b) => a.time.localeCompare(b.time));
fs.writeFileSync('scripts/photo_inventory.json', JSON.stringify(allPhotos, null, 2));
console.log(`Generated photo_inventory.json with ${allPhotos.length} entries.`);

