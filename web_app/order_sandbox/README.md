# Isolated incoming-order contract proof

Run with the existing Node 24 runtime from the project root:

```
node --test web_app/order_sandbox/service.test.mjs
```

No packages to install. Uses built-in node:sqlite. Tests create in-memory databases and one temporary test database, close it and remove only that test file/directory. Synthetic TEST-* identifiers and prices only. No imports of the cashier, production database access, network, worker, notification or inventory code.

This is a service-level contract demonstration, not a deployable API or replacement POS. `OrderSandbox` must only receive an isolated test database. Do not point it at production. Tests prove durable retry, intent conflict rejection, server-derived test prices, snapshots, exact variant mapping and all-or-nothing validation. Pending acceptance is separate from paid/preparing.

Current result 2026-10-24: 7 tests passed, 0 failed. Simulated lost response is retrying after ignoring the first response and reopening the test DB; no real network failure, concurrent-process load, POS integration or WhatsApp delivery was tested.

Before production: approved catalog mapping/prices and branch; HTTP request schema and quote confirmation; customer/delivery validation; geofence; authentication and authorization; status transitions and audit; durable notification/bridge outbox; concurrency/load tests; operations and monitoring. An approved domain/API contract must replace this test-only shape. Do not connect the customer UI to it yet.
