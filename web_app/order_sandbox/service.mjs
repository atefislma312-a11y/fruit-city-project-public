// Isolated contract proof. Not an HTTP server, production adapter or payment processor.
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';

export class OrderSandbox {
  constructor(database, catalog) {
    this.db = new DatabaseSync(database);
    this.catalogSource = catalog;
    this.db.exec(`PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS incoming_orders (
      id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE,
      fingerprint TEXT NOT NULL, snapshot TEXT NOT NULL
    )`);
  }
  get catalog() { return typeof this.catalogSource === 'function' ? this.catalogSource() : this.catalogSource; }
  submit(input) {
    if (!input || typeof input.key !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(input.key)) throw Error('INVALID_KEY');
    if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 100) throw Error('INVALID_ITEMS');
    // This test intentionally has no personal data, delivery, payments or POS side effects.
    // Fingerprint preserves the full submitted intent: reusing a key with changed data fails.
    const fingerprint = createHash('sha256').update(JSON.stringify(input.items)).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.db.prepare('SELECT fingerprint,snapshot FROM incoming_orders WHERE request_key=?').get(input.key);
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw Error('IDEMPOTENCY_CONFLICT');
        this.db.exec('COMMIT');
        return { ...JSON.parse(existing.snapshot), replayed: true };
      }
      const lines = this.price(input.items);
      const totalMinor = lines.reduce((sum, line) => sum + line.totalMinor, 0);
      if (!Number.isSafeInteger(totalMinor)) throw Error('INVALID_TOTAL');
      const order = { id: randomUUID(), status: 'pending_store_acceptance', paymentStatus: 'unpaid',
        currency: 'EGP', totalMinor, lines, createdAt: new Date().toISOString() };
      this.db.prepare('INSERT INTO incoming_orders VALUES (?,?,?,?)').run(order.id,input.key,fingerprint,JSON.stringify(order));
      this.db.exec('COMMIT');
      return { ...order, replayed: false };
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }
  price(items) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 100) throw Error('INVALID_ITEMS');
    const catalog=this.catalog;
    const lines = items.map(item => {
        if (!item || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw Error('INVALID_QUANTITY');
        const matches = catalog.filter(v => v.sku === item.sku && v.size === item.size);
        if (matches.length > 1) throw Error('AMBIGUOUS_VARIANT');
        const variant = matches[0];
        if (!variant) throw Error('UNKNOWN_VARIANT');
        if (variant.available !== true) throw Error('UNAVAILABLE');
        if (!Number.isSafeInteger(variant.priceMinor) || variant.priceMinor <= 0) throw Error('PRICE_UNCONFIRMED');
        if (!variant.posProductId || !variant.posSizeId) throw Error('MAPPING_UNCONFIRMED');
        const totalMinor = variant.priceMinor * item.quantity;
        if (!Number.isSafeInteger(totalMinor)) throw Error('INVALID_TOTAL');
        return { sku: variant.sku, size: variant.size, posProductId: variant.posProductId,
          posSizeId: variant.posSizeId, quantity: item.quantity, unitPriceMinor: variant.priceMinor, totalMinor };
      });
    if (!Number.isSafeInteger(lines.reduce((n,l)=>n+l.totalMinor,0))) throw Error('INVALID_TOTAL');
    return lines;
  }
  count() { return this.db.prepare('SELECT COUNT(*) n FROM incoming_orders').get().n; }
  close() { this.db.close(); }
}
