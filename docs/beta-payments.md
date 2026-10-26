# Monthly beta payments

PlotCloud beta costs CAD 16.99 per calendar month, plus applicable taxes disclosed before payment. It covers repeated use, not one run. There is no annual plan, automatic renewal, card checkout, or free Pro trial. Sun hours and Daylight are free. Basic Workspace preparation and access to locally saved projects/results remain available so the free workflow works. Other current Simulation studies and resource tools require activation. External provider charges and third-party licenses are separate.

The Pricing message is “Better-informed design. A stronger design report.” Simulation evidence can support users' own reports; this does not promise automatic report generation, guaranteed grades, certification, or compliance.

## Order and payment

1. A customer requests order details by email at plotcloud@gmail.com. The website opens a draft; it does not send email or verify bank payments.
2. Before accepting payment, provide the required seller identity/contact details (including a business address where required), final price and taxes, scope, exact access dates, delivery timing and refund terms in writing. Public Gmail contact does not replace a legally required address. Do not accept a paid order until the required disclosures can be supplied.
3. The customer sends the agreed e-transfer using their own bank. Verify receipt in the bank, not a screenshot, email claim, or website button. Never request passwords, security answers or banking codes.
4. Issue a code only after receipt is verified, with a confirmed start time:

```sh
node tools/issue-beta-access.mjs --confirm-payment --reference ORDER_OPAQUE_ID --start 2026-11-01T17:00:00Z
```

The CLI returns the private code once and adds only its SHA-256 hash, opaque reference and fixed dates to mvp/beta-access-ledger.json. Use an opaque reference, never a name, email or bank identifier. Never commit, screenshot publicly or log the raw code. An end-of-month start is clamped to the last day of the next month. Dates use UTC in the ledger and display in the user's local timezone.

5. Publish the ledger and verify deployment before privately delivering the code and dates. Do not lose access time during deployment: choose the start agreed with the buyer. The CLI refuses duplicate references. No customer code has been issued in this release; the public ledger is empty.
6. For renewal, issue a new verified order and code with confirmed dates. For revocation, add revokedAt (ISO timestamp) to the matching ledger entry and deploy. Reloading/rechecking access fetches the ledger; successful checks cache for up to 15 seconds. Removing a code from the browser does not refund a payment or delete projects.

## Implementation limits

The current deployment is static GitHub Pages. The ledger and routes enforce ordinary browser workflows, including direct embedded engine entry, paid batch runs and paid modes in the free Sun engine. Local account/plan labels do not grant access. An unavailable ledger fails closed for paid tools; free tools remain available. There is no automated bank reconciliation or code email delivery.

This is client-side access control, not a secure server-side paywall. Users who alter client code or copy public engine source can bypass it. Strong protection requires authenticated server-side entitlements and private paid computation/content. The public ledger intentionally contains no raw codes or customer personal information. Do not claim otherwise in product copy.

## Validation

Run NODE_PATH=/workspace/plotcloud-tools/node_modules node tests/beta-access.cjs with TEST_BASE pointing to the local static server. The browser intercepts the ledger with a private test fixture; production stays empty. Checks cover month boundaries, invalid/expired/revoked/future grants, monthly copy, ordinary unpaid/paid entry, the two free studies, mobile overflow and policy loading.

Pricing research context: BC's minimum wage is CAD 18.25 from June 1, 2026 (https://news.gov.bc.ca/releases/2026LBR0021-000581). Great Dane's listed latte is CAD 5.50 (https://greatdanecoffee.com/). These are affordability references, not evidence of willingness to pay. CAD 16.99/month is a beta pricing decision, not a validated market-optimal price. Review conversion and retention before changing it. Transfer guidance: https://www.interac.ca/en/how-to-use/interac-e-transfer/how-to-send-money-with-interac-e-transfer/ . Seller-disclosure reference: https://www.consumerprotectionbc.ca/selling-online-contract-rules-for-businesses/ .
