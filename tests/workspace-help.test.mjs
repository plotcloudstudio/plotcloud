// The Workspace help lists a method report for exactly the studies that have one in mvp/research/reports (2026-11-25).
import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { REPORT_IDS, reportLink, helpHTML, SHORTCUTS } from '../mvp/js/workspace-help.js';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../mvp/research/reports');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort();
assert.deepEqual([...REPORT_IDS].sort(), files, 'REPORT_IDS matches the report files');
assert.equal(reportLink('wind'), '#/blog/report-wind'); assert.equal(reportLink('nope'), null);
const h = helpHTML([['wind', 'Wind flow'], ['nope', 'No report']]); assert.match(h, /href="#\/blog\/report-wind"/); assert.doesNotMatch(h, /No report/);
assert(SHORTCUTS.flatMap(([, r]) => r).some(([k]) => k === 'T'), 'T is listed (bound to the text label)');
// the report ids the Blog publishes
const gen = fs.readFileSync(path.join(dir, '../simulation-reports.js'), 'utf8'); for (const id of REPORT_IDS) assert(gen.includes(`"id": "report-${id}"`), 'Blog has report-' + id);
console.log(`PASS workspace help: ${REPORT_IDS.length} method reports, each published on the Blog; shortcuts include T`);
