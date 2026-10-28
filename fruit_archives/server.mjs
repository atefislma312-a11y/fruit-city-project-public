import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT,menu,slug,createEpisode,saveEpisode,blockers,exportPackage,SIZES} from './core.mjs';
export function startServer({port=5186,base=path.join(ROOT,'episodes')}={}){
 fs.mkdirSync(base,{recursive:true});
 const server=http.createServer(async(req,res)=>{
 const origin=`http://127.0.0.1:${server.address().port}`;
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
 if(req.headers.host!==new URL(origin).host)return send(403,{error:'Host denied'});
 if(req.headers.origin&&req.headers.origin!==origin)return send(403,{error:'Origin denied'});
 const url=new URL(req.url,origin), parts=url.pathname.split('/').filter(Boolean);
 const body=async()=>{if(!req.headers['content-type']?.startsWith('application/json'))throw Error('JSON required');let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>18_000_000)throw Error('Request too large');}return JSON.parse(raw);};
 const load=id=>{if(!slug(id))throw Error('Invalid id');return JSON.parse(fs.readFileSync(path.join(base,id,'episode.json'),'utf8'));};
 if(url.pathname==='/api/menu')return send(200,menu());
 if(url.pathname==='/api/episodes'&&req.method==='GET')return send(200,fs.readdirSync(base).filter(id=>slug(id)&&fs.existsSync(path.join(base,id,'episode.json'))).map(id=>{const e=load(id);return{id,title:e.eventTitle,fruit:e.fruit.arabicName,revision:e.revision};}));
 if(url.pathname==='/api/episodes'&&req.method==='POST'){const e=createEpisode(await body());if(fs.existsSync(path.join(base,e.id)))throw Error('معرف الحلقة موجود؛ اختار معرفًا جديدًا');return send(201,saveEpisode(base,e,0));}
 if(parts[0]==='api'&&parts[1]==='episodes'&&parts[2]){
  const id=parts[2],e=load(id);
  if(parts.length===3&&req.method==='GET')return send(200,{episode:e,blockers:blockers(e)});
  if(parts.length===3&&req.method==='PUT'){const data=await body();if(data.episode.id!==id)throw Error('ID mismatch');return send(200,saveEpisode(base,data.episode,data.expectedRevision));}
  if(parts[3]==='package'&&req.method==='POST'){await body();return send(200,exportPackage(base,e));}
  if(parts[3]==='approve'&&req.method==='POST'){await body();const b=blockers(e);return send(409,{error:'اعتماد النشر النهائي يحتاج مراجعة بشرية خارج هذه النسخة',blockers:b});}
  if(parts[3]==='render'&&req.method==='POST'){
    const d=await body();if(!SIZES[d.platform]||!['png','jpeg','webp'].includes(d.format)||!['A','B'].includes(d.variant))throw Error('Invalid export options');
    if(d.revision!==e.revision)throw Error('النسخة تغيرت؛ أعد المعاينة');
    const match=d.data.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!match||match[1]!==d.format)throw Error('Invalid image');
    const bytes=Buffer.from(match[2],'base64');if(bytes.length>12_000_000)throw Error('Image too large');
    if((d.format==='png'&&bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')||(d.format==='jpeg'&&bytes.subarray(0,2).toString('hex')!=='ffd8')||(d.format==='webp'&&bytes.subarray(8,12).toString()!=='WEBP'))throw Error('Image signature mismatch');
    const dir=path.join(base,id,'exports',d.platform);fs.mkdirSync(dir,{recursive:true});const name=`draft-v${e.revision}-${d.variant}-${Date.now()}.${d.format==='jpeg'?'jpg':d.format}`;fs.writeFileSync(path.join(dir,name),bytes,{flag:'wx'});
    const record={platform:d.platform,format:d.format,dimensions:SIZES[d.platform],filePath:`exports/${d.platform}/${name}`,version:e.revision,timestamp:new Date().toISOString(),qaStatus:'needs-review',variant:d.variant,blockers:blockers(e)};
    fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(record,null,2));return send(201,record);
  }
 }
 if(req.method!=='GET')return send(405,{error:'Method not allowed'});
 let target;if(url.pathname.startsWith('/assets/')){if(!/^\/assets\/[a-zA-Z0-9_.-]+\.(png|jpg|jpeg|webp)$/.test(url.pathname))return send(404,{});target=path.join(ROOT,url.pathname.slice(1));}
 else {const allowed={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/render.js':'render.js'};if(!allowed[url.pathname])return send(404,{});target=path.join(ROOT,'public',allowed[url.pathname]);}
 const ext=path.extname(target);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[ext],'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"});res.end(fs.readFileSync(target));
 }catch(err){send(400,{error:err.code==='ENOENT'?'الملف غير موجود':err.message});}
 });server.listen(port,'127.0.0.1',()=>console.log(`Fruit Archives: http://127.0.0.1:${server.address().port}`));return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startServer();
