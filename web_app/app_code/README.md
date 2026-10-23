# Fruit City customer storefront — first local version

Arabic RTL React/Vite customer menu using the existing catalog directly from `../catalog/web_app_full_inventory.json`. It does not copy or connect to the cashier database.

## Run

From this directory: `npm ci --ignore-scripts`, then `npm run dev`.
Local preview: http://127.0.0.1:5174 (loopback only, strict port).
`npm run build` creates `dist/`. `npm test` runs the order/cart tests.

## Implemented

- 124 catalog entries across 10 categories; Arabic and English search, ingredient text, sizes supplied by the catalog.
- Persistent cart with quantities from 1–99; add, remove and update.
- Home delivery or in-shop ordering; delivery address required; optional notes.
- WhatsApp draft to **01025966033**, verified against `docs/store/STORE_PROFILE.md`. The customer reviews and sends it manually; this app cannot confirm delivery or store acceptance.
- All catalog prices are currently null. No invented totals, prices, discounts or delivery fees. The message asks the store to confirm price and availability before accepting the order.

## Verified 2026-10-23

- Production build passed; three Node tests passed; npm audit reported zero known vulnerabilities at installation.
- Browser: 124 entries rendered, fresh fruit filter 16 entries, mango search 1 fresh fruit result, two 500 ml mango bottles correctly added and retained after reload; in-shop mode hides address, delete yields empty cart.
- Mobile viewport 390×844: rendered content width/scroll width both 375 px (scrollbar consumes remaining width), no horizontal page overflow. Screenshot: `mobile-preview.png`.
- No WhatsApp message was sent and store receipt was not tested. No public deployment performed.

## Remaining

- Owner review of design, actual item photos and official logo treatment; current text monogram is provisional, missing product photos use illustrative icons.
- Existing JPGs remain unmodified and are larger than the target 60 KB; optimize derivative assets before public release.
- Prices, delivery coverage/fees and operating hours need owner-supplied rules; fractional fruit weights are not implemented (whole kilos only).
- Public hosting, PWA/offline operation, payments and POS integration are not implemented. Google Fonts is optional; local font fallbacks are present.

## Foundation

Selected the official MIT-licensed [Vite](https://github.com/vitejs/vite) foundation and [React starter guidance](https://vite.dev/guide/) after Exa research. No third-party shop template was downloaded or executed. Package versions are locked in `package-lock.json`.
