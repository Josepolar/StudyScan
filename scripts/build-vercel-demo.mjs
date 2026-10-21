import { build } from 'rolldown';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
import {publicAuthConfig} from '../auth/config.mjs';
try{loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
const auth=publicAuthConfig(process.env);
await mkdir('vercel-demo', { recursive: true });
await build({ input: 'demo/entry.tsx', platform: 'browser', transform: { jsx: { runtime: 'automatic' }, define: { 'process.env.NODE_ENV': '"production"','__STUDYSCAN_AUTH__':JSON.stringify(auth) } }, output: { file: 'vercel-demo/client.js', format: 'esm', minify: true } });
await copyFile('app/globals.css', 'vercel-demo/style.css');
await copyFile('public/favicon.svg', 'vercel-demo/favicon.svg');
await copyFile('auth/auth.css','vercel-demo/auth.css');
await writeFile('vercel-demo/index.html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StudyScan | Sign in to your classroom</title><meta name="description" content="Explore StudyScan teacher and student learning workspaces with sample Grade 9 lessons."><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/auth.css"></head><body><div id="demo-controls"></div><div id="root"></div><script type="module" src="/client.js"></script></body></html>');
console.log('StudyScan browser demo built in vercel-demo/');
