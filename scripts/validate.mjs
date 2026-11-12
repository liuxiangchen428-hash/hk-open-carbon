#!/usr/bin/env node
// Usage: npm run validate
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateRepo } from './lib/validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { errors, warnings, factors, sources } = validateRepo({
  schemaDir: join(root, 'schema'),
  factorsDir: join(root, 'data', 'factors'),
  registryPath: join(root, 'sources', 'registry.csv'),
});

for (const w of warnings) console.warn(`warning  ${w}`);
for (const e of errors) console.error(`error    ${e}`);
console.log(`\n${factors.length} factors, ${sources.length} sources, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
