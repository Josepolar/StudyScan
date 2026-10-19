import { sampleLessons } from '../lib/seed';
import { availability, blockedTopic, passages } from '../lib/learning';
import { defaultPolicy, type State, type Lesson, type Assignment } from '../lib/types';

// Isolated browser demonstration. Never imported by the authenticated server.
const key = 'studyscan-demo-v1';
const roleKey = 'studyscan-demo-role';
type Store = Omit<State, 'user'> & { attachments: Record<string, string> };
const teacher = { id: 'demo-teacher', name: 'Alex Reyes', email: 'teacher@example.test', role: 'teacher' };
const student = { id: 'demo-student', name: 'Jamie Santos', email: 'student@example.test', role: 'student' };
function initial(): Store {
  const lessons = sampleLessons('demo-class');
  return { lessons, classes: [{ id: 'demo-class', name: 'Grade 9 · Einstein', code: 'DEMO2026' }], students: [{ ...student, classroom: 'demo-class' }], assignments: [{ id: 'demo-activity', lesson: lessons[0].id, title: 'Force & Motion Reflection', instructions: 'Describe a real-life example of each of Newton’s laws.', due: '', aiEnabled: true }], interactions: [], progress: [], files: [], attachments: {}, aiReady: false, model: 'Source excerpts · demo' };
}
function read(): Store { const raw = localStorage.getItem(key); if (!raw) { const value = initial(); save(value); return value; } return JSON.parse(raw); }
function save(store: Store) { localStorage.setItem(key, JSON.stringify(store)); }
function user() { return localStorage.getItem(roleKey) === 'student' ? student : teacher; }
function visible(store: Store) { return store.lessons.filter(l => user().role === 'teacher' || l.published && (l.studentIds.includes(student.id) || l.classIds.some(c => store.students.some(s => s.id === student.id && s.classroom === c)))); }
function lessonFor(store: Store, id: string) { const lesson = visible(store).find(l => l.id === id); if (!lesson) throw Error('Lesson not found or not assigned to you.'); return lesson; }
function requireTeacher() { if (user().role !== 'teacher') throw Error('Only teachers can make this change.'); }
export async function demoRequest(url: URL, init: RequestInit = {}): Promise<Response> {
  try {
    const store = read();
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
      const lessons = visible(store); const ids = new Set(lessons.map(l => l.id)); const { attachments: _, ...state } = store;
      return Response.json({ ...state, user: user(), lessons, assignments: store.assignments.filter(a => ids.has(a.lesson)), files: store.files.filter(f => ids.has(f.lesson)), interactions: store.interactions.filter(i => user().role === 'teacher' || i.student === student.id) });
    }
    const b = JSON.parse(String(init.body)); let result: object = { ok: true };
    switch (b.action) {
      case 'seed': requireTeacher(); if (store.lessons.length) throw Error('The demo already includes sample lessons.'); Object.assign(store, initial()); break;
      case 'class': requireTeacher(); if (!String(b.name || '').trim()) throw Error('Enter a class name.'); store.classes.push({ id: crypto.randomUUID(), name: String(b.name).slice(0, 100), code: crypto.randomUUID().slice(0, 8).toUpperCase() }); break;
      case 'join': { const c = store.classes.find(c => c.code === String(b.code).trim().toUpperCase()); if (!c) throw Error('That class code was not found.'); if (!store.students.some(s => s.id === student.id && s.classroom === c.id)) store.students.push({ ...student, classroom: c.id }); break; }
      case 'inviteTeacher': requireTeacher(); throw Error('Real account invitations are unavailable in this browser demo.');
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
        const restriction = availability(l.policy) || (a && !a.aiEnabled ? 'Your teacher has disabled assistance for this activity.' : null) || (blockedTopic(l.policy, question) ? 'Your teacher has restricted assistance on this topic.' : null);
        const previous = store.interactions.filter(i => i.lesson === l.id).slice(0, 4).map(i => i.question).join(' ');
        const query = /^(why|how so|what about|can you|could you|explain (it|that)|i (still|don.t)|give (me )?an example)/i.test(question) ? question + ' ' + previous : question;
        const sources = restriction ? [] : passages(l, query).map(({ label, text }) => ({ label, text }));
        const status = restriction ? 'restricted' : sources.length ? 'reference' : 'out-of-scope';
        const answer = restriction || (sources.length ? 'Demo reference mode: these excerpts come directly from your teacher’s material. Live AI is not connected on this hosted demo.\n\n' + sources.slice(0, 2).map(s => s.text).join('\n\n') : 'I could not find supporting material in this lesson. Try naming the concept, or flag your question for your teacher.');
        const id = crypto.randomUUID(); store.interactions.unshift({ id, student: student.id, studentName: student.name, lesson: l.id, assignment: a?.id || null, question, answer, sources, status, flagged: 0, resolved: 0, note: '', created: new Date().toISOString() }); result = { ok: true, id, answer, sources, status }; break;
      }
      default: throw Error('Unknown demo action.');
    }
    save(store); return Response.json(result);
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'The demo could not save this change.' }, { status: 400 }); }
}
export function installDemo() {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => { const url = new URL(input instanceof Request ? input.url : String(input), location.origin); if (url.origin === location.origin && ['/api/study', '/api/files'].includes(url.pathname)) return demoRequest(url, init); return nativeFetch(input, init); };
  const controls = document.getElementById('demo-controls')!;
  controls.style.cssText = 'position:relative;z-index:60;background:#eef2ff;border-bottom:1px solid #c7d2fe;padding:10px 16px;font:13px system-ui;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
  const note = document.createElement('span'); note.textContent = 'DEMO · Saved only in this browser · Source excerpts, no live AI · Use sample data only'; controls.appendChild(note);
  for (const role of ['teacher', 'student']) { const button = document.createElement('button'); button.textContent = `${role === user().role ? '✓ ' : ''}${role[0].toUpperCase() + role.slice(1)}`; button.style.cssText = 'padding:5px 10px;border:1px solid #a5b4fc;border-radius:6px;background:white;cursor:pointer'; button.onclick = () => { localStorage.setItem(roleKey, role); location.href = '/'; }; controls.appendChild(button); }
  const reset = document.createElement('button'); reset.textContent = 'Reset demo'; reset.onclick = () => { if (confirm('Reset all demo lessons and questions in this browser?')) { localStorage.removeItem(key); location.href = '/'; } }; controls.appendChild(reset);
  document.addEventListener('click', async event => { const link = (event.target as Element).closest('a'); if (!link) return; const url = new URL(link.href); if (url.pathname === '/signout-with-chatgpt') { event.preventDefault(); localStorage.setItem(roleKey, 'student'); location.href = '/'; } if (url.pathname === '/api/files') { event.preventDefault(); const response = await demoRequest(url); if (!response.ok) { alert(((await response.json()) as { error: string }).error); return; } const id = url.searchParams.get('id'); const blob = URL.createObjectURL(await response.blob()); const download = document.createElement('a'); download.href = blob; download.download = read().files.find(f => f.id === id)?.name || 'resource'; download.click(); setTimeout(() => URL.revokeObjectURL(blob), 1000); } });
}
