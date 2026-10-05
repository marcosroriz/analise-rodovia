// Converte o CSV original (Latin-1, ~10 MB) em src/data/dataset.json
// (colunar, compacto). Executado automaticamente antes de `dev` e `build`.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeBuffer, parseCsv } from '../src/lib/csv.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = resolve(root, process.argv[2] || 'volume-radar-trans.csv');
const output = resolve(root, 'src/data/dataset.json');

const ds = parseCsv(decodeBuffer(readFileSync(input)), basename(input));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(ds));
console.log(`dataset.json: ${ds.meta.records} registros, ${ds.equip.length} equipamentos` +
  (ds.meta.skipped ? `, ${ds.meta.skipped} linhas ignoradas` : ''));
