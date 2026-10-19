import fs from 'fs';

const content = fs.readFileSync('scripts/upload_all_clues.mjs', 'utf8');
const start = content.indexOf('const CLUES_CATALOG = [');
const end = content.indexOf('];\n\n// Helper to compress image', start) !== -1 
  ? content.indexOf('];\n\n// Helper to compress image', start) + 1 
  : content.indexOf('];', start) + 1;

const arrayStr = content.substring(content.indexOf('[', start), end);
const catalog = (new Function(`return ${arrayStr}`))();
fs.writeFileSync('scripts/extracted_catalog.json', JSON.stringify(catalog, null, 2), 'utf8');
console.log(`Successfully extracted ${catalog.length} clues to scripts/extracted_catalog.json`);
