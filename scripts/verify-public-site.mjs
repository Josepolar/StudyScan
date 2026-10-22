import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Check both deployment paths so a normal Git deployment cannot drop the headers.
const config=JSON.parse(await readFile('vercel.json','utf8'));
const expected=Object.fromEntries(config.headers.find(rule=>rule.source==='/(.*)').headers.map(({key,value})=>[key.toLowerCase(),value]));
const prebuilt=JSON.parse(await readFile('.vercel/output/config.json','utf8'));
assert.deepEqual(Object.fromEntries(Object.entries(prebuilt.routes[0].headers).map(([key,value])=>[key.toLowerCase(),value])),expected);
const origin='https://studyscan-green.vercel.app';
for(const path of ['/','/client.js','/about.html','/privacy.html']){
 const response=await fetch(origin+path,{redirect:'error'});
 assert.equal(response.status,200,`${path} must load without redirects`);
 for(const [key,value] of Object.entries(expected))assert.equal(response.headers.get(key),value,`${path}: missing or changed ${key}`);
 const body=await response.text();
 assert.doesNotMatch(body,/\b(?:gsk_[a-zA-Z0-9]{20,}|sb_secret_[a-zA-Z0-9_-]{10,})\b/,'Private provider keys must not be published');
 if(path==='/')assert.deepEqual([...body.matchAll(/<script[^>]*src=["']([^"']+)/g)].map(match=>match[1]),['/client.js']);
 if(path==='/client.js'){assert.equal(body,await readFile('vercel-demo/client.js','utf8'),'Live bundle must match this release');for(const removed of ['Student preview','Back to teacher','Are you a teacher?','Request teacher access','Preapprove a known teacher'])assert.ok(!body.includes(removed),removed+' must not be in the production client');}
}
for(const path of ['/.env','/.git/config'])assert.equal((await fetch(origin+path)).status,404,`${path} must not be served`);
console.log('Public deployment verified: shared security headers, expected script bundle, public information pages, no detected private key patterns, and inaccessible configuration files. This is not a complete security audit or a Safe Browsing clearance.');
