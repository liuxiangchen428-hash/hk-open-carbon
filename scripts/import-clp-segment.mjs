#!/usr/bin/env node
// Convert CLP's open-data CSV "Sale by segment" (quarterly blocks, bilingual labels)
// into one tidy table: data/benchmarks/clp-sales-by-segment.csv.
// Usage: node scripts/import-clp-segment.mjs <downloaded CLP csv>
// Values are copied as published (thousands separators removed); nothing is computed.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/import-clp-segment.mjs <csv>'); process.exit(1); }

const SEG = { Residential: 'residential', Manufacturing: 'manufacturing', Commercial: 'commercial', 'Infrastructure & Public Services': 'infrastructure_public', 'Local Sales': 'local_total' };

// Minimal CSV line parser (quoted fields with commas).
const cells = (line) => {
  const out = []; let cur = ''; let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
};
const num = (s) => {
  const v = Number(String(s).replace(/,/g, ''));
  if (!Number.isFinite(v)) throw new Error(`Not a number: ${s}`);
  return v;
};

const text = readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r/g, '');
const rows = [];
let quarter = null;
for (const line of text.split('\n')) {
  const c = cells(line.replace(/^﻿/, ''));
  const head = c.join(' ').match(/Quarter\s+([1-4])\s+(\d{4})/);
  if (head) { quarter = `${head[2]}-Q${head[1]}`; continue; }
  const seg = Object.keys(SEG).find((k) => c[0]?.endsWith(` ${k}`) || c[0] === k);
  if (!seg || !quarter) continue;
  rows.push({ quarter, segment: SEG[seg], sales_gwh: num(c[1]), customers_k: num(c[2]), mean_kwh: num(c[3]) });
}
rows.sort((a, b) => a.quarter.localeCompare(b.quarter) || Object.values(SEG).indexOf(a.segment) - Object.values(SEG).indexOf(b.segment));
const quarters = new Set(rows.map((r) => r.quarter));
for (const q of quarters) {
  const n = rows.filter((r) => r.quarter === q).length;
  if (n !== 5) throw new Error(`${q}: expected 5 segments, found ${n}`);
}
const out = ['quarter,segment,sales_gwh,customers_k,mean_kwh', ...rows.map((r) => [r.quarter, r.segment, r.sales_gwh, r.customers_k, r.mean_kwh].join(','))].join('\n') + '\n';
writeFileSync(join(root, 'data', 'benchmarks', 'clp-sales-by-segment.csv'), out);
console.log(`Wrote ${rows.length} rows, ${quarters.size} quarters (${[...quarters][0]} to ${[...quarters].at(-1)}).`);
