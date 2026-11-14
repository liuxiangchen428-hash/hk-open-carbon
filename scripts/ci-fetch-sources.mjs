#!/usr/bin/env node
// Runs inside the fetch-sources GitHub Actions workflow.
// For each requested source id: download the document, convert PDFs to text
// with pdftotext (or strip tags from HTML), and print it between markers:
//
//   ===HKOC-BEGIN <id>=== {json metadata}
//   ...text...
//   ===HKOC-END <id>===
//
// Env: IDS (comma-separated), PAGES (e.g. "10-25"), USE_ARCHIVE ("true"/"false").

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCsv } from './lib/validate.mjs';

const UA = 'Mozilla/5.0 (compatible; hk-open-carbon source fetcher; +https://github.com/liuxiangchen428-hash/hk-open-carbon)';
const MAX_BYTES = 200 * 1024 * 1024;

const ids = (process.env.IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const pages = (process.env.PAGES ?? '').trim();
const useArchive = process.env.USE_ARCHIVE === 'true';
if (!ids.length) { console.error('No ids given'); process.exit(1); }
if (pages && !/^\d+(-\d+)?$/.test(pages)) { console.error(`Bad page range "${pages}"`); process.exit(1); }

// Document text could contain lines GitHub reads as workflow commands ("::..."); turn them off.
const stopToken = createHash('sha256').update(String(Date.now()) + Math.random()).digest('hex').slice(0, 16);
console.log(`::stop-commands::${stopToken}`);

const registry = new Map(parseCsv(readFileSync('sources/registry.csv', 'utf8')).map((r) => [r.id, r]));
const work = mkdtempSync(join(tmpdir(), 'hkoc-'));

function htmlToText(html, base) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Keep link targets so documents linked from a listing page can be found.
    .replace(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
      let abs = href;
      try { abs = new URL(href, base).href; } catch {}
      return `${text} [${abs}]`;
    })
    .replace(/<(br|\/p|\/div|\/tr|\/h\d|\/li)[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}

let failures = 0;
for (const id of ids) {
  const src = registry.get(id);
  const meta = { id, ok: false };
  try {
    if (!src) throw new Error('id not in sources/registry.csv');
    // Wayback "id_" form returns the original bytes without the archive banner.
    const archiveRaw = src.archive_url ? src.archive_url.replace(/\/web\/(\d{14})\//, '/web/$1id_/') : '';
    // Try the original link first; if the site refuses (common for bot-blocking
    // sites), fall back to the Internet Archive copy.
    const archivePlain = src.archive_url || '';
    const candidates = useArchive ? [archiveRaw, archivePlain] : [src.url, archiveRaw, archivePlain];
    const tries = candidates.filter(Boolean);
    if (!tries.length) throw new Error(useArchive ? 'no archive_url recorded' : 'no url');
    let res;
    meta.attempts = [];
    for (const u of tries) {
      try {
        res = await fetch(u, { headers: { 'User-Agent': UA }, redirect: 'follow' });
        meta.attempts.push(`${u} -> HTTP ${res.status}`);
        if (res.ok) { meta.url = u; meta.from_archive = u !== src.url; break; }
      } catch (e) {
        meta.attempts.push(`${u} -> ${e.message}${e.cause ? ` (${e.cause.code ?? ''} ${e.cause.message ?? ''})` : ''}`);
        res = null;
      }
    }
    if (!res?.ok) throw new Error(`all downloads failed (${meta.attempts.join('; ')})`);
    meta.http_status = res.status;
    meta.final_url = res.url;
    meta.content_type = res.headers.get('content-type') ?? '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error(`file too large (${buf.length} bytes)`);
    meta.bytes = buf.length;
    meta.sha256 = createHash('sha256').update(buf).digest('hex');

    let text;
    const isPdf = buf.subarray(0, 5).toString('latin1') === '%PDF-';
    if (isPdf) {
      const file = join(work, `${id}.pdf`);
      writeFileSync(file, buf);
      const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
      meta.pdf_pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
      const args = ['-layout', '-enc', 'UTF-8'];
      if (pages) {
        const [first, last = first] = pages.split('-');
        args.push('-f', first, '-l', last);
        meta.pages = pages;
      }
      // Form feed separates pages; print a visible page marker instead.
      text = execFileSync('pdftotext', [...args, file, '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
      const start = pages ? Number(pages.split('-')[0]) : 1;
      text = text.split('\f').map((p, i) => `\n---- page ${start + i} ----\n${p}`).join('');
      meta.kind = 'pdf';
    } else {
      text = htmlToText(buf.toString('utf8'), meta.final_url);
      meta.kind = 'html';
    }
    meta.ok = true;
    meta.chars = text.length;
    console.log(`===HKOC-BEGIN ${id}=== ${JSON.stringify(meta)}`);
    console.log(text);
    console.log(`===HKOC-END ${id}===`);
  } catch (e) {
    failures++;
    meta.error = e.message;
    console.log(`===HKOC-BEGIN ${id}=== ${JSON.stringify(meta)}`);
    console.log(`===HKOC-END ${id}===`);
  }
}
console.log(`::${stopToken}::`);
console.log(`fetched ${ids.length - failures} of ${ids.length}`);
process.exit(failures === ids.length ? 1 : 0);
