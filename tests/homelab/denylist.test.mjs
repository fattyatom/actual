// Unit test for the service-worker navigateFallbackDenylist entry that makes the
// importer redirection work. Actual's Workbox SW serves the SPA shell for every
// navigation EXCEPT denylisted paths; our /importer entry lets a navigation to
// /importer reach the network (→ Traefik → importer) instead of the SPA. This
// pins that regex's behaviour, reading it straight out of this branch's
// vite.config.mts so the assertion can't drift from what ships.
//
// Run: node tests/homelab/denylist.test.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const vite = readFileSync(
  join(here, '..', '..', 'packages/desktop-client/vite.config.mts'),
  'utf8',
);

const EXPECTED = String.raw`/^\/importer([/?].*)?$/`;
const present = vite
  .split('\n')
  .map(l => l.trim().replace(/,$/, ''))
  .includes(EXPECTED);

if (!present) {
  console.error(`FAIL: expected denylist entry ${EXPECTED} not found in vite.config.mts`);
  process.exit(1);
}

const re = new RegExp(EXPECTED.slice(1, -1));

// Paths that MUST hand off to the server (importer reached over the network).
const MUST_MATCH = [
  '/importer',
  '/importer/',
  '/importer?budgetId=abc',
  '/importer/api/health',
  '/importer/assets/index.js',
];
// Paths that MUST stay inside the Actual SPA (served by the SW fallback).
const MUST_NOT_MATCH = ['/', '/budget', '/reports', '/import', '/importers', '/importer-x', '/settings/importer'];

let failed = 0;
for (const p of MUST_MATCH) {
  if (!re.test(p)) {
    console.error(`FAIL: '${p}' should be denylisted (handed to server) but did not match`);
    failed++;
  }
}
for (const p of MUST_NOT_MATCH) {
  if (re.test(p)) {
    console.error(`FAIL: '${p}' should NOT be denylisted (SPA fallback) but matched`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n==> FAILED: ${failed} denylist assertion(s)`);
  process.exit(1);
}
console.log(`==> OK: denylist regex ${EXPECTED} routes /importer (and only /importer) to the server`);
