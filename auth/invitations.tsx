import {useEffect,useState} from 'react';
import {authClient,type CloudProfile} from './client';
const storageKey='studyscan.teacherInvitation';
export function invitationParts(value:string){const match=/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9a-f]{64})$/i.exec(value);return match?{id:match[1],token:match[2]}:null;}
export function pendingInvitation(){
 const fragment=new URLSearchParams(location.hash.slice(1));const incoming=fragment.get('teacher-invite');
 try{if(incoming){if(invitationParts(incoming))sessionStorage.setItem(storageKey,incoming);else sessionStorage.removeItem(storageKey);history.replaceState(null,'',location.pathname+location.search);}return sessionStorage.getItem(storageKey)||'';}catch{return '';}
}
export function clearInvitation(){try{sessionStorage.removeItem(storageKey);}catch{}}
type AccountInvitation={id:string;email:string;expires:string};
export function AccountInvitationNotice({profile}:{profile:CloudProfile}){
 const [invitation,setInvitation]=useState<AccountInvitation|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[expanded,setExpanded]=useState(false);
 useEffect(()=>{
  if(profile.role!=='student'||!authClient)return;
  let active=true,version=0;
  async function refresh(){const current=++version;const {data,error}=await authClient!.rpc('studyscan_account_invitation',{action:'pending'});if(active&&current===version){if(error)setError('Teacher invitations could not be checked. Refresh to try again.');else{setInvitation(data as AccountInvitation|null);setError('');}}}
  void refresh();const timer=setInterval(()=>void refresh(),60000);window.addEventListener('focus',refresh);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[profile.id,profile.role]);
 if(!invitation)return error?<p className="auth-error" role="status">{error}</p>:null;
 return <aside className="account-invitation" aria-label="Teacher invitation"><div><strong>Your school has invited you to teach</strong><p>Invitation for {invitation.email}. Expires {new Date(invitation.expires).toLocaleDateString()}.</p>{expanded&&<p>Accepting lets you create classes, share learning materials, and review work in your classes. It does not grant administrator access. Your account stays a Student until you accept.</p>}{error&&<p role="alert">{error}</p>}</div><div className="inline">{expanded?<><button className="button primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const {error}=await authClient!.rpc('studyscan_account_invitation',{action:'accept',invitation_id:invitation.id});if(error)throw error;location.reload();}catch(e){setError(e instanceof Error?e.message:'The invitation could not be accepted.');setBusy(false);}}}>{busy?'Accepting…':'Accept teacher invitation'}</button><button className="button" disabled={busy} onClick={()=>setExpanded(false)}>Not now</button></>:<button className="button primary" onClick={()=>setExpanded(true)}>Review invitation</button>}</div></aside>;
}
export function InvitationAcceptance({profile,value}:{profile:CloudProfile;value:string}){
 const [error,setError]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 async function call(action:string){const parts=invitationParts(value);if(!parts||!authClient)throw Error('This invitation is invalid. Ask your administrator for a new one.');const {data,error}=await authClient.rpc('studyscan_teacher_invitation',{action,payload:parts});if(error)throw Error(error.message);return data as {accepted:boolean;email:string};}
 useEffect(()=>{let active=true;void call('inspect').then(data=>{if(!active)return;if(data.accepted){clearInvitation();location.reload();}else setReady(true);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'This invitation could not be checked.');});return()=>{active=false;};},[value,profile.id]);
 return <main className="invitation-page"><section className="panel admin-panel"><a href="/">StudyScan</a><div className="eyebrow">TEACHER INVITATION</div><h1>Join your school as a teacher</h1><p>Signed in as <strong>{profile.email}</strong>.</p><p>Accepting gives you access to create classes, assign learning material, and review work in your classes. It does not grant school administrator access.</p>{error&&<p className="auth-error" role="alert">{error}</p>}{!ready&&!error&&<p role="status">Checking your invitation…</p>}<div className="inline">{ready&&<button className="button primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await call('accept');clearInvitation();location.reload();}catch(e){setError(e instanceof Error?e.message:'The invitation could not be accepted.');setBusy(false);}}}>{busy?'Accepting…':'Accept invitation'}</button>}<button className="button" disabled={busy} onClick={()=>{clearInvitation();location.reload();}}>Not now</button><button className="button" disabled={busy} onClick={async()=>{setError('');try{const result=await authClient!.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin,queryParams:{prompt:'select_account'}}});if(result.error)throw result.error;}catch{setError('Google sign-in could not start. Try again.');}}}>Use the invited Google account</button></div><p className="muted">This invitation expires after 7 days. Ask your school administrator for a replacement if it has expired or been revoked.</p></section></main>;
}
