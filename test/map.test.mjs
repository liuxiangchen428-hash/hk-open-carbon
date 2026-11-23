import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

const dir = new URL('../data/map/', import.meta.url);
const csv = (name) => {
  const [head, ...rows] = readFileSync(new URL(name, dir), 'utf8').trim().split('\n');
  const cols = head.split(',');
  return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [cols[i], v])));
};
const meta = yaml.load(readFileSync(new URL('map.yaml', dir), 'utf8'));
const sources = new Set(readFileSync(new URL('../../sources/registry.csv', dir), 'utf8').split('\n').map((l) => l.split(',')[0]));

test('map metadata cites registered sources', () => {
  for (const t of meta.tables) for (const s of t.sources) assert.ok(sources.has(s), s);
  assert.ok(sources.has(meta.boundaries.source));
});

test('district map has all 18 districts and each is in one supply area', () => {
  const geo = JSON.parse(readFileSync(new URL('hk-districts.json', dir), 'utf8'));
  assert.equal(geo.districts.length, 18);
  const codes = geo.districts.map((d) => d.code).sort();
  const areas = [...meta.supply_areas['HK-HKE'], ...meta.supply_areas['HK-CLP']].sort();
  assert.deepEqual(areas, codes);
  for (const d of geo.districts) {
    assert.ok(d.d.startsWith('M') && d.population > 0 && d.households > 0, d.code);
  }
});

test('HK Electric table: numbers only, customer-type parts add up to the printed total', () => {
  const rows = csv('hke-district-consumption.csv');
  assert.ok(rows.length >= 45);
  for (const r of rows) {
    for (const k of ['consumption_gwh', 'customers_k', 'avg_kwh', 'residential_gwh', 'commercial_gwh', 'industrial_gwh']) assert.match(r[k], /^\d+(\.\d+)?$/, `${r.year}${r.half}${r.district} ${k}`);
    const parts = +r.residential_gwh + +r.commercial_gwh + +r.industrial_gwh;
    assert.ok(Math.abs(parts - +r.total_by_type_gwh) <= 2, `${r.year}${r.half}${r.district}`);
  }
});

test('CLP renewables table: months are continuous and generation parts add up', () => {
  const rows = csv('clp-renewables-by-region.csv');
  const months = [...new Set(rows.map((r) => r.month))].sort();
  for (let i = 1; i < months.length; i++) {
    const [y, m] = months[i - 1].split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    assert.equal(months[i], next);
  }
  for (const r of rows) assert.ok(Math.abs(+r.solar_wind_kwh + +r.other_kwh - +r.total_kwh) <= 1, `${r.month} ${r.region}`);
});
