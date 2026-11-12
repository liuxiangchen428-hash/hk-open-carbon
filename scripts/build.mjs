#!/usr/bin/env node
// Usage: npm run build
// Validates the data, then writes the release bundle to dist/:
//   factors.json  factors.csv  sources.json  meta.json
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateRepo } from './lib/validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { errors, factors, sources } = validateRepo({
  schemaDir: join(root, 'schema'),
  factorsDir: join(root, 'data', 'factors'),
  registryPath: join(root, 'sources', 'registry.csv'),
});
if (errors.length) {
  for (const e of errors) console.error(`error    ${e}`);
  console.error('\nBuild stopped: fix validation errors first (npm run validate).');
  process.exit(1);
}

const out = join(root, 'dist');
mkdirSync(out, { recursive: true });

const records = factors
  .map(({ _file, ...f }) => f)
  .sort((a, b) => a.id.localeCompare(b.id));

const csvCols = ['id', 'name_zh_hant', 'name_en', 'category', 'gas', 'gwp', 'value', 'unit', 'year', 'region',
  'scope', 'boundary', 'source_id', 'source_page', 'source_table', 'quality', 'status'];
const esc = (v) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const csv = [csvCols.join(',')]
  .concat(records.map((f) => [f.id, f.name['zh-Hant'], f.name.en, f.category, f.gas, f.gwp, f.value, f.unit,
    f.year, f.region, f.scope, f.boundary, f.source.id, f.source.page, f.source.table, f.quality, f.status]
    .map(esc).join(',')))
  .join('\n') + '\n';

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const meta = {
  version: pkg.version,
  built_at: new Date().toISOString(),
  factor_count: records.length,
  source_count: sources.length,
  license: { code: 'Apache-2.0', data: 'CC-BY-4.0' },
};

writeFileSync(join(out, 'factors.json'), JSON.stringify(records, null, 2) + '\n');
writeFileSync(join(out, 'factors.csv'), '﻿' + csv); // BOM so Excel opens Chinese text correctly
writeFileSync(join(out, 'sources.json'), JSON.stringify(sources, null, 2) + '\n');
writeFileSync(join(out, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log(`Built dist/ with ${records.length} factors and ${sources.length} sources.`);
