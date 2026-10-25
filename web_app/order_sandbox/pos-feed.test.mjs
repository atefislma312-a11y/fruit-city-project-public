import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {minorUnits,readPosCatalog} from './pos-feed.mjs';
test('money conversion refuses rounded, negative, missing or unsafe prices',()=>{
 assert.equal(minorUnits('12.50'),1250);
 for(const value of [null,undefined,-1,0,1.234,'1e3',Number.MAX_SAFE_INTEGER])assert.equal(minorUnits(value),null);
});
test('POS feed selects approved branch, refreshes availability and leaves source unchanged',t=>{
 const dir=mkdtempSync(join(tmpdir(),'fc-feed-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const path=join(dir,'fixture.db'),db=new DatabaseSync(path);
 db.exec(`CREATE TABLE branches(branch_id,status);CREATE TABLE products(product_id,product_code,is_active);CREATE TABLE product_sizes(size_id,size_code,volume_ml);CREATE TABLE product_prices(product_id,size_id,branch_id,selling_price,is_available);
 INSERT INTO branches VALUES('TEST','active');INSERT INTO products VALUES('P','TEST-SKU',1);INSERT INTO product_sizes VALUES('S','500ml',500);INSERT INTO product_prices VALUES('P','S','TEST',12.50,1),('P','S','OTHER',99,1);`);db.close();
 const config={priceSource:'City Management System',branchId:'TEST',branchApproval:'TEST ONLY',approvedBy:'TEST OWNER'};
 const menu={sections:[{items:[{sku:'TEST-SKU',available_sizes:{bottle_500ml:{available:true}}}]}]};
 const before=readFileSync(path);assert.equal(readPosCatalog(path,menu,config)[0].priceMinor,1250);assert.deepEqual(readFileSync(path),before);
 assert.throws(()=>readPosCatalog(path,menu,{...config,branchId:'OTHER'}),/UNAVAILABLE_BRANCH/);
 const writer=new DatabaseSync(path);writer.exec('UPDATE product_prices SET is_available=0');writer.close();assert.deepEqual(readPosCatalog(path,menu,config),[]);
 assert.throws(()=>readPosCatalog(path,menu,{...config,branchApproval:null}),/PRICE_APPROVAL_REQUIRED/);
});
