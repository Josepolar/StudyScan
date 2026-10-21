import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { sampleLessons } from './seed';
import type { Lesson } from './types';
export const runtime=()=>env as unknown as {DB:D1Database;BUCKET:R2Bucket;SUPER_ADMIN_EMAIL?:string;AI_PROVIDER?:string;OLLAMA_MODEL?:string;OPENAI_API_KEY?:string;OPENAI_MODEL?:string;GROQ_API_KEY?:string;GROQ_MODEL?:string};
export const db=()=>runtime().DB;
export async function all<T=Record<string,unknown>>(sql:string,...args:unknown[]):Promise<T[]> {return (await db().prepare(sql).bind(...args).all<T>()).results;}
export async function one<T=Record<string,unknown>>(sql:string,...args:unknown[]):Promise<T|null> {return db().prepare(sql).bind(...args).first<T>();}
export async function run(sql:string,...args:unknown[]) {return db().prepare(sql).bind(...args).run();}
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export async function identity() {
 const auth=await getChatGPTUser();if(!auth) throw new HttpError(401,'Please sign in to StudyScan.');
 const bootstrap=await one<{value:string}>('SELECT value FROM settings WHERE id = ?', 'school-owner');
 if(!bootstrap && runtime().SUPER_ADMIN_EMAIL?.trim().toLowerCase()===auth.email.toLowerCase()) await run('INSERT OR IGNORE INTO settings (id,value) VALUES (?,?)','school-owner',auth.userId);
 const owner=await one<{value:string}>('SELECT value FROM settings WHERE id = ?', 'school-owner');
 await run('INSERT OR IGNORE INTO profiles (id,name,email,role) VALUES (?,?,?,?)',auth.userId,auth.fullName||auth.email.split('@')[0],auth.email,owner?.value===auth.userId?'super-admin':'student');
 if(owner?.value===auth.userId)await run('UPDATE profiles SET role = ? WHERE id = ?','super-admin',auth.userId);
 const approved=await one('SELECT value FROM settings WHERE id = ?',`teacher-email:${auth.email.toLowerCase()}`);if(approved && owner?.value!==auth.userId)await run('UPDATE profiles SET role = ? WHERE id = ?','teacher',auth.userId);
 const user=await one<{id:string;name:string;email:string;role:string;status:string}>('SELECT * FROM profiles WHERE id = ?',auth.userId);if(!user)throw new Error('Profile unavailable');if(user.status==='suspended')throw new HttpError(403,'Your account is suspended. Contact your school administrator.');return user;
}
export async function schoolPolicy(){const row=await one<{value:string}>('SELECT value FROM settings WHERE id = ?','school-policy');return row?JSON.parse(row.value) as {name:string;aiEnabled:boolean;blockedTopics:string}:{name:'StudyScan School',aiEnabled:true,blockedTopics:''};}
export async function visibleLessons(user:{id:string;role:string}) {if(user.role==='super-admin')return [];const rows=await all<{id:string;owner:string;data:string;updated:string}>('SELECT * FROM lessons ORDER BY updated DESC');const classes=await all<{classroom:string}>('SELECT classroom FROM memberships WHERE student = ?',user.id);return rows.filter(r=>{if(user.role==='teacher')return r.owner===user.id;const l=JSON.parse(r.data) as Lesson;return l.published&&(l.studentIds.includes(user.id)||l.classIds.some(c=>classes.some(m=>m.classroom===c)));}).map(r=>({...JSON.parse(r.data),id:r.id,owner:r.owner,updated:r.updated} as Lesson & {owner:string}));}
export async function lessonFor(user:{id:string;role:string},id:string){const lesson=(await visibleLessons(user)).find(l=>l.id===id);if(!lesson)throw new HttpError(404,'Lesson not found or not assigned to you.');return lesson;}
export async function seed(user:{id:string;role:string}){if(user.role!=='teacher')throw new HttpError(403,'Teacher access required.');if(await one('SELECT id FROM lessons WHERE owner = ? LIMIT 1',user.id))throw new HttpError(409,'Sample lessons can only be added to an empty library.');const c=crypto.randomUUID();const lessons=sampleLessons(c);await db().batch([db().prepare('INSERT INTO classrooms (id,owner,name,code) VALUES (?,?,?,?)').bind(c,user.id,'Grade 9 · Einstein',crypto.randomUUID().slice(0,8).toUpperCase()),...lessons.map(l=>db().prepare('INSERT INTO lessons (id,owner,data,updated) VALUES (?,?,?,?)').bind(l.id,user.id,JSON.stringify(l),new Date().toISOString())),db().prepare('INSERT INTO assignments (id,owner,lesson,data) VALUES (?,?,?,?)').bind(crypto.randomUUID(),user.id,lessons[0].id,JSON.stringify({title:'Force & Motion Reflection',instructions:'Describe a real-life example of each of Newton’s laws. Explain how force and mass affect acceleration in your example.',due:'',aiEnabled:true}))]);}
