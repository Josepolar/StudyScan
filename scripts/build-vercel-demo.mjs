import { build } from 'rolldown';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
import {publicAuthConfig} from '../auth/config.mjs';
try{loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
const auth=publicAuthConfig(process.env);
const preview=process.argv.includes('--preview');const output=preview?'.sites-runtime/preview':'vercel-demo';
await mkdir(output, { recursive: true });
await build({ input: preview?'demo/preview.tsx':'demo/entry.tsx', platform: 'browser', transform: { jsx: { runtime: 'automatic' }, define: { 'process.env.NODE_ENV': '"production"','__STUDYSCAN_AUTH__':JSON.stringify(auth) } }, output: { file: output+'/client.js', format: 'esm', minify: true } });
await copyFile('app/globals.css', output+'/style.css');
await copyFile('public/favicon.svg', output+'/favicon.svg');
await copyFile('auth/auth.css',output+'/auth.css');
for(const name of ['about.html','privacy.html'])await copyFile('public/'+name,output+'/'+name);
await writeFile(output+'/index.html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="google-site-verification" content="tOww_V-C7X5zb6-UEccjACfqUW1BV8CpY1b9lkPdQWc"><title>StudyScan | Sign in to your classroom</title><meta name="description" content="StudyScan connects students, teachers, and school administrators through lessons, activities, and guided academic support."><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/auth.css"></head><body><div id="demo-controls"></div><div id="root"></div><script type="module" src="/client.js"></script></body></html>');
console.log('StudyScan built in '+output+'/');
