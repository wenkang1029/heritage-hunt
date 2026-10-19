import fs from 'fs';

const clues = JSON.parse(fs.readFileSync('src/data/cluesZh.json', 'utf8'));
const lines = [];
clues.forEach((c) => {
  lines.push(`${c.id} [${c.file}]`);
  lines.push(`  标题: ${c.title}`);
  lines.push(`  地标: ${c.landmarkName}`);
  lines.push(`  描述: ${c.description}`);
  lines.push(`  提示: ${c.hint}\n`);
});

fs.writeFileSync('scripts/all_clues_output.txt', lines.join('\n'), 'utf8');
console.log('Wrote', clues.length, 'clues to scripts/all_clues_output.txt');
