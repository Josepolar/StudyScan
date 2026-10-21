import { sampleLessons } from '../lib/seed';
import { availability, blockedTopic, passages } from '../lib/learning';
import { defaultPolicy, type State, type Lesson, type Assignment, type Account, type SchoolPolicy, type AuditEntry } from '../lib/types';

// Isolated browser demonstration. Never imported by the authenticated server.
let key = 'studyscan-demo-v1';
let sessionIdentity:Account|null=null;
const roleKey = 'studyscan-demo-role';
type Store = Omit<State, 'user'> & { attachments: Record<string, string>; accounts:Account[]; policy:SchoolPolicy; audit:AuditEntry[] };
const adminUser = { id:'demo-admin', name:'School Administrator', email:'admin@example.test', role:'super-admin' as const };
const teacher = { id: 'demo-teacher', name: 'Alex Reyes', email: 'teacher@example.test', role: 'teacher' };
const student = { id: 'demo-student', name: 'Jamie Santos', email: 'student@example.test', role: 'student' };
function initial(): Store {
  const lessons = sampleLessons('demo-class');
  const initialStudents=[{...student,classroom:'demo-class'},...(sessionIdentity?[{...sessionIdentity,classroom:'demo-class'}]:[])];
  return { lessons, classes: [{ id: 'demo-class', name: 'Grade 9 · Einstein', code: 'DEMO2026' }], students: initialStudents, assignments: [{ id: 'demo-activity', lesson: lessons[0].id, title: 'Force & Motion Reflection', instructions: 'Describe a real-life example of each of Newton’s laws.', due: '', aiEnabled: true }], interactions: [], progress: [], files: [], attachments: {}, accounts:[{...adminUser,status:'active'},{...teacher,role:'teacher',status:'active'},{...student,role:'student',status:'active'},{id:'demo-new-account',name:'Morgan Cruz',email:'morgan@example.test',role:'student',status:'active'}],policy:{name:'StudyScan School',aiEnabled:true,blockedTopics:''},audit:[], aiReady: false, model: 'Source excerpts · demo' };
}
function read(): Store { const raw = localStorage.getItem(key); if (!raw) { const value = initial(); save(value); return value; } const stored=JSON.parse(raw);if(!stored.accounts){const defaults=initial();Object.assign(stored,{accounts:defaults.accounts,policy:defaults.policy,audit:[]});save(stored);}return stored; }
function save(store: Store) { localStorage.setItem(key, JSON.stringify(store)); }
function user() { if(sessionIdentity)return sessionIdentity;const role=localStorage.getItem(roleKey);const id=role==='super-admin'?adminUser.id:role==='student'?student.id:teacher.id;return read().accounts.find(a=>a.id===id)!; }
function visible(store: Store) { const current=user();if(current.role==='super-admin')return [];return store.lessons.filter(l => current.role === 'teacher' || l.published && (l.studentIds.includes(current.id) || l.classIds.some(c => store.students.some(s => s.id === current.id && s.classroom === c)))); }
function lessonFor(store: Store, id: string) { const lesson = visible(store).find(l => l.id === id); if (!lesson) throw Error('Lesson not found or not assigned to you.'); return lesson; }
function requireTeacher() { if (user().role !== 'teacher') throw Error('Only teachers can make this change.'); }
function requireAdmin() { if(user().role!=='super-admin')throw Error('Super Admin access required.'); }
export async function demoRequest(url: URL, init: RequestInit = {}): Promise<Response> {
  try {
    const store = read();
    if(user().status==='suspended')return Response.json({error:'Your account is suspended. Contact your school administrator.'},{status:403});
    if (url.pathname === '/api/files') {
      if (init.method === 'POST') {
        requireTeacher(); const form = init.body as FormData; const lesson = lessonFor(store, String(form.get('lesson'))); const file = form.get('file');
        if (!(file instanceof File) || file.size > 1000000) throw Error('Demo attachments must be smaller than 1 MB.');
        if (!/\.(pdf|txt|md|pptx|docx)$/i.test(file.name)) throw Error('Choose a PDF, TXT, Markdown, PowerPoint, or Word file.');
        const id = crypto.randomUUID(); const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ''; for (const b of bytes) binary += String.fromCharCode(b);
        store.attachments[id] = btoa(binary); store.files.push({ id, lesson: lesson.id, name: file.name, size: file.size }); save(store); return Response.json({ ok: true });
      }
      const id = url.searchParams.get('id') || ''; const file = store.files.find(f => f.id === id); if (!file) throw Error('Attachment not found.'); lessonFor(store, file.lesson);
      return new Response(Uint8Array.from(atob(store.attachments[id]), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'application/octet-stream' } });
    }
    if (init.method !== 'POST') {
      if(user().role==='super-admin')return Response.json({user:user(),lessons:[],classes:[],students:[],assignments:[],interactions:[],progress:[],files:[],aiReady:false,model:store.model,admin:{accounts:store.accounts,policy:store.policy,audit:store.audit,protectedAccount:adminUser.id,totals:{lessons:store.lessons.length,classes:store.classes.length,questions:store.interactions.length,flagged:store.interactions.filter(i=>i.flagged&&!i.resolved).length}}});
      const lessons = visible(store); const ids = new Set(lessons.map(l => l.id)); const { attachments: _, accounts: _accounts, policy: _policy, audit: _audit, ...state } = store;
      return Response.json({ ...state, user: user(), lessons,students:user().role==='teacher'?store.students:[],classes:user().role==='teacher'?store.classes:store.classes.filter(c=>store.students.some(s=>s.id===user().id&&s.classroom===c.id)), assignments: store.assignments.filter(a => ids.has(a.lesson)), files: store.files.filter(f => ids.has(f.lesson)), interactions: store.interactions.filter(i => user().role === 'teacher' || i.student === user().id) });
    }
    const b = JSON.parse(String(init.body)); let result: object = { ok: true };
    const administrative=['setRole','setAccountStatus','schoolSettings','inviteTeacher'].includes(b.action);if(administrative)requireAdmin();
    switch (b.action) {
      case 'setRole': case 'setAccountStatus': { const account=store.accounts.find(a=>a.id===b.id);if(!account)throw Error('Account not found.');if(account.id===adminUser.id||account.id===user().id)throw Error('Your own account and the primary administrator are protected.');if(b.action==='setRole'){if(!['super-admin','teacher','student'].includes(b.role))throw Error('Choose a valid role.');account.role=b.role;}else{if(!['active','suspended'].includes(b.status))throw Error('Choose a valid status.');account.status=b.status;}break; }
      case 'schoolSettings': { const name=String(b.name||'').trim().slice(0,100);if(!name)throw Error('Enter the school name.');store.policy={name,aiEnabled:b.aiEnabled===true,blockedTopics:String(b.blockedTopics||'').trim().slice(0,2000)};break; }
      case 'seed': requireTeacher(); if (store.lessons.length) throw Error('The demo already includes sample lessons.'); Object.assign(store, initial()); break;
      case 'class': requireTeacher(); if (!String(b.name || '').trim()) throw Error('Enter a class name.'); store.classes.push({ id: crypto.randomUUID(), name: String(b.name).slice(0, 100), code: crypto.randomUUID().slice(0, 8).toUpperCase() }); break;
      case 'join': { if(user().role!=='student')throw Error('Class codes are for students.');const c = store.classes.find(c => c.code === String(b.code).trim().toUpperCase()); if (!c) throw Error('That class code was not found.'); if (!store.students.some(s => s.id === user().id && s.classroom === c.id)) store.students.push({ ...user(), classroom: c.id }); break; }
      case 'inviteTeacher': {const email=String(b.email||'').trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw Error('Enter a valid email.');const account=store.accounts.find(a=>a.email===email);if(account?.role==='super-admin')throw Error('That account is already a Super Admin.');if(account)account.role='teacher';else store.accounts.push({id:crypto.randomUUID(),name:email.split('@')[0],email,role:'teacher',status:'active'});break;}
      case 'lesson': { requireTeacher(); const l = b.lesson as Lesson; if (!l.title?.trim() || !l.content?.trim()) throw Error('Enter a title and lesson text.'); const id = l.id || crypto.randomUUID(); const value = { ...l, id, policy: { ...defaultPolicy, ...l.policy }, updated: new Date().toISOString() }; store.lessons = store.lessons.filter(l => l.id !== id).concat(value); result = { ok: true, id }; break; }
      case 'deleteLesson': { requireTeacher(); lessonFor(store, b.id); store.lessons = store.lessons.filter(l => l.id !== b.id); store.assignments = store.assignments.filter(a => a.lesson !== b.id); store.interactions = store.interactions.filter(i => i.lesson !== b.id); store.progress = store.progress.filter(p => p.lesson !== b.id); for (const f of store.files.filter(f => f.lesson === b.id)) delete store.attachments[f.id]; store.files = store.files.filter(f => f.lesson !== b.id); break; }
      case 'assignment': { requireTeacher(); const a = b.assignment as Assignment; lessonFor(store, a.lesson); if (!a.title?.trim()) throw Error('Enter an activity title.'); const id = a.id || crypto.randomUUID(); store.assignments = store.assignments.filter(a => a.id !== id).concat({ ...a, id }); break; }
      case 'deleteAssignment': requireTeacher(); store.assignments = store.assignments.filter(a => a.id !== b.id); break;
      case 'progress': lessonFor(store, b.lesson); store.progress = store.progress.filter(p => p.lesson !== b.lesson).concat({ lesson: b.lesson, completed: b.completed ? 1 : 0 }); break;
      case 'flag': { const i = store.interactions.find(i => i.id === b.id); if (!i) throw Error('Question not found.'); i.flagged = 1; i.resolved = 0; break; }
      case 'review': { requireTeacher(); const i = store.interactions.find(i => i.id === b.id); if (!i) throw Error('Question not found.'); i.note = String(b.note || '').slice(0, 4000); i.resolved = b.resolved ? 1 : 0; break; }
      case 'ask': {
        const l = lessonFor(store, b.lesson); const question = String(b.question || '').trim().slice(0, 2000); if (!question) throw Error('Enter a question.');
        const a = b.assignment ? store.assignments.find(a => a.id === b.assignment && a.lesson === l.id) : undefined; if (b.assignment && !a) throw Error('Choose an activity from this lesson.');
        const restriction = (!store.policy.aiEnabled?'Your school administrator has paused assistance.':null) || (blockedTopic({...l.policy,blockedTopics:store.policy.blockedTopics},question)?'Your school administrator has restricted this topic.':null) || availability(l.policy) || (a && !a.aiEnabled ? 'Your teacher has disabled assistance for this activity.' : null) || (blockedTopic(l.policy, question) ? 'Your teacher has restricted assistance on this topic.' : null);
        const previous = store.interactions.filter(i => i.lesson === l.id && i.student===user().id).slice(0, 4).map(i => i.question).join(' ');
        const query = /^(why|how so|what about|can you|could you|explain (it|that)|i (still|don.t)|give (me )?an example)/i.test(question) ? question + ' ' + previous : question;
        const sources = restriction ? [] : passages(l, query).map(({ label, text }) => ({ label, text }));
        const status = restriction ? 'restricted' : sources.length ? 'reference' : 'out-of-scope';
        const answer = restriction || (sources.length ? 'Demo reference mode: these excerpts come directly from your teacher’s material. Live AI is not connected on this hosted demo.\n\n' + sources.slice(0, 2).map(s => s.text).join('\n\n') : 'I could not find supporting material in this lesson. Try naming the concept, or flag your question for your teacher.');
        const id = crypto.randomUUID(); store.interactions.unshift({ id, student: user().id, studentName: user().name, lesson: l.id, assignment: a?.id || null, question, answer, sources, status, flagged: 0, resolved: 0, note: '', created: new Date().toISOString() }); result = { ok: true, id, answer, sources, status }; break;
      }
      default: throw Error('Unknown demo action.');
    }
    if(administrative){const account=store.accounts.find(a=>a.id===b.id);store.audit.unshift({id:crypto.randomUUID(),actor:user().id,action:b.action,target:account?`${account.email} → ${b.role||b.status}`:b.email||'school',created:new Date().toISOString()});store.audit=store.audit.slice(0,100);}save(store); return Response.json(result);
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'The demo could not save this change.' }, { status: 400 }); }
}
type WorkspaceOptions={identity?:Account;cloudAdmin?:{state:()=>Promise<{accounts:Account[];audit:AuditEntry[];protectedAccount:string}>;action:(body:Record<string,unknown>)=>Promise<Response>};signOut?:()=>Promise<void>};
export function installDemo(options:WorkspaceOptions={}) {
  sessionIdentity=options.identity||null;key=sessionIdentity?`studyscan-preview-${sessionIdentity.id}`:'studyscan-demo-v1';
  const home=sessionIdentity?'/':'/?demo=1';
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => { const url = new URL(input instanceof Request ? input.url : String(input), location.origin); if (url.origin === location.origin && ['/api/study', '/api/files'].includes(url.pathname)) {try{if(url.pathname==='/api/study'&&options.cloudAdmin){if(init?.method==='POST'){const body=JSON.parse(String(init.body));if(['setRole','setAccountStatus','inviteTeacher'].includes(body.action))return options.cloudAdmin.action(body);}else{const response=await demoRequest(url,init);const state=await response.json() as State;if(state.admin){const cloud=await options.cloudAdmin.state();state.admin={...state.admin,...cloud};}return Response.json(state,{status:response.status});}}return demoRequest(url, init);}catch(error){return Response.json({error:error instanceof Error?error.message:'The request could not be completed.'},{status:400});}}return nativeFetch(input, init); };
  const controls = document.getElementById('demo-controls')!;
  controls.replaceChildren();
  const note = document.createElement('span'); note.textContent = sessionIdentity?`Signed in: ${sessionIdentity.email} · ${sessionIdentity.role} · Classroom data/settings are sample-only in this browser; no live AI`:'PUBLIC DEMO · Sample identities · Browser-saved data · No live AI'; controls.appendChild(note);
  if(!sessionIdentity)for (const role of ['super-admin', 'teacher', 'student']) { const button = document.createElement('button'); button.textContent = `${role === user().role ? '✓ ' : ''}${role==='super-admin'?'Super Admin':role[0].toUpperCase() + role.slice(1)}`; button.onclick = () => { localStorage.setItem(roleKey, role); location.href = home; }; controls.appendChild(button); }
  const reset = document.createElement('button'); reset.textContent = 'Reset sample data'; reset.onclick = () => { if (confirm('Reset the sample lessons and questions in this browser? Your login account will be preserved.')) { localStorage.removeItem(key); location.href = home; } }; controls.appendChild(reset);
  const signOut=async()=>{try{if(options.signOut)await options.signOut();else{localStorage.setItem(roleKey,'student');location.href='/';}}catch{alert('Sign-out could not finish. Please try again.');}};
  const accountButton=document.createElement('button');accountButton.textContent=sessionIdentity?'Sign out':'Sign in';accountButton.onclick=()=>{if(sessionIdentity)void signOut();else location.href='/';};controls.appendChild(accountButton);
  const barObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>document.documentElement.style.setProperty('--session-bar-height',`${controls.offsetHeight}px`)):null;
  barObserver?.observe(controls);
  const click=async(event:MouseEvent)=>{ const link = (event.target as Element).closest('a'); if (!link) return; const url = new URL(link.href); if(url.origin!==location.origin)return;if (url.pathname === '/signout-with-chatgpt') { event.preventDefault();await signOut();return; } if(url.pathname==='/'&&options.identity===undefined&&!url.search){event.preventDefault();location.href=home;return;}if (url.pathname === '/api/files') { event.preventDefault(); const response = await demoRequest(url); if (!response.ok) { alert(((await response.json()) as { error: string }).error); return; } const id = url.searchParams.get('id'); const blob = URL.createObjectURL(await response.blob()); const download = document.createElement('a'); download.href = blob; download.download = read().files.find(f => f.id === id)?.name || 'resource'; download.click(); setTimeout(() => URL.revokeObjectURL(blob), 1000); } };
  document.addEventListener('click',click);
  return()=>{barObserver?.disconnect();if(barObserver)document.documentElement.style.removeProperty('--session-bar-height');window.fetch=nativeFetch;document.removeEventListener('click',click);controls.replaceChildren();controls.removeAttribute('style');sessionIdentity=null;key='studyscan-demo-v1';};
}

