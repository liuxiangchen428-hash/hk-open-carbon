#!/usr/bin/env node
// Record Internet Archive (Wayback Machine) snapshots for every source in
// sources/registry.csv, and optionally ask the archive to save new ones.
//
// Usage:
//   node scripts/archive-sources.mjs            look up existing snapshots only
//   node scripts/archive-sources.mjs --save     also request a snapshot when none exists
//   node scripts/archive-sources.mjs --save --refresh-days 365
//                                               re-save snapshots older than N days
//   node scripts/archive-sources.mjs --only src-eeb-cap2050
//
// Needs network access to archive.org and web.archive.org (runs in GitHub
// Actions; see .github/workflows/archive-sources.yml).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCsv } from './lib/validate.mjs';
import { toCsv, waybackTimestampToDate } from './lib/csv.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = join(root, 'sources', 'registry.csv');

const args = process.argv.slice(2);
const SAVE = args.includes('--save');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const refreshDays = args.includes('--refresh-days') ? Number(args[args.indexOf('--refresh-days') + 1]) : null;

const UA = 'hk-open-carbon source archiver (+https://github.com/liuxiangchen428-hash/hk-open-carbon)';
const SAVE_DELAY_MS = 20_000; // Save Page Now rate-limits anonymous requests
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, opts = {}, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...opts, headers: { 'User-Agent': UA, ...(opts.headers ?? {}) } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(5_000 * i);
    }
  }
}

async function lookup(url) {
  const res = await fetchWithRetry(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`);
  const json = await res.json();
  const c = json?.archived_snapshots?.closest;
  if (!c?.available || c.status !== '200') return null;
  return { url: c.url.replace(/^http:\/\//, 'https://'), date: waybackTimestampToDate(c.timestamp) };
}

async function save(url) {
  const res = await fetchWithRetry(`https://web.archive.org/save/${url}`, { redirect: 'manual' }, 2);
  // A successful save redirects to /web/<timestamp>/<url> or returns it in Content-Location.
  const loc = res.headers.get('location') ?? res.headers.get('content-location');
  const m = loc && loc.match(/\/web\/(\d{14})\//);
  if (!m) return null;
  return { url: `https://web.archive.org/web/${m[1]}/${url}`, date: waybackTimestampToDate(m[1]) };
}

const text = readFileSync(registryPath, 'utf8');
const header = text.split('\n')[0].split(',');
for (const col of ['archive_url', 'archived_on']) if (!header.includes(col)) header.push(col);
const rows = parseCsv(text);

const today = new Date().toISOString().slice(0, 10);
const tooOld = (d) => refreshDays !== null && (!d || (Date.now() - Date.parse(d)) / 864e5 > refreshDays);
let found = 0, saved = 0, missing = 0, failed = 0;

for (const r of rows) {
  if (only && !only.split(',').includes(r.id)) continue;
  if (!/^https?:\/\//.test(r.url)) continue;
  try {
    let snap = await lookup(r.url);
    if (SAVE && (!snap || tooOld(snap.date))) {
      let fresh = await save(r.url).catch(() => null);
      await sleep(SAVE_DELAY_MS);
      // Save Page Now does not always return the new location; look it up again.
      if (!fresh) {
        const again = await lookup(r.url);
        if (again && again.date === today) fresh = again;
      }
      if (fresh) { snap = fresh; saved++; }
      else if (snap) found++;
    } else if (snap) found++;
    if (snap) {
      r.archive_url = snap.url;
      r.archived_on = snap.date;
      console.log(`ok       ${r.id}  ${snap.date}`);
    } else {
      missing++;
      console.log(`missing  ${r.id}`);
    }
  } catch (e) {
    failed++;
    console.log(`error    ${r.id}  ${e.message}`);
  }
}

writeFileSync(registryPath, toCsv(header, rows));
console.log(`\n${found} existing, ${saved} newly saved, ${missing} without snapshot, ${failed} errors (run on ${today})`);
process.exit(failed && failed === rows.length ? 1 : 0);
