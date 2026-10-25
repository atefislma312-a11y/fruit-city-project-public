import {defineConfig} from 'vite';
export default defineConfig({server:{host:'127.0.0.1',port:5174,strictPort:true,
 proxy:process.env.FC_INTAKE_DEV==='1'?{'/api':{target:'http://127.0.0.1:5180',rewrite:p=>p.replace(/^\/api/,'')}}:undefined}});
