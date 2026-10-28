export const sizes={facebook:[1080,1080],instagram:[1080,1350],pinterest:[1000,1500],tiktok:[1080,1920],'instagram-reels':[1080,1920],'facebook-reels':[1080,1920],webapp:[1200,630]};
export function wrap(ctx,text,max){const lines=[];let line='';for(const word of text.split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>max&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;}
export async function draw(canvas,e,platform,variant='A'){
 const [w,h]=sizes[platform];canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');await document.fonts.ready;
 const grd=ctx.createLinearGradient(0,0,w,h);grd.addColorStop(0,e.design.palette[0]);grd.addColorStop(1,e.design.palette[1]);ctx.fillStyle=grd;ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='#ffffff35';ctx.lineWidth=2;ctx.strokeRect(w*.035,h*.03,w*.93,h*.94);
 ctx.textAlign='center';ctx.direction='ltr';ctx.fillStyle='#fff3d2';ctx.font=`${w*.022}px Arial`;ctx.fillText('FRUIT CITY / THE FRUIT ARCHIVES',w/2,h*.075);
 ctx.font=`${w*.018}px Arial`;ctx.fillText(`${e.country} / ${e.year}`,w/2,h*.11);
 const hook=variant==='B'?e.hooks[e.alternateHook].text:(e.platformContent.find(c=>c.platform===platform).imageHook||e.hooks[e.selectedHook].text);
 ctx.direction='rtl';let font=Math.min(w*.062,h*.065),lines;
 do{ctx.font=`bold ${font}px Tahoma, Arial`;lines=wrap(ctx,hook,w*.84);if(lines.length*font*1.4<=h*.22&&lines.every(l=>ctx.measureText(l).width<=w*.84))break;font-=2;}while(font>16);
 const fits=lines.length*font*1.4<=h*.22&&lines.every(l=>ctx.measureText(l).width<=w*.84);
 if(!fits)throw Error('الهوك خارج حدود التصميم؛ اختصر النص');
 lines.forEach((line,i)=>ctx.fillText(line,w/2,h*.23+i*font*1.4));
 const a=e.assets.find(a=>a.id===e.design.productAssetId),box={x:w*.22,y:h*.39,w:w*.56,h:h*.43};
 if(a){const img=new Image();img.src='/'+a.filePath;await img.decode();const scale=Math.min(box.w/img.width,box.h/img.height);ctx.drawImage(img,box.x+(box.w-img.width*scale)/2,box.y+(box.h-img.height*scale)/2,img.width*scale,img.height*scale);}else{ctx.font=`${w*.03}px Tahoma`;ctx.fillText('صورة المنتج الأصلية مطلوبة',w/2,h*.62);}
 ctx.fillStyle='#fff5db';ctx.font=`${w*.023}px Tahoma`;ctx.fillText('Fruit City — كل عصير وراه حكاية.',w/2,h*.88);
 ctx.fillStyle='#fff';ctx.fillRect(w*.08,h*.92,w*.84,h*.045);ctx.fillStyle='#702e24';ctx.font=`bold ${w*.017}px Tahoma`;ctx.fillText('مسودة للمراجعة فقط · حقوق الأصول والاعتماد النهائي قيد المراجعة',w/2,h*.95);
 return {fits,hook,font,lines,dimensions:[w,h],productBox:box,hookBottom:h*.23+(lines.length-1)*font*1.4,productUnaltered:true};
}
