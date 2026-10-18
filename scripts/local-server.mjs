import { loadEnvFile } from 'node:process';
try { loadEnvFile('.env.local'); } catch(error) { if(error.code!=='ENOENT') throw error; }
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
await mkdir('.sites-runtime/local/files',{recursive:true});
const database=new DatabaseSync('.sites-runtime/local/studyscan.sqlite');
database.exec('PRAGMA journal_mode=WAL');
database.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
if(!database.prepare('SELECT name FROM local_migrations WHERE name=?').get('0000_studyscan')){database.exec(await readFile('drizzle/0000_studyscan.sql','utf8'));database.prepare('INSERT INTO local_migrations VALUES (?)').run('0000_studyscan');}
class Statement{constructor(sql){this.sql=sql;this.args=[];}bind(...args){const s=new Statement(this.sql);s.args=args;return s;}async all(){return {results:database.prepare(this.sql).all(...this.args)}}async first(){return database.prepare(this.sql).get(...this.args)||null}async run(){return database.prepare(this.sql).run(...this.args)}}
globalThis.__studyRequest=new AsyncLocalStorage();
globalThis.__studyLocalEnv={DB:{prepare:sql=>new Statement(sql),async batch(statements){database.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());database.exec('COMMIT');return results;}catch(e){database.exec('ROLLBACK');throw e;}}},BUCKET:{async put(id,bytes){await writeFile(`.sites-runtime/local/files/${id}`,Buffer.from(bytes));},async get(id){if(!/^[a-z0-9-]+$/i.test(id))return null;try{return {body:await readFile(`.sites-runtime/local/files/${id}`)}}catch{return null}},async delete(id){await unlink(`.sites-runtime/local/files/${id}`).catch(()=>{});}},AI_PROVIDER:process.env.AI_PROVIDER,OLLAMA_MODEL:process.env.OLLAMA_MODEL,OPENAI_API_KEY:process.env.OPENAI_API_KEY,OPENAI_MODEL:process.env.OPENAI_MODEL,GROQ_API_KEY:process.env.GROQ_API_KEY,GROQ_MODEL:process.env.GROQ_MODEL};
const {handle}=await import('../.sites-runtime/local/api.mjs');
const users={teacher:{userId:'local-teacher',displayName:'Alex Reyes',fullName:'Alex Reyes',email:'teacher@studyscan.local'},student:{userId:'local-student',displayName:'Jamie Santos',fullName:'Jamie Santos',email:'student@studyscan.local'},outsider:{userId:'local-outsider',displayName:'Unassigned Student',fullName:'Unassigned Student',email:'outsider@studyscan.local'}};
// Local demo identities are available ONLY in this loopback server, never in the hosted app.
database.prepare('INSERT OR IGNORE INTO settings (id,value) VALUES (?,?)').run('school-owner','local-teacher');
const port=Number(process.env.STUDYSCAN_PORT||5180);
const origin=`http://127.0.0.1:${port}`;
const allowTunnel=process.env.STUDYSCAN_ALLOW_TUNNEL==='1';
const csrf=randomUUID();
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>StudyScan | Local development</title><link rel="stylesheet" href="/style.css"><link rel="icon" href="/favicon.svg"></head><body><div style="position:fixed;bottom:5px;right:10px;z-index:35;font:12px Segoe UI;background:#fff;border:1px solid #dce2ed;padding:6px 10px;border-radius:6px">LOCAL DEMO · <a href="/local-account?role=teacher&token=${csrf}">Teacher</a> · <a href="/local-account?role=student&token=${csrf}">Student</a></div><div id="root"></div><script type="module" src="/client.js"></script></body></html>`;
const server=createServer(async(req,res)=>{try{
 if(!allowTunnel&&req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403);res.end('Invalid host');return;}
 if(!allowTunnel&&req.headers.origin&&req.headers.origin!==origin){res.writeHead(403);res.end('Invalid origin');return;}
 const url=new URL(req.url,origin);
 if(url.pathname==='/local-account'){if(url.searchParams.get('token')!==csrf){res.writeHead(403);res.end('Invalid token');return;}const role=url.searchParams.get('role');res.writeHead(303,{'Set-Cookie':`local-role=${role==='student'?'student':'teacher'}; HttpOnly; SameSite=Strict; Path=/`,'Location':'/'});res.end();return;}
 if(url.pathname==='/api/study'||url.pathname==='/api/files'){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>11000000){res.writeHead(413);res.end('Payload too large');return;}chunks.push(chunk);}const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='GET'?{}:{body:Buffer.concat(chunks)})});const cookie=/local-role=(\w+)/.exec(req.headers.cookie||'')?.[1];const user=users[cookie]||users.teacher;const result=await globalThis.__studyRequest.run({user},()=>handle(request));res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));return;}
 const assets={'/client.js':['.sites-runtime/local/client.js','text/javascript'],'/style.css':['app/globals.css','text/css'],'/favicon.svg':['public/favicon.svg','image/svg+xml']};if(assets[url.pathname]){const [p,type]=assets[url.pathname];res.writeHead(200,{'Content-Type':type});res.end(await readFile(p));return;}
 if(url.pathname==='/'||url.pathname==='/signout-with-chatgpt'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;}res.writeHead(404);res.end('Not found');
}catch(e){console.error(e);res.writeHead(500);res.end('Local preview error');}});
server.listen(port,'127.0.0.1',()=>console.log(`StudyScan local preview ready: ${origin}`));
