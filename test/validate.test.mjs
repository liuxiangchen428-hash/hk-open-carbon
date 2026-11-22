import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateRepo, parseCsv } from '../scripts/lib/validate.mjs';
import { validateInventory } from '../scripts/lib/inventory.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaDir = join(root, 'schema');
const has = (list, ...parts) => list.some((m) => parts.every((p) => m.includes(p)));

test('repository data passes validation', () => {
  const r = validateRepo({
    schemaDir,
    factorsDir: join(root, 'data', 'factors'),
    registryPath: join(root, 'sources', 'registry.csv'),
    inventoryDir: join(root, 'data', 'inventory'),
  });
  assert.deepEqual(r.errors, []);
  assert.ok(r.factors.length > 0);
  assert.ok(r.inventory.length > 0 && r.inventory[0].rows.length > 0);
});

test('bad fixtures produce the expected errors', () => {
  const bad = join(root, 'test', 'fixtures', 'bad');
  const { errors, warnings } = validateRepo({
    schemaDir,
    factorsDir: join(bad, 'factors'),
    registryPath: join(bad, 'registry.csv'),
    currentYear: 2026,
  });
  assert.ok(has(errors, 'duplicate source id "src-ok"'));
  assert.ok(has(errors, 'url_status "maybe"'));
  assert.ok(has(errors, 'reuse "free"'));
  assert.ok(has(errors, 'checked_on must be YYYY-MM-DD'));
  assert.ok(has(errors, 'reviewed-unconfirmed.yaml', 'confirmed source link'));
  assert.ok(has(warnings, '1 factor(s) use "src-gov"', 'restrict commercial reuse'));
  assert.ok(has(errors, 'missing-source.yaml', 'src-not-registered'));
  assert.ok(has(errors, 'bad-unit.yaml', 'not allowed'));
  assert.ok(has(errors, 'bad-unit.yaml', 'page or table'));
  assert.ok(has(errors, 'wrong-folder.yaml', 'must live under transport/rail/'));
  assert.ok(has(errors, 'missing-gwp.yaml', 'gwp'), 'CO2e without gwp');
  assert.ok(has(errors, 'schema-fail.yaml', '/value'));
  assert.ok(has(errors, 'schema-fail.yaml', '/region'));
  assert.ok(has(errors, 'schema-fail.yaml', '/quality'));
  assert.ok(has(errors, 'schema-fail.yaml', '/name'));
  assert.ok(has(warnings, 'wrong-folder.yaml', 'years old'));
});

test('stale local factors raise a warning, not an error', () => {
  const bad = join(root, 'test', 'fixtures', 'stale');
  const { errors, warnings } = validateRepo({
    schemaDir,
    factorsDir: join(bad, 'factors'),
    registryPath: join(bad, 'registry.csv'),
    currentYear: 2026,
  });
  assert.deepEqual(errors, []);
  assert.ok(has(warnings, 'old.yaml', 'more than 2 years old'));
  assert.ok(!warnings.some((w) => w.startsWith('energy/town-gas/older.yaml')), 'older years in a series are not flagged');
});

test('CSV parser handles quotes, commas and escaped quotes', () => {
  const rows = parseCsv('a,b\n"x, y","say ""hi"""\n');
  assert.deepEqual(rows, [{ a: 'x, y', b: 'say "hi"' }]);
});

test('CSV writer round-trips through the parser', async () => {
  const { toCsv, waybackTimestampToDate } = await import('../scripts/lib/csv.mjs');
  const rows = [{ a: 'x, y', b: 'say "hi"' }, { a: 'plain', b: '' }];
  assert.deepEqual(parseCsv(toCsv(['a', 'b'], rows)), rows);
  assert.equal(waybackTimestampToDate('20240131235959'), '2024-01-31');
  assert.equal(waybackTimestampToDate(''), '');
});

test('archive_url format is checked', () => {
  const dir = join(root, 'test', 'fixtures', 'archive');
  const { errors } = validateRepo({
    schemaDir,
    factorsDir: join(dir, 'factors'),
    registryPath: join(dir, 'registry.csv'),
  });
  assert.ok(has(errors, 'row 2', 'archive_url must look like'));
  assert.ok(has(errors, 'row 3', 'archived_on must be YYYY-MM-DD'));
  assert.equal(errors.length, 2);
});

test('double-entry verification is enforced', () => {
  const dir = join(root, 'test', 'fixtures', 'verify');
  const { errors } = validateRepo({
    schemaDir,
    factorsDir: join(dir, 'factors'),
    registryPath: join(dir, 'registry.csv'),
  });
  assert.ok(has(errors, 'mismatch.yaml', 'read 10, but value is 100'));
  assert.ok(has(errors, 'one-check.yaml', 'two verification entries'));
  assert.ok(has(errors, 'no-maintainer.yaml', 'by the maintainer'));
  assert.ok(!errors.some((e) => e.includes('good.yaml')), 'a correctly verified factor passes');
});

test('inventory tables catch typos, gaps and missing sources', () => {
  const dir = join(root, 'test', 'fixtures', 'inventory');
  const { errors } = validateInventory({ dir, sources: [{ id: 'src-ok', url_status: 'found' }] });
  assert.ok(has(errors, 'line 3', 'sectors add up to'), 'sector typo');
  assert.ok(has(errors, 'line 4', 'should follow'), 'year gap');
  assert.ok(has(errors, 'line 5', 'must be a non-negative number'), 'thousands separator');
  assert.ok(has(errors, 'src-missing', 'not in sources/registry.csv'));
  assert.ok(has(errors, 'reviewed table needs a verification entry by the maintainer'));
  assert.ok(!errors.some((e) => e.includes('line 2:')), 'a row that adds up within rounding passes');
});
