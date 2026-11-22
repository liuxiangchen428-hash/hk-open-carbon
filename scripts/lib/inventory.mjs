// Validation for data/inventory/: one YAML metadata file per table, each
// pointing at a CSV with one row per year. Returns { errors, warnings, tables }.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { parseCsv } from './validate.mjs';

const SECTORS = ['electricity', 'transport', 'other_fuel', 'waste', 'ippu', 'afolu'];

// Half of the last published digit for a value rounded to `sig` significant figures.
const halfUnit = (v, sig = 3) => (v === 0 ? 0.5 : 0.5 * 10 ** (Math.floor(Math.log10(Math.abs(v))) - sig + 1));

export function validateInventory({ dir, sources }) {
  const errors = [];
  const warnings = [];
  const tables = [];
  const err = (file, msg) => errors.push(`${file}: ${msg}`);
  if (!existsSync(dir)) return { errors, warnings, tables };
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  for (const name of readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort()) {
    const rel = `data/inventory/${name}`;
    let meta;
    try {
      meta = yaml.load(readFileSync(join(dir, name), 'utf8'), { schema: yaml.CORE_SCHEMA });
    } catch (e) {
      err(rel, `YAML parse error: ${e.message.split('\n')[0]}`);
      continue;
    }
    for (const k of ['id', 'file', 'name', 'gwp', 'status', 'columns', 'pages']) if (meta?.[k] == null) err(rel, `missing "${k}"`);
    if (!meta?.file || !meta.columns) continue;
    if (!['draft', 'reviewed'].includes(meta.status)) err(rel, `status "${meta.status}" must be draft or reviewed`);

    const used = new Set();
    for (const [col, c] of Object.entries(meta.columns)) {
      if (!c['zh-Hant'] || !c.en || !c.unit || !c.source) err(rel, `column "${col}" needs zh-Hant, en, unit and source`);
      if (c.source && !sourceById.has(c.source)) err(rel, `column "${col}" source "${c.source}" is not in sources/registry.csv`);
      if (c.source) used.add(c.source);
    }
    for (const id of used) if (!meta.pages?.[id]) err(rel, `pages must give the page for "${id}"`);

    const checks = meta.verification ?? [];
    for (const v of checks) {
      if (!/^(maintainer|claude|contributor:[A-Za-z0-9-]+)$/.test(v.by ?? '')) err(rel, `verification by "${v.by}" is not valid`);
      if (!['pdf-visual', 'text-extract', 'recalculation'].includes(v.method)) err(rel, `verification method "${v.method}" is not valid`);
    }
    if (meta.status === 'reviewed') {
      const distinct = new Set(checks.map((v) => `${v.by}|${v.method}`));
      if (distinct.size < 2) err(rel, 'reviewed table needs two verification entries that differ in by or method');
      if (!checks.some((v) => v.by === 'maintainer')) err(rel, 'reviewed table needs a verification entry by the maintainer');
      for (const id of used) if (sourceById.get(id)?.url_status !== 'found') err(rel, `reviewed table needs a confirmed source link for "${id}"`);
    }

    for (const tg of meta.targets ?? []) {
      if (!tg.source || !sourceById.has(tg.source)) err(rel, `target "${tg.id}" source "${tg.source}" is not in sources/registry.csv`);
      if (!tg.page) err(rel, `target "${tg.id}" needs a page`);
    }

    const csvRel = `data/inventory/${meta.file}`;
    const csvPath = join(dir, meta.file);
    if (!existsSync(csvPath)) { err(rel, `file "${meta.file}" not found`); continue; }
    const rows = parseCsv(readFileSync(csvPath, 'utf8'));
    const header = rows.length ? Object.keys(rows[0]) : [];
    const expected = ['year', ...Object.keys(meta.columns)];
    if (header.join(',') !== expected.join(',')) err(csvRel, `header must be "${expected.join(',')}" (same order as columns in ${name})`);

    const data = [];
    let prev;
    for (const [i, r] of rows.entries()) {
      const line = i + 2;
      const year = Number(r.year);
      if (!Number.isInteger(year) || year < 1990 || year > 2100) { err(csvRel, `line ${line}: bad year "${r.year}"`); continue; }
      if (prev !== undefined && year !== prev + 1) err(csvRel, `line ${line}: year ${year} should follow ${prev} with no gaps or repeats`);
      prev = year;
      const row = { year };
      for (const col of Object.keys(meta.columns)) {
        const txt = r[col] ?? '';
        if (!/^\d+(\.\d+)?$/.test(txt)) { err(csvRel, `line ${line}: ${col} "${txt}" must be a non-negative number without separators`); continue; }
        row[col] = Number(txt);
      }
      // Sectors are rounded to 3 significant figures, so allow the summed rounding error.
      if (SECTORS.every((s) => s in row) && 'total' in row) {
        const sum = SECTORS.reduce((a, s) => a + row[s], 0);
        const slack = SECTORS.reduce((a, s) => a + halfUnit(row[s]), halfUnit(row.total));
        if (Math.abs(sum - row.total) > slack) err(csvRel, `line ${line}: sectors add up to ${sum}, total is ${row.total} (more than rounding allows; check for a typo)`);
      }
      data.push(row);
    }
    tables.push({ ...meta, rows: data });
  }
  return { errors, warnings, tables };
}
