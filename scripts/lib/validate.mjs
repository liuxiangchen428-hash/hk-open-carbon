// Data validation for hk-carbon-db.
// Returns { errors, warnings, factors, sources } so the CLI, the build and the
// tests all share one implementation.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';

const STALE_AFTER_YEARS = 2;
const REQUIRED_SOURCE_COLUMNS = ['title', 'publisher', 'type', 'url', 'url_status', 'reuse', 'checked_on'];
// See sources/README.md for what each value means.
const URL_STATUS = new Set(['found', 'inferred', 'homepage', 'to-check']);
const REUSE = new Set(['open-attribution', 'noncommercial-or-permission', 'quote-with-attribution', 'reference-only', 'check', 'n/a']);

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, newlines in quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== '')) rows.push(row);
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function walk(dir, ext) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}

/** Leaf category paths, e.g. ["energy/fuel", ...]. */
function leafCategories(tree, prefix = '') {
  const out = [];
  for (const [key, node] of Object.entries(tree ?? {})) {
    const path = prefix ? `${prefix}/${key}` : key;
    if (node?.children) out.push(...leafCategories(node.children, path));
    else out.push(path);
  }
  return out;
}

/**
 * @param {object} opts
 * @param {string} opts.schemaDir    folder with factor.schema.json, categories.yaml, units.yaml
 * @param {string} opts.factorsDir   folder with factor YAML files (nested by category)
 * @param {string} opts.registryPath sources/registry.csv
 * @param {number} [opts.currentYear]
 */
export function validateRepo({ schemaDir, factorsDir, registryPath, currentYear = new Date().getFullYear() }) {
  const errors = [];
  const warnings = [];
  const err = (file, msg) => errors.push(`${file}: ${msg}`);
  const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

  const schema = JSON.parse(readFileSync(join(schemaDir, 'factor.schema.json'), 'utf8'));
  const categories = new Set(leafCategories(yaml.load(readFileSync(join(schemaDir, 'categories.yaml'), 'utf8'))));
  const units = yaml.load(readFileSync(join(schemaDir, 'units.yaml'), 'utf8'));
  const emissionUnits = new Set(units.emission);
  const activityUnits = new Set(units.activity);

  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
  addFormats(ajv);
  const checkSchema = ajv.compile(schema);

  // --- sources registry ---
  const sources = parseCsv(readFileSync(registryPath, 'utf8'));
  const sourceById = new Map();
  sources.forEach((s, i) => {
    const where = `${relative(process.cwd(), registryPath)} row ${i + 2}`;
    if (!/^src-[a-z0-9-]+$/.test(s.id)) err(where, `invalid source id "${s.id}"`);
    if (sourceById.has(s.id)) err(where, `duplicate source id "${s.id}"`);
    sourceById.set(s.id, s);
    for (const col of REQUIRED_SOURCE_COLUMNS) if (!s[col]) err(where, `missing ${col}`);
    if (s.url_status && !URL_STATUS.has(s.url_status)) err(where, `url_status "${s.url_status}" must be one of ${[...URL_STATUS].join(', ')}`);
    if (s.reuse && !REUSE.has(s.reuse)) err(where, `reuse "${s.reuse}" must be one of ${[...REUSE].join(', ')}`);
    if (s.checked_on && !/^\d{4}-\d{2}-\d{2}$/.test(s.checked_on)) err(where, 'checked_on must be YYYY-MM-DD');
  });

  // --- factors ---
  const factors = [];
  const files = walk(factorsDir, '.yaml');
  for (const file of files) {
    const rel = relative(factorsDir, file).split(sep).join('/');
    let f;
    try {
      f = yaml.load(readFileSync(file, 'utf8'));
    } catch (e) {
      err(rel, `YAML parse error: ${e.message.split('\n')[0]}`);
      continue;
    }
    if (!checkSchema(f)) {
      for (const e of checkSchema.errors) err(rel, `schema ${e.instancePath || '/'} ${e.message}`);
      continue;
    }
    if (!categories.has(f.category)) err(rel, `unknown category "${f.category}" (see schema/categories.yaml)`);
    if (!rel.startsWith(`${f.category}/`)) err(rel, `file must live under ${f.category}/`);
    const idPrefix = `hk.${f.category.replaceAll('/', '.')}.`;
    if (!f.id.startsWith(idPrefix)) err(rel, `id must start with "${idPrefix}"`);

    const [em, act, ...rest] = f.unit.split('/');
    if (rest.length || !emissionUnits.has(em) || !activityUnits.has(act)) {
      err(rel, `unit "${f.unit}" not allowed (see schema/units.yaml)`);
    } else if (!em.endsWith(f.gas)) {
      err(rel, `unit "${f.unit}" does not match gas ${f.gas}`);
    }

    const src = sourceById.get(f.source.id);
    if (!src) err(rel, `source "${f.source.id}" not in sources/registry.csv`);
    else if (f.status === 'reviewed' && src.url_status !== 'found') {
      err(rel, `reviewed factor needs a confirmed source link (source "${src.id}" url_status is "${src.url_status}")`);
    } else if (src.reuse === 'noncommercial-or-permission') {
      warn(rel, `source "${src.id}" may restrict commercial reuse; get written permission or use an open copy before release (data is CC BY 4.0)`);
    }
    if (!f.source.page && !f.source.table) err(rel, 'source needs a page or table so the value can be checked');

    if (f.status !== 'deprecated' && f.region !== 'GLOBAL' && f.year < currentYear - STALE_AFTER_YEARS) {
      warn(rel, `factor year ${f.year} is more than ${STALE_AFTER_YEARS} years old; add a newer one or deprecate`);
    }
    factors.push({ ...f, _file: rel });
  }

  // --- cross-record checks ---
  const byId = new Map();
  for (const f of factors) {
    if (byId.has(f.id)) err(f._file, `duplicate id "${f.id}" (also in ${byId.get(f.id)._file})`);
    else byId.set(f.id, f);
  }
  for (const f of factors) {
    if (f.superseded_by && !byId.has(f.superseded_by)) err(f._file, `superseded_by "${f.superseded_by}" does not exist`);
  }

  return { errors, warnings, factors, sources };
}
