import {mkdir,copyFile,writeFile} from 'node:fs/promises';
await mkdir('.vercel/output/static',{recursive:true});
for(const name of ['index.html','client.js','style.css','auth.css','favicon.svg'])await copyFile('vercel-demo/'+name,'.vercel/output/static/'+name);
await writeFile('.vercel/output/config.json',JSON.stringify({version:3,routes:[{src:'/(.*)',headers:{'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://xnhkpavzbgxvptxocubf.supabase.co wss://xnhkpavzbgxvptxocubf.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"},continue:true},{handle:'filesystem'}]}));
console.log('Prepared Vercel static output with security headers.');
