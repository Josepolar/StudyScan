import { all, one, run, db, HttpError, schoolPolicy } from './server';
import type { AdminState, Account, AuditEntry, Role } from './types';
export const adminActions = new Set(['setRole','setAccountStatus','schoolSettings','inviteTeacher']);
export function requireAdmin(user:{role:string}){if(user.role!=='super-admin')throw new HttpError(403,'Super Admin access required.');}
export async function adminState(user:{role:string}):Promise<AdminState>{
 requireAdmin(user);
 const count=async(sql:string)=>Number((await one<{n:number}>(sql))?.n||0);
 return {accounts:await all<Account>('SELECT id,name,email,role,status FROM profiles ORDER BY name LIMIT 2000'),policy:await schoolPolicy(),audit:await all<AuditEntry>('SELECT * FROM audit_logs ORDER BY created DESC LIMIT 100'),protectedAccount:(await one<{value:string}>('SELECT value FROM settings WHERE id = ?','school-owner'))?.value||'',totals:{lessons:await count('SELECT count(*) AS n FROM lessons'),classes:await count('SELECT count(*) AS n FROM classrooms'),questions:await count('SELECT count(*) AS n FROM interactions'),flagged:await count('SELECT count(*) AS n FROM interactions WHERE flagged=1 AND resolved=0')}};
}
export async function adminAction(user:{id:string;role:string},b:Record<string,any>){
 requireAdmin(user);const action=String(b.action);let target='school';const statements:D1PreparedStatement[]=[];
 if(action==='setRole'||action==='setAccountStatus'){
  const account=await one<Account>('SELECT * FROM profiles WHERE id = ?',String(b.id));if(!account)throw new HttpError(404,'Account not found.');
  const owner=await one<{value:string}>('SELECT value FROM settings WHERE id = ?','school-owner');if(account.id===user.id||account.id===owner?.value)throw new HttpError(400,'Your own account and the primary administrator are protected.');
  target=account.email;
  if(action==='setRole'){if(!['super-admin','teacher','student'].includes(b.role))throw new HttpError(400,'Choose a valid role.');statements.push(db().prepare('UPDATE profiles SET role=? WHERE id=?').bind(b.role as Role,account.id));statements.push(db().prepare('DELETE FROM settings WHERE id=?').bind('teacher-email:'+account.email.toLowerCase()));target+=' → '+b.role;}
  else{if(!['active','suspended'].includes(b.status))throw new HttpError(400,'Choose a valid account status.');statements.push(db().prepare('UPDATE profiles SET status=? WHERE id=?').bind(b.status,account.id));target+=' → '+b.status;}
 }else if(action==='inviteTeacher'){
  const email=String(b.email||'').trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw new HttpError(400,'Enter a valid teacher email.');
  const existing=await one<Account>('SELECT * FROM profiles WHERE lower(email)=?',email);if(existing?.role==='super-admin')throw new HttpError(400,'That account is already a Super Admin.');
  statements.push(db().prepare('INSERT OR REPLACE INTO settings (id,value) VALUES (?,?)').bind('teacher-email:'+email,'approved'));statements.push(db().prepare("UPDATE profiles SET role='teacher' WHERE lower(email)=?").bind(email));target=email;
 }else if(action==='schoolSettings'){
  const policy={name:String(b.name||'').trim().slice(0,100),aiEnabled:b.aiEnabled===true,blockedTopics:String(b.blockedTopics||'').trim().slice(0,2000)};if(!policy.name)throw new HttpError(400,'Enter the school name.');statements.push(db().prepare('INSERT OR REPLACE INTO settings (id,value) VALUES (?,?)').bind('school-policy',JSON.stringify(policy)));
 }else throw new HttpError(400,'Unknown administrator action.');
 statements.push(db().prepare('INSERT INTO audit_logs (id,actor,action,target,created) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),user.id,action,target,new Date().toISOString()));await db().batch(statements);
}
