export function customerDetails(value) {
 if(!value||typeof value.phone!=='string')throw Error('INVALID_CUSTOMER_PHONE');
 const phone=value.phone.trim().replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[\s()-]/g,'');
 if(!/^(?:\+20|0020|0)1[0125]\d{8}$/.test(phone))throw Error('INVALID_CUSTOMER_PHONE');
 return {phone:phone.startsWith('0020')?'+'+phone.slice(2):phone.startsWith('0')?'+20'+phone.slice(1):phone};
}
