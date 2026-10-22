import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHandler,invitationMail} from '../supabase/functions/teacher-invitations/handler.mjs';
const env={SUPABASE_URL:'https://school.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private',TEACHER_MAIL_GMAIL:'operator@gmail.com',TEACHER_MAIL_APP_PASSWORD:'abcdefghijklmnop',TEACHER_MAIL_ENABLED:'true'};
let role='super-admin',mail=[],reserved=[],finished=[],fail=false,quota=false;
const handler=createHandler({env:key=>env[key],fetch:async(url,init)=>{
 const body=init.body?JSON.parse(init.body):null;
 if(url.endsWith('/auth/v1/user'))return Response.json({id:'owner-id',email_confirmed_at:'2026-01-01'});
 if(url.endsWith('/rpc/studyscan_actor'))return Response.json([{role,status:'active'}]);
 if(url.endsWith('/rpc/studyscan_teacher_invite_delivery')){
  assert.equal(body.actor_id,'owner-id');assert.equal(init.headers.Authorization,'Bearer private');
  if(body.operation==='reserve'){if(quota)return Response.json({message:'Hourly invitation limit reached. Try again later.'},{status:400});reserved.push(body.payload);return Response.json({id:body.payload.resend?'existing-id':body.payload.id,email:body.payload.email});}
  finished.push(body.payload);return new Response(null,{status:204});
 }throw Error('Unexpected network target');
},sendMail:async(message)=>{if(fail)throw Error('private SMTP diagnostic');mail.push(message);}});
const request=(body,headers={})=>new Request('https://school.test',{method:'POST',headers:{Origin:'https://studyscan-green.vercel.app',Authorization:'Bearer user-session',...headers},body:JSON.stringify(body)});
assert.equal((await handler(new Request('https://school.test',{method:'POST'}))).status,401);
role='student';assert.equal((await handler(request({action:'send',email:'teacher@gmail.com'}))).status,403);assert.equal(reserved.length,0);role='super-admin';
env.TEACHER_MAIL_ENABLED='false';assert.equal((await handler(request({action:'send',email:'teacher@gmail.com'}))).status,503);assert.equal(mail.length,0);env.TEACHER_MAIL_ENABLED='true';
assert.equal((await (await handler(request({action:'status'}))).json()).ready,true);
const result=await handler(request({action:'send',email:'Teacher@gmail.com'}));assert.equal(result.status,200);const output=await result.text();assert.ok(!output.includes('private'));assert.equal(mail.length,1);assert.equal(finished.at(-1).sent,true);
const token=/#teacher-invite=[0-9a-f-]+\.([0-9a-f]{64})/.exec(mail[0].text)[1];assert.equal(reserved[0].hash,createHash('sha256').update(token).digest('hex'));assert.ok(!JSON.stringify(reserved).includes(token));assert.match(mail[0].html,/Accept invitation/);assert.match(mail[0].text,/Opening this link alone does not grant/);
await handler(request({action:'resend',email:'teacher@gmail.com'}));assert.match(mail.at(-1).text,/#teacher-invite=existing-id\./);
fail=true;const failed=await handler(request({action:'send',email:'teacher@gmail.com'}));assert.equal(failed.status,502);assert.equal(finished.at(-1).sent,false);assert.ok(!(await failed.text()).includes('private SMTP'));fail=false;
quota=true;assert.equal((await handler(request({action:'send',email:'teacher@gmail.com'}))).status,400);assert.equal(mail.length,2);
assert.equal((await handler(request({action:'send',email:'x@gmail.com\r\nBcc: victim@example.com'}))).status,400);
assert.equal((await handler(request({action:'send',padding:'x'.repeat(5000)}))).status,413);
assert.equal((await handler(request({action:'status'},{Origin:'https://other.example'}))).status,403);
assert.ok(!invitationMail('teacher@gmail.com','id','token','operator@gmail.com').html.includes('<script'));
console.log('Invitation email endpoint verified: authenticated admin gate, private Gmail configuration, no sending while paused, fixed branded template, secret token hashing, resend rotation, delivery failures, quota errors, CORS, and bounded requests. No real emails were sent.');
