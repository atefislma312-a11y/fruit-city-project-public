import {DatabaseSync} from 'node:sqlite';
import {reconcile,approvedVariants} from './catalog.mjs';

export function minorUnits(value) {
 const text=String(value);
 if(!/^\d+(?:\.\d{1,2})?$/.test(text))return null;
 const [whole,fraction='']=text.split('.');
 const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(amount)&&amount>0?amount:null;
}

// Local read-only adapter; never expose the database or persist a price export.
// A fresh SQLite read transaction gives one consistent view per quote/confirmation.
export function readPosCatalog(path,menu,config) {
 if(config?.priceSource!=='City Management System'||!config.branchId||!config.branchApproval||!config.approvedBy)throw Error('PRICE_APPROVAL_REQUIRED');
 const db=new DatabaseSync(path,{readOnly:true});
 try {
  db.exec('PRAGMA query_only=ON; BEGIN');
  const branch=db.prepare('SELECT status FROM branches WHERE branch_id=?').get(config.branchId);
  if(branch?.status!=='active')throw Error('UNAVAILABLE_BRANCH');
  const products=db.prepare('SELECT product_id, product_code, is_active FROM products').all();
  const sizes=db.prepare('SELECT size_id, size_code, volume_ml FROM product_sizes').all();
  const prices=db.prepare('SELECT product_id, size_id, selling_price, is_available FROM product_prices WHERE branch_id=?').all(config.branchId).map(p=>({
   productId:p.product_id,sizeId:p.size_id,branchId:config.branchId,priceMinor:minorUnits(p.selling_price),available:p.is_available===1
  }));
  const now=Date.now();
  const result=approvedVariants(reconcile(menu,{products,sizes}),{branchId:config.branchId,approval:{by:config.approvedBy,reference:config.branchApproval},expiresAt:now+1000,prices},now);
  db.exec('COMMIT');return result;
 }finally{db.close();}
}
