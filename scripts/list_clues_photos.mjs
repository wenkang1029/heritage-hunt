import fs from 'fs';
const clues = JSON.parse(fs.readFileSync('src/data/cluesZh.json', 'utf8'));
for (let i = 0; i < clues.length; i++) {
  const c = clues[i];
  const photo = c.imageUrl ? c.imageUrl.split('/').pop() : '';
  console.log(`${i+1}\t${c.id}\t${photo}\t${c.title}`);
}
