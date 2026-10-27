# Private simulation testing

The owner requested testing access for themselves, not for all visitors. A high-entropy, seven-day bearer code unlocks the 17 currently listed simulation studies in the browser where it is activated. Only its SHA-256 digest, explicit study IDs, start/end times and revocation metadata are published in `mvp/simulation-test-ledger.json`. The actual issued code is kept outside the repository and supplied privately to the owner.

The Simulations catalogue and paid gate accept a **Simulation testing code**. A private catalogue link can activate it and removes the code from the address bar immediately. The code persists in that browser until expiry, revocation or End testing. It does not grant administrator access, a monthly paid membership, paid resource tools or access to other users' projects. It does not turn incomplete model inputs into valid analysis models.

To revoke, set the grant's `revokedAt` to an ISO timestamp or remove the entry, then deploy. Access refreshes through the existing 15-second verification flow and stops at the expiry. Other visitors retain the existing free Sun hours/Daylight and paid study gates. Hosted database initialization is separate.

`tests/simulation-test-access.cjs` checks activation, persistence, isolated visitors, study scope, paid-membership/resource separation, expiry/future dates and revocation. Existing membership SQL and UI tests cover the server-authorized administrator path.
