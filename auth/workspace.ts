import {authClient,authConfig,type CloudProfile} from './client';
import type {State} from '../lib/types';
import {validateSubmissionFile} from '../lib/submission-files.mjs';
const bucket='studyscan-resources';
async function rpc(name:string,args:Record<string,unknown>={}){if(!authClient)throw Error('Sign in first.');const {data,error}=await authClient.rpc(name,args);if(error)throw Error(error.message);return data;}
async function edge(body:Record<string,unknown>|FormData,endpoint='study-assistant'){if(!authClient||!authConfig)throw Error('Sign in first.');const {data:{session}}=await authClient.auth.getSession();if(!session)throw Error('Your session expired. Sign in again.');const response=await fetch(`${authConfig.url}/functions/v1/${endpoint}`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:authConfig.key,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:JSON.stringify(body)});const data=await response.json() as {error?:string;message?:string;configured?:boolean;enabled?:boolean;ready:boolean;model:string;id?:string;text?:string};if(!response.ok)throw Error(data.error||'The assistant is temporarily unavailable.');return data;}
let assistant:{ready:boolean;model:string}|null=null;let assistantChecked=0;
export async function workspaceState():Promise<State>{const data=await rpc('studyscan_workspace') as State;if(!assistant||Date.now()-assistantChecked>60000)try{assistant=await edge({action:'status'});assistantChecked=Date.now();}catch{assistant={ready:false,model:''};assistantChecked=Date.now();}if(data.admin){data.admin.invitations=await rpc('studyscan_teacher_invitation',{action:'list'});try{data.admin.invitationMailReady=(await edge({action:'status'},'teacher-invitations')).ready===true;}catch{data.admin.invitationMailReady=false;}}return {...data,providerReady:assistant?.ready===true,aiReady:assistant?.ready===true&&data.school?.aiEnabled===true,model:assistant?.model||''};}
export async function workspaceAction(body:Record<string,unknown>){if(body.action==='sendTeacherInvite'||body.action==='resendTeacherInvite')return edge({action:body.action==='sendTeacherInvite'?'send':'resend',email:body.email},'teacher-invitations');if(body.action==='revokeTeacherInvite')return rpc('studyscan_teacher_invitation',{action:'revoke',payload:{id:body.id}});if(body.action==='readLesson')return rpc('studyscan_read_lesson',{target:body.id});if(body.action==='refresh'){assistant=null;return {ok:true};}if(body.action==='ask'||body.action==='extract')return edge(body);if(body.action==='removeFile'||body.action==='deleteLesson'){const state=await workspaceState();if(state.user.role!=='teacher')throw Error('Teacher access required.');const files=state.files.filter(f=>body.action==='deleteLesson'?f.lesson===body.id:f.id===body.id) as (State['files'][number]&{path:string})[];if(files.length){const result=await authClient!.storage.from(bucket).remove(files.map(f=>f.path));if(result.error)throw Error('The resources could not be removed. Please try again.');}}return rpc('studyscan_mutate',{action:body.action,payload:body});}
export async function extractResource(id:string){return edge({action:'extract',id});}
async function uploadResource(form:FormData){if(form.get('action')==='extractDraft')return edge(form);if(!authClient)throw Error('Sign in first.');const lesson=String(form.get('lesson'));const file=form.get('file');if(!(file instanceof File)||!file.size||file.size>10000000)throw Error('Choose a file smaller than 10 MB.');const ext=file.name.split('.').pop()?.toLowerCase();const mime:Record<string,string>={pdf:'application/pdf',txt:'text/plain',md:'text/markdown',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};if(!ext||!mime[ext])throw Error('Choose a PDF, Word, PowerPoint, TXT, or Markdown file.');const {data:{user}}=await authClient.auth.getUser();if(!user)throw Error('Sign in first.');const id=crypto.randomUUID();const path=`${user.id}/${lesson}/${id}.${ext}`;const result=await authClient.storage.from(bucket).upload(path,file,{contentType:mime[ext],upsert:false});if(result.error)throw Error('The resource could not be uploaded. Check your connection and try again.');try{await workspaceAction({action:'registerFile',lesson,fileId:id,name:file.name,size:file.size,path});}catch(error){await authClient.storage.from(bucket).remove([path]);throw error;}return {ok:true,id};}
async function uploadActivity(form:FormData){
 if(!authClient)throw Error('Sign in first.');const assignment=String(form.get('assignment')||'');const file=form.get('file');
 const state=await workspaceState();const activity=state.assignments.find(item=>item.id===assignment);
 if(state.user.role!=='student'||activity?.submissionType!=='file')throw Error('This activity does not accept file submissions.');
 if(!(file instanceof File))throw Error('Choose a submission file.');
 const {extension,type}=await validateSubmissionFile(file,activity.fileTypes);
 const path=state.user.id+'/'+assignment+'/'+crypto.randomUUID()+'.'+extension;
 const result=await authClient.storage.from('studyscan-submissions').upload(path,file,{contentType:type,upsert:false});
 if(result.error)throw Error('File upload failed. Check your connection and the teacher’s allowed formats.');
 try{await workspaceAction({action:'submit',assignment,body:String(form.get('body')||''),file:{path,name:file.name.slice(0,180),size:file.size,type}});}
 catch(error){await authClient.storage.from('studyscan-submissions').remove([path]);throw error;}
 const old=state.submissions?.find(item=>item.assignment===assignment&&item.student===state.user.id)?.filePath;
 if(old&&old!==path)await authClient.storage.from('studyscan-submissions').remove([old]);
 return {ok:true};
}
export function installWorkspace(profile:CloudProfile,signOut:()=>Promise<void>){
 assistant=null;const nativeFetch=window.fetch.bind(window);const controls=document.getElementById('demo-controls');controls?.replaceChildren();controls?.removeAttribute('style');
 window.fetch=async(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input),location.origin);if(url.origin!==location.origin||!['/api/study','/api/files','/api/activity-files'].includes(url.pathname))return nativeFetch(input,init);try{
 if(url.pathname==='/api/activity-files'){
 if(init?.method==='POST')return Response.json(await uploadActivity(init.body as FormData));
 const state=await workspaceState();const submission=state.submissions?.find(item=>item.id===url.searchParams.get('submission'));
 if(!submission?.filePath)throw Error('Submission file not found or access removed.');
 const result=await authClient!.storage.from('studyscan-submissions').download(submission.filePath);if(result.error)throw Error('The submission file could not be downloaded.');
 return new Response(result.data,{headers:{'Content-Type':'application/octet-stream','X-Content-Type-Options':'nosniff'}});
 }
 if(url.pathname==='/api/study'){
if(init?.method==='POST')return Response.json(await workspaceAction(JSON.parse(String(init.body))));return Response.json(await workspaceState());}
 if(init?.method==='POST')return Response.json(await uploadResource(init.body as FormData));
 const data=await workspaceState();const file=data.files.find(f=>f.id===url.searchParams.get('id')) as State['files'][number]&{path:string};if(!file)throw Error('Resource not found or no longer assigned.');const result=await authClient!.storage.from(bucket).download(file.path);if(result.error)throw Error('This resource could not be downloaded.');return new Response(result.data);
 }catch(error){return Response.json({error:error instanceof Error?error.message:'The request could not be completed.'},{status:400});}};
 const click=async(event:MouseEvent)=>{const link=(event.target as Element).closest('a');if(!link)return;const url=new URL(link.href);if(url.origin!==location.origin)return;if(url.pathname==='/signout-with-chatgpt'){event.preventDefault();await signOut();}else if((url.pathname==='/api/files'||url.pathname==='/api/activity-files')){event.preventDefault();try{const response=await window.fetch(link.href);if(!response.ok)throw Error(((await response.json()) as {error:string}).error);const blob=URL.createObjectURL(await response.blob());const anchor=document.createElement('a');anchor.href=blob;anchor.download=link.getAttribute('download')||'Learning resource';anchor.click();setTimeout(()=>URL.revokeObjectURL(blob),1000);}catch(error){alert(error instanceof Error?error.message:'Download failed.');}}};
 document.addEventListener('click',click);return()=>{window.fetch=nativeFetch;document.removeEventListener('click',click);assistant=null;};
}
