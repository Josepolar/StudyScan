// In-process preview build for hosts that cannot launch native build subprocesses.
import { build } from 'rolldown';
import ts from 'typescript';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from 'drizzle-kit/api';
await mkdir('.sites-runtime/local',{recursive:true});
const compiled=ts.transpileModule(await readFile('db/schema.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
await writeFile('.sites-runtime/local/schema.mjs',compiled);
const schema=await import('../.sites-runtime/local/schema.mjs');
const empty=await generateSQLiteDrizzleJson({});const snapshot=await generateSQLiteDrizzleJson(schema);
snapshot.prevId=empty.id;
const sql=await generateSQLiteMigration(empty,snapshot);
await mkdir('drizzle/meta',{recursive:true});
try{await readFile('drizzle/0000_studyscan.sql');}catch{
 await writeFile('drizzle/0000_studyscan.sql',sql.join('\n--> statement-breakpoint\n'));
 await writeFile('drizzle/meta/0000_snapshot.json',JSON.stringify(snapshot,null,2));
 await writeFile('drizzle/meta/_journal.json',JSON.stringify({version:'7',dialect:'sqlite',entries:[{idx:0,version:'6',when:Date.now(),tag:'0000_studyscan',breakpoints:true}]},null,2));
}
await writeFile('.sites-runtime/local/client.tsx',`import { createRoot } from 'react-dom/client';import App from '../../app/study-scan';createRoot(document.getElementById('root')!).render(<App/>);`);
const transform={jsx:{runtime:'automatic'},define:{'process.env.NODE_ENV':'"production"'}};
await build({input:'./.sites-runtime/local/client.tsx',platform:'browser',transform,output:{file:'.sites-runtime/local/client.js',format:'esm',minify:true}});
await build({input:'./scripts/local-entry.ts',platform:'node',external:['node:async_hooks'],transform,plugins:[{name:'preview-adapters',resolveId(id){if(id==='cloudflare:workers')return {id:'preview-env',external:false};if(id.endsWith('app/chatgpt-auth'))return {id:'preview-auth',external:false};},load(id){if(id==='preview-env')return 'export const env=globalThis.__studyLocalEnv;';if(id==='preview-auth')return 'export async function getChatGPTUser(){const r=globalThis.__studyRequest.getStore();return r?.user||null;}';}}],output:{file:'.sites-runtime/local/api.mjs',format:'esm'}});
console.log('Local client, server, and database migrations built successfully.');

