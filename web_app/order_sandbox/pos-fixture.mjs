// Synthetic integration fixture with the column names and constraints used by the POS.
// No business records or production database are copied into this fixture.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

export function posFixture(path=':memory:'){
 const db=new DatabaseSync(path);
 if(process.env.FC_TEST_SCHEMA)db.exec(readFileSync(process.env.FC_TEST_SCHEMA,'utf8'));
 else db.exec(`
 CREATE TABLE IF NOT EXISTS branches(branch_id TEXT PRIMARY KEY,status TEXT);
 CREATE TABLE IF NOT EXISTS products(product_id TEXT PRIMARY KEY,product_code TEXT,is_active INTEGER);
 CREATE TABLE IF NOT EXISTS product_sizes(size_id TEXT PRIMARY KEY,size_code TEXT,volume_ml INTEGER);
 CREATE TABLE IF NOT EXISTS recipes(recipe_id TEXT PRIMARY KEY,product_id TEXT,status TEXT,is_complete INTEGER,yield_unit TEXT,batch_yield_ml REAL);
 CREATE TABLE IF NOT EXISTS ingredients(ingredient_id TEXT PRIMARY KEY,base_unit TEXT,status TEXT);
 CREATE TABLE IF NOT EXISTS recipe_ingredients(recipe_id TEXT,ingredient_id TEXT,quantity REAL,unit TEXT);
 CREATE TABLE IF NOT EXISTS branch_inventory(branch_id TEXT,ingredient_id TEXT,stock_quantity REAL CHECK(stock_quantity>=0),weighted_average_cost REAL,updated_at TEXT,PRIMARY KEY(branch_id,ingredient_id));
 CREATE TABLE IF NOT EXISTS inventory_movements(movement_id TEXT PRIMARY KEY,branch_id TEXT,ingredient_id TEXT,movement_type TEXT,quantity REAL,unit TEXT,unit_cost REAL,total_cost REAL,balance_after REAL,reference_type TEXT,reference_id TEXT,user_id TEXT,idempotency_key TEXT UNIQUE,created_at TEXT);
 CREATE TABLE IF NOT EXISTS orders(order_id TEXT PRIMARY KEY,order_number TEXT,branch_id TEXT,order_source TEXT,order_type TEXT,order_status TEXT,payment_status TEXT,preparation_status TEXT,subtotal REAL,total_amount REAL,cashier_id TEXT,customer_phone TEXT,idempotency_key TEXT UNIQUE,created_at TEXT,cost_snapshot REAL,shift_id TEXT,paid_at TEXT);
 CREATE TABLE IF NOT EXISTS order_items(order_item_id TEXT PRIMARY KEY,order_id TEXT,product_id TEXT,size_id TEXT,unit_price REAL,quantity INTEGER,total_price REAL,recipe_id TEXT,is_prepared INTEGER DEFAULT 0);
 CREATE TABLE IF NOT EXISTS cashier_shifts(shift_id TEXT PRIMARY KEY,branch_id TEXT,cashier_id TEXT,status TEXT,cash_sales REAL DEFAULT 0,expected_cash REAL DEFAULT 0,electronic_sales REAL DEFAULT 0,cash_refunds REAL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS payment_records(payment_id TEXT PRIMARY KEY,order_id TEXT,shift_id TEXT,payment_method TEXT,gross_amount REAL,fee_amount REAL,net_amount REAL,reference_number TEXT,payment_status TEXT,cashier_id TEXT,idempotency_key TEXT UNIQUE,created_at TEXT);
 CREATE TABLE IF NOT EXISTS refund_records(refund_id TEXT PRIMARY KEY,order_id TEXT,payment_id TEXT,shift_id TEXT,amount REAL,method TEXT,reason TEXT,approved_by TEXT,restock_inventory INTEGER,created_at TEXT);
 CREATE TABLE IF NOT EXISTS order_status_history(history_id TEXT PRIMARY KEY,order_id TEXT,new_status TEXT,status_type TEXT,changed_by TEXT,changed_at TEXT,notes TEXT);
 `);
 const one=(sql,args=[])=>db.prepare(sql).get(...args),all=(sql,args=[])=>db.prepare(sql).all(...args),run=(sql,args=[])=>db.prepare(sql).run(...args);
 if(!one("SELECT 1 FROM branches WHERE branch_id='TEST-BRANCH'")){
  // Supply all required columns when running against the actual POS schema.
  if(process.env.FC_TEST_SCHEMA){
   db.exec(`INSERT INTO branches(branch_id,branch_name,address,status,created_at,updated_at) VALUES ('TEST-BRANCH','TEST','TEST','active','TEST','TEST');
    INSERT INTO ingredient_categories(category_id,name_ar) VALUES ('TEST','TEST');
    INSERT INTO product_categories(category_id,name_ar) VALUES ('TEST','TEST');
    INSERT INTO products(product_id,product_code,name_ar,category_id,created_at,updated_at) VALUES ('TEST-P','PJ01','TEST','TEST','TEST','TEST');
    INSERT INTO product_sizes(size_id,size_code,name_ar,volume_ml) VALUES ('TEST-S','500ml','TEST',500);
    INSERT INTO ingredients(ingredient_id,name_ar,category_id,purchase_unit,base_unit,created_at,updated_at) VALUES ('TEST-I','TEST','TEST','g','g','TEST','TEST');
    INSERT INTO recipes(recipe_id,product_id,name_ar,recipe_method,batch_yield_ml,created_at,updated_at) VALUES ('TEST-R','TEST-P','TEST','batch',1000,'TEST','TEST');
    INSERT INTO recipe_ingredients(recipe_item_id,recipe_id,ingredient_id,quantity,unit) VALUES ('TEST-RI','TEST-R','TEST-I',400,'g');
    INSERT INTO cashier_shifts(shift_id,shift_number,branch_id,cashier_id,opened_at,opening_float,expected_cash) VALUES ('TEST-SHIFT',1,'TEST-BRANCH','TEST-MANAGER','TEST',0,0);`);
  }else db.exec(`INSERT INTO branches VALUES ('TEST-BRANCH','active'); INSERT INTO products VALUES ('TEST-P','PJ01',1);
   INSERT INTO product_sizes VALUES ('TEST-S','500ml',500); INSERT INTO ingredients VALUES ('TEST-I','g','active');
   INSERT INTO recipes VALUES ('TEST-R','TEST-P','active',1,'ml',1000); INSERT INTO recipe_ingredients VALUES ('TEST-R','TEST-I',400,'g');
   INSERT INTO cashier_shifts(shift_id,branch_id,cashier_id,status) VALUES ('TEST-SHIFT','TEST-BRANCH','TEST-MANAGER','open');`);
  run('INSERT INTO branch_inventory(branch_id,ingredient_id,stock_quantity,weighted_average_cost,updated_at) VALUES (?,?,?,?,?)',['TEST-BRANCH','TEST-I',1000,0.1,'TEST']);
 }
 let queue=Promise.resolve();
 const transaction=fn=>{const next=queue.then(()=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}});queue=next.catch(()=>{});return next;};
 return {db,one,all,run,transaction,branchId:'TEST-BRANCH',close:()=>db.close()};
}
