import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

const dir = new URL('../data/benchmarks/', import.meta.url);
const [head, ...lines] = readFileSync(new URL('clp-sales-by-segment.csv', dir), 'utf8').trim().split('\n');
const cols = head.split(',');
const rows = lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], i < 2 ? v : Number(v)])));
const meta = yaml.load(readFileSync(new URL('benchmarks.yaml', dir), 'utf8'));
const sources = new Set(readFileSync(new URL('../../sources/registry.csv', dir), 'utf8').split('\n').map((l) => l.split(',')[0]));

test('benchmark tables cite registered sources', () => {
  for (const t of meta.tables) assert.ok(sources.has(t.source), t.source);
  assert.ok(['draft', 'reviewed'].includes(meta.status));
});

test('CLP sales by segment: five segments a quarter, segments add up to local sales', () => {
  const quarters = [...new Set(rows.map((r) => r.quarter))];
  for (const q of quarters) {
    assert.match(q, /^\d{4}-Q[1-4]$/);
    const g = rows.filter((r) => r.quarter === q);
    assert.equal(g.length, 5, q);
    const total = g.find((r) => r.segment === 'local_total');
    const parts = g.filter((r) => r.segment !== 'local_total').reduce((a, r) => a + r.sales_gwh, 0);
    assert.ok(Math.abs(parts - total.sales_gwh) <= 3, `${q}: ${parts} vs ${total.sales_gwh}`);
    for (const r of g) assert.ok(r.sales_gwh > 0 && r.customers_k > 0 && r.mean_kwh > 0, `${q} ${r.segment}`);
  }
});
