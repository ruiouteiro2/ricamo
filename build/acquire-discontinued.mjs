// Records which articles public sources declare out of production. "Sold out" is never evidence.
// DMC comes from Lord Libidan's compiled list (not a DMC publication), so a code still sold in
// the bundled Mouliné catalogue is left out and counted. Mill Hill entries each name their page.
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundledSupplierProducts, supplierIdentity } from '../core/supplier-products.mjs';

const root = join(import.meta.dirname, '..'), cache = join(root, '.runtime', 'discontinued');
mkdirSync(cache, { recursive: true });
const DMC_LIST = 'https://lordlibidan.com/full-list-of-discontinued-dmc-threads/';
const MILL_HILL = JSON.parse(readFileSync(join(root, 'data', 'mill-hill-out-of-production.json'), 'utf8')).map(row => ({ code: row.code, name: row.colour, replacement: row.replacement, source: row.page }));

const path = join(cache, 'dmc-list.html');
if (!existsSync(path)) {
  const response = await fetch(DMC_LIST, { headers: { 'User-Agent': 'Ricamo offline catalogue preview reference' } });
  if (!response.ok) throw new Error(`DMC list refused: ${response.status}`);
  writeFileSync(path, await response.text());
}
const clean = value => value.replace(/<[^>]+>/g, ' ').replace(/&#?\w+;/g, ' ').replace(/[^\x20-\x7e]+/g, ' ').replace(/\s+/g, ' ').trim();
const tables = readFileSync(path, 'utf8').match(/<table[\s\S]*?<\/table>/g) ?? [];
if (tables.length !== 5) throw new Error(`Unexpected DMC list layout: ${tables.length} tables`);
// Only the solid and variegated tables are stranded cotton. Metallic, rayon and perfumed threads are other lines.
const listed = tables.slice(0, 2).flatMap(table => [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].slice(1).map(row => [...row[0].matchAll(/<t[dh]\b[\s\S]*?<\/t[dh]>/g)].map(cell => clean(cell[0]))));
const sold = new Set(bundledSupplierProducts().filter(row => row.category === 'thread' && row.code).map(supplierIdentity));
const contradicted = [], dmc = [];
for (const [code, name, replacement, when] of listed) {
  if (sold.has(supplierIdentity({ brand: 'DMC', range: 'Mouliné', code }))) { contradicted.push(code); continue; }
  dmc.push({ brand: 'DMC', range: 'Mouliné', code, name, replacement: /no replacement/i.test(replacement) ? '' : replacement, when, source: DMC_LIST });
}
const entries = [...MILL_HILL.map(row => ({ brand: 'Mill Hill', range: '', when: '', ...row })), ...dmc];
writeFileSync(join(root, 'data', 'discontinued-materials.json'), `${JSON.stringify({ format: 'ricamo-discontinued-materials', version: 1, retrievedAt: new Date().toISOString(), contradictedBySoldCatalogue: contradicted, entries }, null, 1)}\n`);
console.log(JSON.stringify({ listed: listed.length, dmc: dmc.length, contradicted, millHill: MILL_HILL.length, sample: dmc.slice(0, 3) }));
