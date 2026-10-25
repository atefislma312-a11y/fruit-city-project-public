import test from 'node:test';
import assert from 'node:assert/strict';
import {customerDetails} from './customer.mjs';
import {OrderIntake} from './intake.mjs';
test('normalize Egyptian phone and discard unapproved fields',()=>{
 assert.deepEqual(customerDetails({phone:'٠١٠٠٠٠٠٠٠٠٠',role:'manager'}),{phone:'+201000000000'});
 assert.equal(customerDetails({phone:'00201000000000'}).phone,'+201000000000');
 for(const phone of ['',null,'010123','+19999999999','01000000000<script>'])assert.throws(()=>customerDetails({phone}),/INVALID_CUSTOMER_PHONE/);
});
test('customer is bound to quote; confirmation cannot replace it',t=>{
 const s=new OrderIntake(':memory:',[{sku:'TEST',size:'500ml',available:true,priceMinor:100,posProductId:'P',posSizeId:'S'}]);t.after(()=>s.close());
 const input={items:[{sku:'TEST',size:'500ml',quantity:1}],fulfillment:'pickup',paymentMethod:'cash'};
 assert.throws(()=>s.quote(input),/INVALID_CUSTOMER_PHONE/);
 assert.equal(s.db.prepare('SELECT count(*) n FROM intake_quotes').get().n,0);
 const q=s.quote({...input,customer:{phone:'01000000000'}});
 const o=s.confirm({key:'test-customer-key',quoteId:q.id,accessToken:q.accessToken,expectedTotalMinor:100,customer:{phone:'01111111111'}});
 assert.equal(o.customer.phone,'+201000000000');
 const legacy=s.quote({...input,customer:{phone:'01000000000'}});delete legacy.customer;
 s.db.prepare('UPDATE intake_quotes SET snapshot=? WHERE id=?').run(JSON.stringify(legacy),legacy.id);
 assert.throws(()=>s.confirm({key:'legacy-customer-key',quoteId:legacy.id,accessToken:legacy.accessToken,expectedTotalMinor:100}),/INVALID_CUSTOMER_PHONE/);
});
