import assert from 'node:assert/strict';
import { generateAnswer, aiInfo } from '../lib/ai.ts';
const env={AI_PROVIDER:'groq',GROQ_API_KEY:'test-only-secret'};
const input={sources:[{index:1,text:'Force equals mass times acceleration.'}],history:[],question:'What is force?'};
let count=0;
const completion=(answer,finish_reason='stop')=>Response.json({choices:[{finish_reason,message:{content:JSON.stringify(answer)}}]});
assert.equal(aiInfo({}).ready,false);assert.equal(aiInfo({GROQ_API_KEY:'  '}).ready,false);count++;
await assert.rejects(generateAnswer({},'policy',input,()=>{throw Error('should not call');}),/AI_NOT_CONFIGURED/);count++;
const valid=await generateAnswer(env,'Teacher says hints only',input,async(url,options)=>{
 assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
 assert.equal(options.headers.Authorization,'Bearer test-only-secret');
 const body=JSON.parse(options.body);assert.equal(body.model,'openai/gpt-oss-20b');
 assert.equal(body.response_format.json_schema.strict,true);
 assert.match(body.messages[0].content,/Teacher says hints only/);
 assert.ok(!options.body.includes('test-only-secret'));assert.deepEqual(JSON.parse(body.messages[1].content),input);
 return completion({answer:'Think about how mass changes acceleration.',status:'answered',citations:[1,1]});
});assert.deepEqual(valid.citations,[1]);count++;
for(const response of [
 {answer:'Invented source',status:'answered',citations:[2]},
 {answer:'No source',status:'answered',citations:[]},
 {answer:'Bad status',status:'other',citations:[1]},
 {answer:'',status:'answered',citations:[1]},
 {answer:'String reference',status:'answered',citations:['1']},
 null,
]){await assert.rejects(generateAnswer(env,'policy',input,async()=>completion(response)),/AI_INVALID_RESPONSE/);count++;}
const referral=await generateAnswer(env,'policy',input,async()=>completion({answer:'Please ask your teacher.',status:'needs-teacher',citations:[]}));assert.equal(referral.status,'needs-teacher');count++;
await assert.rejects(generateAnswer(env,'policy',input,async()=>completion({answer:'partial',status:'answered',citations:[1]},'length')),/AI_INVALID_RESPONSE/);count++;
await assert.rejects(generateAnswer(env,'policy',input,async()=>new Response('private provider details',{status:429})),/AI_RATE_LIMITED/);count++;
await assert.rejects(generateAnswer(env,'policy',input,async()=>new Response('private provider details',{status:401})),/AI_UNAVAILABLE/);count++;
await assert.rejects(generateAnswer(env,'policy',input,async()=>{throw new DOMException('Timeout','TimeoutError');}),/Timeout/);count++;
assert.equal(aiInfo({GROQ_API_KEY:'unused'}).ready,false);count++;
assert.equal(aiInfo({AI_PROVIDER:'unknown',OPENAI_API_KEY:'unused'}).ready,false);count++;
await generateAnswer({OPENAI_API_KEY:'openai-test-secret',GROQ_API_KEY:'unused'},'policy',input,async(url,options)=>{
 assert.equal(url,'https://api.openai.com/v1/chat/completions');
 assert.equal(options.headers.Authorization,'Bearer openai-test-secret');
 const body=JSON.parse(options.body);assert.equal(body.model,'gpt-4.1-mini');assert.equal(body.store,false);
 assert.ok(!options.body.includes('openai-test-secret'));
 return completion({answer:'Use the force equation.',status:'answered',citations:[1]});
});count++;
const local=await generateAnswer({AI_PROVIDER:'ollama',OPENAI_API_KEY:'must-not-send'},'policy',input,async(url,options)=>{
 assert.equal(url,'http://127.0.0.1:11434/api/chat');assert.equal(options.headers.Authorization,undefined);
 const body=JSON.parse(options.body);assert.equal(body.model,'qwen3:0.6b');assert.equal(body.think,false);assert.equal(body.stream,false);
 assert.ok(!options.body.includes('must-not-send'));
 return Response.json({done:true,done_reason:'stop',message:{content:JSON.stringify({answer:'Force depends on mass and acceleration.',status:'answered',citations:[1]})}});
});assert.equal(local.status,'answered');count++;
await assert.rejects(generateAnswer({AI_PROVIDER:'ollama'},'policy',input,async()=>Response.json({done:true,done_reason:'length',message:{content:'{}'}})),/AI_INVALID_RESPONSE/);count++;
console.log(`${count} AI adapter checks passed (mock transport; not live inference).`);
