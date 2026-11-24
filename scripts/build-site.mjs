#!/usr/bin/env node
// Build the static website into site-dist/.
//
//   npm run site            build
//   npm run site -- --serve build, then serve on http://localhost:4173
//
// The site is plain HTML/CSS/JS with no runtime dependencies. Data is
// validated first; the build stops on validation errors.

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { validateRepo } from './lib/validate.mjs';
import { layout } from '../site/src/layout.mjs';
import { pages } from '../site/src/pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'site-dist');
const factorsDir = join(root, 'data', 'factors');

const { errors, factors, sources, inventory } = validateRepo({
  schemaDir: join(root, 'schema'),
  factorsDir,
  registryPath: join(root, 'sources', 'registry.csv'),
  inventoryDir: join(root, 'data', 'inventory'),
});
if (errors.length) {
  for (const e of errors) console.error(`error    ${e}`);
  console.error('\nSite build stopped: fix validation errors first (npm run validate).');
  process.exit(1);
}

// Keep each value exactly as written (e.g. "0.60", "74100"), so the site shows
// the published precision rather than JavaScript's number formatting.
const rawValue = (file) => {
  const m = readFileSync(join(factorsDir, file), 'utf8').match(/^value:\s*(\S+)\s*$/m);
  return m ? m[1] : null;
};

const categoryTree = yaml.load(readFileSync(join(root, 'schema', 'categories.yaml'), 'utf8'));
const categories = [];
for (const [key, node] of Object.entries(categoryTree)) {
  for (const [child, leaf] of Object.entries(node.children ?? {})) {
    categories.push({ id: `${key}/${child}`, group: key, groupName: node.name, name: leaf.name });
  }
}

// District map: boundaries, supply areas and the two published tables (see data/map/map.yaml).
const mapDir = join(root, 'data', 'map');
const mapMeta = yaml.load(readFileSync(join(mapDir, 'map.yaml'), 'utf8'));
const readCsv = (file) => {
  const [head, ...rows] = readFileSync(join(mapDir, file), 'utf8').trim().split('\n');
  const cols = head.split(',');
  return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [cols[i], /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v])));
};
const mapData = {
  ...JSON.parse(readFileSync(join(mapDir, 'hk-districts.json'), 'utf8')),
  status: mapMeta.status,
  supply: mapMeta.supply_areas,
  hke: readCsv('hke-district-consumption.csv'),
  clpRe: readCsv('clp-renewables-by-region.csv'),
  notes: { boundaries: mapMeta.boundaries.notes, supply: mapMeta.supply_areas.source_note, clpRe: mapMeta.tables.find((t) => t.file === 'clp-renewables-by-region.csv').notes },
  sources: [mapMeta.boundaries.source, ...mapMeta.tables.flatMap((t) => t.sources)],
};

const usedSources = new Set(factors.map((f) => f.source.id));
for (const s of mapData.sources) usedSources.add(s);
for (const t of inventory) for (const c of [...Object.values(t.columns), ...(t.targets ?? [])]) usedSources.add(c.source);
const data = {
  built: new Date().toISOString().slice(0, 10),
  version: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
  categories,
  factors: factors
    .map(({ _file, ...f }) => ({ ...f, value_text: rawValue(_file) ?? String(f.value), file: `data/factors/${_file}` }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id)),
  sources: sources.map((s) => ({ ...s, used: usedSources.has(s.id) })),
  inventory,
};

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });
mkdirSync(join(out, 'api', 'v1'), { recursive: true });
cpSync(join(root, 'site', 'assets'), join(out, 'assets'), { recursive: true });

writeFileSync(join(out, 'assets', 'data.json'), JSON.stringify(data));
writeFileSync(join(out, 'assets', 'map.json'), JSON.stringify(mapData));
// Public, stable API files (same content as the release bundle).
writeFileSync(join(out, 'api', 'v1', 'factors.json'), JSON.stringify(data.factors.map(({ value_text, file, ...f }) => f), null, 2));
writeFileSync(join(out, 'api', 'v1', 'inventory.json'), JSON.stringify(inventory, null, 2));
for (const tb of inventory) cpSync(join(root, 'data', 'inventory', tb.file), join(out, 'api', 'v1', tb.file));
writeFileSync(join(out, 'api', 'v1', 'sources.json'), JSON.stringify(sources, null, 2));

const stats = {
  factors: data.factors.length,
  reviewed: data.factors.filter((f) => f.status === 'reviewed').length,
  sources: data.sources.filter((s) => s.used).length,
  built: data.built,
};
// Version tag for asset URLs, so browsers fetch new CSS/JS/data after each change instead of a cached copy.
const hash = createHash('sha256');
for (const f of ['style.css', 'app.js', 'map.js', 'biz.js', 'data.json', 'map.json', 'favicon.svg', 'icon-180.png']) hash.update(readFileSync(join(out, 'assets', f)));
stats.v = hash.digest('hex').slice(0, 10);
for (const page of pages) {
  writeFileSync(join(out, page.file), layout({ ...page, body: page.body(stats), stats }));
}
writeFileSync(join(out, '.nojekyll'), '');
// The method page was merged into sources.html; keep the old link working.
writeFileSync(join(out, 'methodology.html'), '<!doctype html><meta charset="utf-8"><title>Sources &amp; method</title>'
  + '<meta http-equiv="refresh" content="0; url=sources.html#method"><link rel="canonical" href="sources.html#method">'
  + '<p><a href="sources.html#method">sources.html#method</a></p>');
console.log(`Built site-dist/ with ${stats.factors} factors (${stats.reviewed} reviewed) and ${pages.length} pages.`);

if (process.argv.includes('--serve')) {
  const types = { '.csv': 'text/csv; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
  createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    try {
      const body = readFileSync(join(out, p));
      res.writeHead(200, { 'Content-Type': types[extname(p)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  }).listen(4173, () => console.log('Serving on http://localhost:4173'));
}
