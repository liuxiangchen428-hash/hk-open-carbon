#!/usr/bin/env node
// Make the small district map used by the website from the census GeoJSON.
//
//   node scripts/fetch-source.mjs src-censtatd-dc-2021
//   node scripts/make-district-map.mjs .cache/sources/src-censtatd-dc-2021.txt
//
// Input: 2021 Census District Council district boundaries (land only, WGS84) from CSDI.
// Output: data/map/hk-districts.json — simplified SVG paths in a 1000-wide box,
// plus the census population and household counts copied as published.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
if (!input) { console.error('Usage: node scripts/make-district-map.mjs <geojson or fetch-source text>'); process.exit(2); }

let raw = readFileSync(input, 'utf8');
if (raw.startsWith('# {')) raw = raw.slice(raw.indexOf('\n') + 1); // fetch-source header line
raw = raw.replace(/\n﻿?\d{4}-\d\d-\d\dT[\d:.]+Z /g, '\n'); // Actions log timestamps
const geo = JSON.parse(raw);

// Equirectangular projection scaled for Hong Kong's latitude; y grows downward.
const KX = Math.cos((22.35 * Math.PI) / 180);
const W = 1000;
const rings = (g) => (g.type === 'MultiPolygon' ? g.coordinates.flat() : g.coordinates);
const all = geo.features.flatMap((f) => rings(f.geometry).flat());
const lo = (arr) => arr.reduce((m, v) => (v < m ? v : m), Infinity), hi = (arr) => arr.reduce((m, v) => (v > m ? v : m), -Infinity);
const minX = lo(all.map((p) => p[0] * KX)), maxX = hi(all.map((p) => p[0] * KX));
const minY = lo(all.map((p) => p[1])), maxY = hi(all.map((p) => p[1]));
const S = W / (maxX - minX);
const H = Math.ceil((maxY - minY) * S);
const proj = ([lon, lat]) => [(lon * KX - minX) * S, (maxY - lat) * S];

// Douglas–Peucker on projected points.
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    let far = -1, fd = 0;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > fd) { fd = d; far = i; }
    }
    if (fd > tol) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
// A closed ring starts and ends on the same point, so split it at the point farthest from the start.
function simplifyRing(pts, tol) {
  let k = 0, fd = -1;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; k = i; } }
  return [...simplify(pts.slice(0, k + 1), tol), ...simplify(pts.slice(k), tol).slice(1)];
}
const area = (pts) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const f1 = (n) => Math.round(n * 10) / 10;

const districts = geo.features.map((f) => {
  const p = f.properties;
  const parts = rings(f.geometry)
    .map((r) => simplifyRing(r.map(proj), 0.45))
    .filter((r) => r.length >= 4 && area(r) >= 1.2); // drop specks smaller than about a pixel
  const d = parts.map((r) => `M${r.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`).join('');
  const xs = parts.flat().map((q) => q[0]), ys = parts.flat().map((q) => q[1]);
  // Label point: centre of the largest part's bounding box.
  const big = parts.reduce((a, b) => (area(b) > area(a) ? b : a));
  const bx = big.map((q) => q[0]), by = big.map((q) => q[1]);
  return {
    code: p.dc_class,
    zh: p.dc_chi,
    en: p.dc_eng,
    d,
    bbox: [f1(lo(xs)), f1(lo(ys)), f1(hi(xs)), f1(hi(ys))],
    label: [f1((lo(bx) + hi(bx)) / 2), f1((lo(by) + hi(by)) / 2)],
    population: p.t_pop,
    households: p.dh,
  };
}).sort((a, b) => a.code.localeCompare(b.code));

const out = {
  source: 'src-censtatd-dc-2021',
  note: 'Boundaries simplified for display (Douglas-Peucker, 0.45 px in a 1000 px wide map); population (t_pop) and domestic households (dh) copied from the 2021 Census as published.',
  viewBox: [0, 0, W, H],
  districts,
};
mkdirSync(join(root, 'data', 'map'), { recursive: true });
writeFileSync(join(root, 'data', 'map', 'hk-districts.json'), JSON.stringify(out));
console.log(`wrote data/map/hk-districts.json: ${districts.length} districts, ${W}x${H}, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
