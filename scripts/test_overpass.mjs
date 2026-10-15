import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scripts/sorted_photos.json', 'utf8'));

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const clusters = [];
for (const p of data) {
  let matched = false;
  for (const c of clusters) {
    if (haversineDistance(p.lat, p.lng, c.centerLat, c.centerLng) < 15) {
      c.photos.push(p);
      matched = true;
      break;
    }
  }
  if (!matched) {
    clusters.push({
      id: clusters.length + 1,
      zone: p.zone,
      centerLat: p.lat,
      centerLng: p.lng,
      photos: [p]
    });
  }
}

async function lookup() {
  const results = [];
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${c.centerLat}&lon=${c.centerLng}&format=json&zoom=18`;
      const res = await fetch(url, { headers: { 'User-Agent': 'MelakaHeritageHuntBot/1.0 (contact@melakahunt.org)' } });
      const json = await res.json();
      c.osmName = json.name || json.display_name?.split(',')[0];
      c.address = json.address;
      c.displayName = json.display_name;
      console.log(`[${i+1}/${clusters.length}] Cluster #${c.id} (${c.zone}): ${c.osmName} | road: ${c.address?.road || c.address?.pedestrian}`);
    } catch (e) {
      console.log(`[${i+1}/${clusters.length}] Cluster #${c.id} error:`, e.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  fs.writeFileSync('scripts/clusters_geocoded.json', JSON.stringify(clusters, null, 2));
  console.log('Saved clusters_geocoded.json');
}

lookup();


