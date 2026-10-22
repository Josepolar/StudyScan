export const site='https://studyscan-green.vercel.app';
const allowed=new Set([site,'http://127.0.0.1:5192','http://127.0.0.1:5173','http://localhost:5173']);
export function configuration(env){const gmail=env('TEACHER_MAIL_GMAIL')||'';const password=(env('TEACHER_MAIL_APP_PASSWORD')||'').replace(/\s/g,'');return {gmail,password,configured:/^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(gmail)&&password.length>=16,enabled:env('TEACHER_MAIL_ENABLED')==='true'};}
export function invitationMail(email,id,token,from){
 const link=`${site}/#teacher-invite=${id}.${token}`;
 return {from:{name:'StudyScan',address:from},to:email,subject:'You are invited to teach on StudyScan',
 text:`Your school administrator has invited you to become a Teacher on StudyScan.\n\nAccept invitation: ${link}\n\nSign in with the same Google account that received this email, then choose Accept invitation. Opening this link alone does not grant Teacher access. The invitation expires in 7 days.\n\nStudyScan is an independent school learning application, not a Google product. Enter your Google password only on accounts.google.com. If you did not expect this invitation, ignore it or contact your school.`,
 html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;line-height:1.7;color:#172b46"><h1>You're invited to StudyScan</h1><p>Your school administrator has invited you to become a Teacher.</p><p><a href="${link}" style="display:inline-block;background:#2451aa;color:white;padding:12px 20px;border-radius:6px;text-decoration:none">Accept invitation</a></p><p>Sign in with the same Google account that received this email, then confirm acceptance. Opening this link alone does not grant access. This invitation expires in 7 days.</p><p>StudyScan is an independent school learning application, not a Google product. Enter your Google password only on accounts.google.com.</p><p>If you did not expect this invitation, ignore it or contact your school.</p></div>`};
}
export function createHandler({env,fetch:network,sendMail}){
 const base=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');
 async function rest(path,token,body){const r=await network(base+path,{method:body===undefined?'GET':'POST',headers:{apikey:token===service?service:anon,Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});const raw=await r.text();const data=raw?JSON.parse(raw):null;if(!r.ok)throw Error(data?.message||'Your account could not be verified.');return data;}
 return async req=>{
  const origin=req.headers.get('Origin');const headers={'Access-Control-Allow-Origin':allowed.has(origin)?origin:site,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store',Vary:'Origin'};
  const reply=(data,status=200)=>Response.json(data,{status,headers});
  if(origin&&!allowed.has(origin))return reply({error:'This site is not allowed.'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply({error:'Use POST.'},405);
  let pending=null,actorId=null;
  const delivery=(operation,payload)=>rest('/rest/v1/rpc/studyscan_teacher_invite_delivery',service,{actor_id:actorId,operation,payload});
  try{
   const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token)return reply({error:'Sign in first.'},401);
   const user=await rest('/auth/v1/user',token);if(!user?.id||!user.email_confirmed_at)return reply({error:'A verified account is required.'},401);actorId=user.id;
   const rawProfile=await rest('/rest/v1/rpc/studyscan_actor',token,{});const profile=Array.isArray(rawProfile)?rawProfile[0]:rawProfile;
   if(profile?.role!=='super-admin'||profile.status!=='active')return reply({error:'Super Admin access required.'},403);
   const reader=req.body?.getReader();let raw='',size=0;const decoder=new TextDecoder();if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return reply({error:'The request is too large.'},413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}finally{reader.releaseLock();}
   const body=JSON.parse(raw||'{}'),config=configuration(env);
   if(body.action==='status')return reply({configured:config.configured,enabled:config.enabled,ready:config.configured&&config.enabled});
   if(!['send','resend'].includes(body.action))return reply({error:'Unknown invitation action.'},400);
   if(!config.configured||!config.enabled)return reply({error:'Invitation email is not configured or is paused. Ask the operator to complete Gmail setup.'},503);
   const email=String(body.email||'').trim().toLowerCase();if(email.length>254||!(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/).test(email))return reply({error:'Enter a valid Google account email.'},400);
   const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret))),b=>b.toString(16).padStart(2,'0')).join('');
   const invitation=await delivery('reserve',{id:crypto.randomUUID(),email,hash,resend:body.action==='resend'});pending={id:invitation.id,hash};
   await sendMail(invitationMail(email,invitation.id,secret,config.gmail),config);
   await delivery('finish',{...pending,sent:true});pending=null;
   return reply({ok:true,message:'Invitation accepted by Gmail for delivery. Teacher access stays pending until acceptance.'});
  }catch(error){
   if(pending){try{await delivery('finish',{...pending,sent:false});}catch{}return reply({error:'The invitation email could not be confirmed. No Teacher access was granted. Check Gmail setup and resend.'},502);}
   const message=error instanceof Error?error.message:'';
   const safe=/^(Super Admin access required|Enter a valid Google account email|This account already has staff access or is suspended|A pending invitation already exists|Wait one minute before resending|Hourly invitation limit reached|School invitation limit reached)/.test(message);
   return reply({error:safe?message:'The invitation request could not be completed. Try again or contact the operator.'},400);
  }
 };
}
