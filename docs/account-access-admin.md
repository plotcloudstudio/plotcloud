# Registered accounts and access management

Owner's intended administrator email: plotcloud@gmail.com. The site remains on GitHub Pages; Supabase supplies Auth and the private membership database. The browser receives only a publishable/anon project key and the user's session, never the service-role key. The owner supplied project `cgxszynizkbiblfiaowf` on 2026-10-27; its public configuration is now in the website. Hosted database initialization, authentication delivery, owner assignment and cross-account isolation still require verification. The execution environment's outbound allowlist blocks this Supabase host, so no hosted verification is claimed. The Admin route includes read-only live endpoint checks that run from the visitor's browser. Local profiles cannot be searched remotely.

## Connect once

1. Create a project at https://supabase.com/dashboard under the owner's account. Select a suitable region and retain the database password privately.
2. In SQL Editor, run `supabase/migrations/20261025000000_cloud_projects.sql`, then `supabase/migrations/20261026000000_memberships.sql` and `supabase/migrations/20261027000000_membership_durations.sql`. The Admin setup panel offers the combined `supabase/setup-plotcloud.sql` and Copy buttons.
3. Configure the production Site URL and redirect URL as `https://plotcloudstudio.github.io/plotcloud/mvp/`. Enable email confirmation. Configure production SMTP for registration/confirmation emails; the default Supabase mail sender has limits. Do not promise instant delivery.
4. Put the Project URL and public/anon key into `mvp/js/backend-config.js` and deploy. Do not use a service-role key or database password. `supabase/README.md` also documents a local-only configuration for testing.
5. Register plotcloud@gmail.com through the website and confirm the email. This is separate from signing up to the Supabase dashboard. Then, as the project owner in SQL Editor, run `supabase/appoint-admin.sql` to deliberately appoint the confirmed account. It refuses missing or unconfirmed accounts. The equivalent assignment is:

```sql
insert into private.pc_admins(user_id)
select id from auth.users
where lower(email)='plotcloud@gmail.com' and email_confirmed_at is not null
on conflict do nothing;
```

Verify that one administrator row was inserted (or already exists). There is no public claim-admin endpoint, email allowlist or user-metadata shortcut. The database owner controls administrator assignment/removal.
6. Log in at `mvp/#/admin`. Check a real ordinary test account is denied this page before accepting paid orders. Perform a hosted registration, grant, renewal, revoke and expiry verification after connection; local test results do not substitute for that hosted check.

## Daily use

A customer registers and confirms their email. They request complete written order details with that email, then send the agreed e-transfer. Verify the deposit in Wealthsimple. Search the registered name or email in Admin, check the exact email shown, choose Grant access, select 1 Month / 1 Year / Permanent, enter the unique payment or authorization reference, check the verification box and confirm. For active time-limited accounts, Extend access adds a month/year to the current expiry or upgrades to permanent access. Permanent accounts show No expiry and cannot be extended; revoke them before assigning a time-limited plan. Revoke requires a support/refund reference and preserves projects. History shows the last 50 access changes. Search is paginated in groups of 25.

Calendar months and years use UTC server time, clamping month ends and February 29 as needed. Permanent access has a null expiry and an explicit permanent type, remains revocable, and still requires fresh server authorization. Membership is checked against the database clock; no scheduled deletion or monthly maintenance job is needed. Browser membership checks refresh while visible every 15 seconds; a server-verified client lease is at most 30 seconds and an expired lease denies access. A failed verification denies paid tools. Sun hours and Daylight stay free. Existing code entitlements remain a temporary option only while cloud registration is unconfigured; configured accounts are authoritative for paid memberships. The separately issued private, seven-day simulation testing code unlocks only its specified studies; it is not a membership or administrator role.

Duplicate request IDs are idempotent; a payment/authorization reference cannot grant access twice. Customer names/emails, payment references and audit events stay in private database tables. Authenticated customers can query only their own status. Admin search/grant/history require database administrator membership, not a local plan flag or editable profile. The account profile uses the confirmed registration email; editing a local display email cannot change identity.

## Limits and deferred automation

This implements manual verification and account grants, replacing the proposed email-triggered code delivery. No Gmail automation, bank API or email-based payment verification is enabled. Do not infer a completed payment from an e-transfer invitation. Wealthsimple's official setup separates Autodeposit registration from business email notifications: https://help.wealthsimple.com/hc/en-ca/articles/51594844256155-Set-up-a-business-email-for-account-notifications-and-Interac-e-Transfer-transactions . Receipt instructions: https://help.wealthsimple.com/hc/en-ca/articles/13080474718491-Receive-Interac-e-Transfer-transactions-in-your-chequing-account . Register plotcloud@gmail.com only after checking it should route to that account; an Autodeposit email can belong to one institution at a time.

The membership database and admin operations have server-side authorization. Simulation computation is still public client-side JavaScript. These access checks do not make public source/computation tamper-proof; moving private paid computations to an authenticated service is a separate change. Seller/order disclosure requirements in the paid-service policies still apply before accepting transfers.

## Validation

`tests/membership-permissions.cjs` uses PostgreSQL via PGlite to execute the migration and check actor authorization, private tables, confirmed-email requirements, grants, renewals, idempotency, audit privacy, expiry, revocation and calendar month arithmetic. `tests/admin-ui.cjs` drives the browser against that SQL-backed test adapter. Neither test creates hosted accounts, sends real email or grants real customers access. Use NODE_PATH to the test tool dependencies and TEST_BASE to a local static server.
