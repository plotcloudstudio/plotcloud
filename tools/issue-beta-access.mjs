// Owner-only local issuance. Publish the updated ledger before giving the code to the payer.
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export function addCalendarMonth(value) { const end = new Date(value), day = end.getUTCDate(); end.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1); const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate(); end.setUTCDate(Math.min(day, last)); return end; }
export function issueGrant({ start = new Date(), reference, code = 'PCBET-' + randomBytes(24).toString('hex').toUpperCase() }) {
  if (!reference || !/^[A-Za-z0-9_-]{3,80}$/.test(reference)) throw Error('Use a private opaque order reference, not a customer name or email.');
  const startsAt = new Date(start); if (!Number.isFinite(+startsAt)) throw Error('Invalid start date.');
  return { code, grant: { codeHash: createHash('sha256').update(code).digest('hex'), plan: 'beta-monthly', reference, startsAt: startsAt.toISOString(), expiresAt: addCalendarMonth(startsAt).toISOString() } };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), value = flag => args[args.indexOf(flag) + 1];
  if (!args.includes('--confirm-payment') || !args.includes('--reference')) throw Error('Verify the bank receipt first, then use --confirm-payment --reference ORDER_ID.');
  const file = args.includes('--ledger') ? value('--ledger') : new URL('../mvp/beta-access-ledger.json', import.meta.url), ledger = JSON.parse(await readFile(file, 'utf8'));
  if (ledger.schema !== 1 || !Array.isArray(ledger.grants)) throw Error('Invalid ledger.');
  const reference = value('--reference'); if (ledger.grants.some(g => g.reference === reference)) throw Error('Reference already issued. Do not issue duplicate access.');
  const result = issueGrant({ reference, start: args.includes('--start') ? value('--start') : new Date() }); ledger.grants.push(result.grant); await writeFile(file, JSON.stringify(ledger, null, 2) + '\n');
  console.log(JSON.stringify({ code: result.code, startsAt: result.grant.startsAt, expiresAt: result.grant.expiresAt, reference, next: 'Publish the ledger and verify deployment before sending this code privately. Never commit the code itself.' }, null, 2));
}
