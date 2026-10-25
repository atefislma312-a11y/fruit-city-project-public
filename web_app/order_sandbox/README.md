# Isolated incoming-order contract proof

## 2026-10-25 — isolated intake implemented, NOT connected or deployed

Run `node --test web_app/order_sandbox/*.test.mjs` from the repository root: **19 passed, 0 failed**.
The original seven tests still pass. Storefront tests: **3 passed**, production build successful.
The separately owned POS development `orderRules.test.js` was reviewed and run: **4 passed**; this does not prove its HTTP server or inventory transactions are ready.

New files:
- `catalog.mjs` reconciles exact product codes and exact size code/volume pairs. `pos-identifiers.json` is a read-only identifier snapshot from 2026-10-24, not prices or live availability. 108/124 products match; all 16 RF products remain blocked. Refresh identifiers before operational adoption; never match by name.
- `approvedVariants` consumes one branch-specific feed with approval actor/reference and expiration. Unknown, duplicate, unavailable, unapproved and expired prices fail closed. Prices use integer piastres. A catalog provider function can refresh the feed on every quote/confirmation. There is no approved real feed yet and no automatic POS price export.
- `intake.mjs` extends the original service with durable quotes, explicit total confirmation, canonical order IDs, atomic order/event/outbox persistence, and bearer-protected order lookup. Changes to price/mapping/availability require a new quote. Confirmed orders remain pending/unpaid/unsettled. Legacy `submit` remains a test-only API; the HTTP adapter never exposes it.
- `http.mjs` provides JSON POST `/quotes`, POST `/orders`, GET `/orders/:id` with quote/order bearer token, and GET `/staff/orders` with a configured staff bearer token. No cookies, CORS access or secret defaults. Tests bind ephemeral loopback ports and close them. No permanent server is launched.
- `deliver` retains outbox events until the receiver returns the matching event/order IDs. Delivery is at-least-once: the future POS receiver MUST deduplicate by event ID and durably acknowledge after writing its own inbox. No receiver adapter is implemented yet.

Tests cover 40 simultaneous HTTP retries producing one order, durable reopen, expired/changed quotes, unavailable products, invalid tokens, unauthorized staff access, atomic rollback after an injected database failure, and notification failure/wrong acknowledgements. This is a small concurrency smoke test, NOT production load qualification. Restart test reopens a SQLite connection, not an OS crash/power-loss test.

Only synthetic pickup orders are supported in this slice. Delivery fails with `DELIVERY_NOT_CONFIGURED`; no invented location or fees. Cash and manual InstaPay are recorded as method preferences, never proof of payment. No customer personal data is collected by this test contract.

Remaining gates: approved branch/prices/availability, RF identities and weight rules; customer contact/fulfillment validation; admin identity/session lifecycle and rate limits; authenticated UI/API integration; cashier acceptance/state audit; receiver deduplication; approved preparation/inventory event; payment verification/settlement; delivery coordinates/fees; production storage/backup/load/security review. Do not expose this test HTTP adapter or deploy it as a production service.

The canonical customer React app and public site are unchanged. Do not point this service at any production DB. Existing `OrderSandbox` accepts arbitrary database paths for tests; the eventual operational launcher must enforce a dedicated database location.

Implementation reuses Node's built-in SQLite and the existing sandbox rather than adding a second POS or an inventory engine. Reference: https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html

## Earlier proof (2026-10-24)

Run with the existing Node 24 runtime from the project root:

```
node --test web_app/order_sandbox/service.test.mjs
```

No packages to install. Uses built-in node:sqlite. Tests create in-memory databases and one temporary test database, close it and remove only that test file/directory. Synthetic TEST-* identifiers and prices only. No imports of the cashier, production database access, network, worker, notification or inventory code.

This is a service-level contract demonstration, not a deployable API or replacement POS. `OrderSandbox` must only receive an isolated test database. Do not point it at production. Tests prove durable retry, intent conflict rejection, server-derived test prices, snapshots, exact variant mapping and all-or-nothing validation. Pending acceptance is separate from paid/preparing.

Current result 2026-10-24: 7 tests passed, 0 failed. Simulated lost response is retrying after ignoring the first response and reopening the test DB; no real network failure, concurrent-process load, POS integration or WhatsApp delivery was tested.

Before production: approved catalog mapping/prices and branch; HTTP request schema and quote confirmation; customer/delivery validation; geofence; authentication and authorization; status transitions and audit; durable notification/bridge outbox; concurrency/load tests; operations and monitoring. An approved domain/API contract must replace this test-only shape. Do not connect the customer UI to it yet.

## 2026-10-25 — workflow development checkpoint (not operational)

Owner approved primary branch `branch_downtown_cairo` in City Management System, the Maps point recorded in `operating-config.json`, and ingredient deduction at preparation. The branch identity approval does not itself import prices or establish live availability. Delivery examples are not an approved tariff.

Added `workflow.mjs` and five tests: authenticated actor roles, audited state transitions, optimistic revisions, durable idempotent commands, preparation outbox awaiting bridge ACK, separate payment/settlement/refund states, manager-verified manual InstaPay, and waste review on prepared cancellation. No inventory mutation or POS receiver exists in this slice. ACK tests use synthetic receipts; they do not prove real stock deduction.

Added standalone 5km validation and a synthetic test; it is not yet connected to checkout. Unconfirmed fees and zone mapping block delivery. Customer checkout and staff inbox are opt-in development scaffolds in the existing React app; `dev.mjs` requires FC_DEMO=1, uses in-memory synthetic prices, loopback only. No production launcher or real staff credentials. Development UI browser acceptance remains unverified; pending confirmation is not yet retained across page reload. Staff preparation/payment controls remain unfinished. The default public flow is unchanged.

Verified now: 25 sandbox tests, 3 existing storefront tests, production build. No live POS integration, production load qualification, phone/browser acceptance or deployment was performed. Remaining: approved-source feed adapter, RF mappings, customer contact data validation, persistent client retry intent, production authentication, POS inbox/receiver and inventory transaction integration, delivery tariff, full integration/security/load tests.

### Resume verification, 2026-10-25
- Added pos-feed.mjs / pos-feed.test.mjs: read-only branch-specific transactional price reader, strict integer-piastre conversion, exact mappings, refreshed availability. Synthetic fixture tests verify source bytes unchanged and cross-branch exclusion.
- Read-only check against the current local POS returned 322 eligible variants across 108 products for branch_downtown_cairo. SHA-256 before/after matched. No price values exported. This proves reading current configured availability, not ingredient availability or end-to-end POS readiness. 16 RF products remain blocked.
- Sandbox tests now 27 passed. Vite build passed. Browser demo: mango quote 12.50 TEST EGP, confirmation pending acceptance, reload and repeat confirmation returned the same order ID. Screenshot checkout-test.png. Pending intent now retained in sessionStorage for matching cart/payment method; switching payment method back may be needed after reload. Full authentication/payment/staff/browser coverage remains pending.
- Reader is not enabled in the demo launcher or public site. Remaining integration gates above still apply. The preceding checkpoint's 'browser unverified' and 'no feed adapter' reflect the earlier state and are superseded only by these specific results.
