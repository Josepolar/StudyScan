import {mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
await mkdir('.vercel/output/static',{recursive:true});
for(const name of ['index.html','client.js','style.css','auth.css','favicon.svg','about.html','privacy.html'])await copyFile('vercel-demo/'+name,'.vercel/output/static/'+name);
const config=JSON.parse(await readFile('vercel.json','utf8'));
const headers=Object.fromEntries(config.headers.find(rule=>rule.source==='/(.*)').headers.map(({key,value})=>[key,value]));
await writeFile('.vercel/output/config.json',JSON.stringify({version:3,routes:[{src:'/(.*)',headers,continue:true},{handle:'filesystem'}]}));
console.log('Prepared Vercel static output with shared security headers.');
