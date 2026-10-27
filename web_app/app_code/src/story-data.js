export function approvedStory(records,sku){
 const s=records[sku];
 if(!s||s.approved!==true||s.sku!==sku||typeof s.title!=='string'||!s.title.trim()||!Array.isArray(s.paragraphs)||!s.paragraphs.length||!s.paragraphs.every(p=>typeof p==='string'&&p.trim())||typeof s.image!=='string'||!/^\/stories\/[a-zA-Z0-9_/-]+\.(webp|jpg|png)$/.test(s.image)||s.image.includes('..'))return null;
 return s;
}
