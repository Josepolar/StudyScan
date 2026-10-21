import assert from 'node:assert/strict';
const env={SUPABASE_URL:'https://school.example',SUPABASE_ANON_KEY:'public-test-key',SUPABASE_SERVICE_ROLE_KEY:'private-test-key',GROQ_API_KEY:'private-groq-test-key',AI_FREE_TIER_CONFIRMED:'true',AI_SCHOOL_USE_CONFIRMED:'true'};
let handler;globalThis.Deno={env:{get:name=>env[name]},serve:fn=>{handler=fn;}};
let safety=true,providerFailure=false,finished=[],calls=[];
const nativeFetch=globalThis.fetch;
const response=data=>Response.json(data);
globalThis.fetch=async(input,init={})=>{
 const url=String(input),body=init.body?JSON.parse(init.body):null;calls.push({url,body});
 if(url.endsWith('/auth/v1/user'))return response({id:'00000000-0000-4000-8000-000000000001',email_confirmed_at:'2026-01-01'});
 if(url.endsWith('/rpc/studyscan_actor'))return response([{role:'student',status:'active'}]);
 if(url.endsWith('/rpc/studyscan_ai_begin'))return response({id:'00000000-0000-4000-8000-000000000002',blocked:null,lesson:{title:'Circuits',topic:'Voltage',content:'Voltage is potential difference.',policy:{mode:'Hints and Guidance',directAnswers:false}},history:[]});
 if(url.endsWith('/rpc/studyscan_ai_finish')){finished.push(body);return new Response(null,{status:204});}
 if(url.endsWith('/openai/v1/models'))return response({data:[{id:'openai/gpt-oss-20b'}]});
 if(url==='https://api.groq.com/openai/v1/chat/completions'){
  if(providerFailure)return Response.json({error:{message:'private upstream diagnostic'}},{status:429});
  if(body.model==='openai/gpt-oss-safeguard-20b')return response({choices:[{finish_reason:'stop',message:{content:JSON.stringify({safe:safety})}}]});
  assert.equal(body.model,'openai/gpt-oss-20b');assert.equal(body.response_format.json_schema.strict,true);
  return response({choices:[{finish_reason:'stop',message:{content:JSON.stringify({answer:'Voltage is potential difference.',status:'answered',citations:[1]})}}]});
 }
 throw Error('Unexpected network target: '+url);
};
try{
 await import('../supabase/functions/study-assistant/index.js');
 const request=(body={},headers={})=>new Request('https://school.example/functions/v1/study-assistant',{method:'POST',headers:{Origin:'https://studyscan-green.vercel.app',Authorization:'Bearer verified-test-session','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await handler(request({action:'status'},{Origin:'https://unexpected.example'}))).status,403);
 assert.equal((await handler(new Request('https://school.example',{method:'POST',body:'{}'}))).status,401);
 assert.equal((await (await handler(request({action:'status'}))).json()).ready,true);
 const body={action:'ask',lesson:'00000000-0000-4000-8000-000000000003',question:'What is voltage?'};
 const answer=await (await handler(request(body))).json();assert.equal(answer.status,'answered');assert.equal(answer.sources.length,1);assert.equal(finished.at(-1).answer_status,'answered');
 assert.ok(!JSON.stringify(calls.find(c=>c.body?.model==='openai/gpt-oss-20b').body).includes('verified-test-session'));
 safety=false;const unsafe=await (await handler(request(body))).json();assert.equal(unsafe.status,'needs-teacher');assert.match(unsafe.answer,/trusted adult/);assert.equal(finished.at(-1).answer_status,'needs-teacher');
 providerFailure=true;const unavailable=await (await handler(request(body))).json();assert.equal(unavailable.status,'unavailable');assert.ok(!unavailable.answer.includes('private upstream'));
 assert.ok(calls.every(c=>c.url.startsWith('https://school.example')||c.url.startsWith('https://api.groq.com/')),'Never fall back to a paid provider.');
 env.AI_FREE_TIER_CONFIRMED='false';assert.equal((await (await handler(request({action:'status'}))).json()).ready,false);
 const tooLarge=await handler(request({action:'status',padding:'x'.repeat(17000)}));assert.equal(tooLarge.status,400);assert.match((await tooLarge.json()).error,/too large/);
 console.log('Edge endpoint verified: authentication gate, allowed origins, real-profile shape handling, free-only provider routing, validated citations, safety refusal, quota failure handling, and bounded request bodies.');
}finally{globalThis.fetch=nativeFetch;delete globalThis.Deno;}

