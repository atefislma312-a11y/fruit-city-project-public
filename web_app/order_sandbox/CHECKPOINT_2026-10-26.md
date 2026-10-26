# Web order bridge checkpoint — 2026-10-26

Resumed from 111fcad. Found existing uncommitted bridge/client/POS adapter/fixture work and preserved it. Reviewed this integration slice; fixed workflow lastAction.reason to null so first command and durable replay have identical shapes. Updated customer storefront title, navigation, footer, image descriptions and WhatsApp draft to Fruit City.

Verified: 35 sandbox tests passed after the replay fix (first run: 34 passed, 1 failed); 3 storefront tests passed; Vite production build passed. Five bridge tests also passed using an empty test database initialized from development/pos_inventory_repair/database/schema/001_initial_schema.sql. Synthetic data only; no production DB connection. This is not runtime cashier integration or proof of all production constraints.

Bridge behavior tested: authenticated HTTP pull, receive/accept/prepare/payment/complete, one stock deduction after lost ACK and reopen, rollback for insufficient stock/incomplete recipe/SQL failure, prepared cancellation with waste review and refund without stock restoration, closed shift preserving pending accounting work. pos-bridge.mjs requires an injected POS transaction writer; it does not open production files. No live adapter/worker installed. Fees for InstaPay require an approved callback; no invented fees.

Changed slice: app_code/index.html, src/main.jsx, src/order.js; order_sandbox/{bridge.mjs,bridge.test.mjs,pos-bridge.mjs,pos-fixture.mjs,dev.mjs,http.mjs,intake.mjs,service.mjs,workflow.mjs}; this checkpoint. Governance entry recorded locally; unrelated existing governance/master-summary/AGENTS/assets changes preserved separately.

Remaining: runtime writer integration with durable persistence guarantees, staff UI controls and authentication lifecycle, end-to-end browser validation, multi-item/shared-ingredient and concurrent receiver tests, RF and weight mapping, delivery address/fees, privacy/rate limits/load review. Do not deploy this development API or expose the production database. Public site unchanged.
