#!/usr/bin/env node
// Read source documents from a session that has no direct internet access.
//
// Triggers the fetch-sources GitHub Actions workflow, waits for it, reads the
// text it printed into its log, saves one file per source under
// .cache/sources/ (git-ignored), then deletes the run's log so the text is not
// left on GitHub.
//
// Usage:
//   node scripts/fetch-source.mjs src-eeb-cap2050 src-clp-co2-intensity
//   node scripts/fetch-source.mjs src-hke-sr-2025 --pages 40-60
//   node scripts/fetch-source.mjs src-towngas-esg-2024 --archive
//   node scripts/fetch-source.mjs src-x --keep-log     (do not delete the log)
//
// Needs the GitHub CLI (gh) logged in with access to the repository.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = process.env.HKOC_REPO ?? 'liuxiangchen428-hash/hk-open-carbon';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.cache', 'sources');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : '');
const pages = opt('--pages');
const ids = args.filter((a, i) => a.startsWith('src-') && args[i - 1] !== '--pages');
if (!ids.length) {
  console.error('Usage: node scripts/fetch-source.mjs <src-id> [...] [--pages 10-25] [--archive] [--keep-log]');
  process.exit(2);
}

const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const token = `t${Date.now().toString(36)}`;

gh('api', '-X', 'POST', `repos/${REPO}/actions/workflows/fetch-sources.yml/dispatches`,
  '-f', 'ref=main', '-f', `inputs[ids]=${ids.join(',')}`, '-f', `inputs[pages]=${pages}`,
  '-f', `inputs[use_archive]=${flag('--archive')}`, '-f', `inputs[token]=${token}`);
console.error(`dispatched fetch-sources (${token}) for ${ids.join(', ')}`);

// Find the run by the token in its run-name, then wait for it to finish.
let run;
for (let i = 0; i < 60 && !run; i++) {
  await sleep(5_000);
  const runs = JSON.parse(gh('api', `repos/${REPO}/actions/workflows/fetch-sources.yml/runs?per_page=10`)).workflow_runs;
  run = runs.find((r) => r.display_title?.includes(`[${token}]`));
}
if (!run) { console.error('Could not find the workflow run.'); process.exit(1); }
while (run.status !== 'completed') {
  await sleep(10_000);
  run = JSON.parse(gh('api', `repos/${REPO}/actions/runs/${run.id}`));
}
console.error(`run ${run.id} finished: ${run.conclusion}`);

const jobs = JSON.parse(gh('api', `repos/${REPO}/actions/runs/${run.id}/jobs`)).jobs;
const raw = gh('api', `repos/${REPO}/actions/jobs/${jobs[0].id}/logs`);
// Each log line starts with an ISO timestamp and a space.
const lines = raw.split('\n').map((l) => l.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/, ''));

mkdirSync(outDir, { recursive: true });
let current = null;
let buf = [];
const results = [];
for (const line of lines) {
  const begin = line.match(/^===HKOC-BEGIN (\S+)=== (\{.*\})$/);
  if (begin) { current = { id: begin[1], meta: JSON.parse(begin[2]) }; buf = []; continue; }
  if (current && line === `===HKOC-END ${current.id}===`) {
    const file = join(outDir, `${current.id}${pages ? `.p${pages}` : ''}.txt`);
    if (current.meta.ok) writeFileSync(file, `# ${JSON.stringify(current.meta)}\n${buf.join('\n')}\n`);
    results.push({ ...current.meta, file: current.meta.ok ? file : null });
    current = null;
    continue;
  }
  if (current) buf.push(line);
}

if (!flag('--keep-log') && run.conclusion === 'success') {
  try {
    gh('api', '-X', 'DELETE', `repos/${REPO}/actions/runs/${run.id}/logs`);
    console.error('deleted the run log on GitHub');
  } catch (e) {
    console.error(`could not delete the run log: ${e.message.split('\n')[0]}`);
  }
}

for (const r of results) {
  console.log(r.ok
    ? `ok     ${r.id}  ${r.kind}${r.pdf_pages ? `, ${r.pdf_pages} pages` : ''}, ${r.chars} chars -> ${r.file}`
    : `failed ${r.id}  ${r.error}${r.http_status ? ` (HTTP ${r.http_status})` : ''}`);
}
process.exit(results.some((r) => r.ok) ? 0 : 1);
