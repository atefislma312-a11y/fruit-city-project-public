import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedStory} from '../src/story-data.js';
test('only approved complete stories for the exact SKU appear; unsafe image paths rejected',()=>{
 const s={sku:'PJ01',approved:true,title:'عنوان معتمد',image:'/stories/PJ01.webp',paragraphs:['محتوى معتمد']};
 assert.equal(approvedStory({PJ01:s},'PJ01'),s);
 for(const changes of [{approved:false},{sku:'PJ02'},{paragraphs:[]},{image:'https://other.test/a.jpg'},{image:'/stories/../secret.jpg'}])assert.equal(approvedStory({PJ01:{...s,...changes}},'PJ01'),null);
 assert.equal(approvedStory({},'PJ01'),null);
});
