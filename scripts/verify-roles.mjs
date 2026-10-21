import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
const database = new DatabaseSync(':memory:');
database.exec(await readFile('drizzle/0000_studyscan.sql','utf8'));
database.exec(await readFile('drizzle/0001_roles.sql','utf8'));
class Statement {
 constructor(sql,args=[]){this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.sql,args);}
 async all(){return {results:database.prepare(this.sql).all(...this.args)};}
 async first(){return database.prepare(this.sql).get(...this.args)||null;}
 async run(){return database.prepare(this.sql).run(...this.args);}
}
globalThis.__studyRequest = new AsyncLocalStorage();
globalThis.__studyLocalEnv = {DB:{prepare:sql=>new Statement(sql),async batch(statements){database.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());database.exec('COMMIT');return results;}catch(error){database.exec('ROLLBACK');throw error;}}},BUCKET:{},AI_PROVIDER:'none'};
const {handle} = await import('../.sites-runtime/local/api.mjs');
const users={admin:{userId:'test-admin',email:'admin@example.test'},teacher:{userId:'test-teacher',email:'teacher@example.test'},student:{userId:'test-student',email:'student@example.test'},other:{userId:'test-other',email:'other@example.test'}};
database.prepare('INSERT INTO settings VALUES (?,?)').run('school-owner',users.admin.userId);
for(const [role,user] of Object.entries(users))database.prepare('INSERT INTO profiles (id,name,email,role) VALUES (?,?,?,?)').run(user.userId,role,user.email,role==='admin'?'super-admin':role==='other'?'teacher':role);
let checks=0;
async function request(role,action,data={},expected=200){const response=await globalThis.__studyRequest.run({user:users[role]},()=>handle(new Request('http://localhost/api/study',{method:action?'POST':'GET',headers:action?{'Content-Type':'application/json'}:{},...(action?{body:JSON.stringify({action,...data})}:{})})));const body=await response.json();assert.equal(response.status,expected,JSON.stringify(body));checks++;return body;}
await request('teacher','seed');
const teacher=await request('teacher');
await request('student','join',{code:teacher.classes[0].code});
const overview=await request('admin');assert.equal(overview.user.role,'super-admin');assert.equal(overview.interactions.length,0);assert.equal(overview.lessons.length,0);assert.equal(overview.admin.totals.lessons,3);
assert.equal((await request('teacher')).admin,undefined);
assert.equal((await request('other')).lessons.length,0);
await request('student','setRole',{id:users.student.userId,role:'super-admin'},403);
await request('teacher','inviteTeacher',{email:'new@example.test'},403);
await request('teacher','schoolSettings',{name:'Bypass',aiEnabled:true},403);
await request('admin','setRole',{id:users.admin.userId,role:'student'},400);
await request('admin','setAccountStatus',{id:users.admin.userId,status:'suspended'},400);
await request('admin','inviteTeacher',{email:users.student.email});assert.equal((await request('student')).user.role,'teacher');
await request('admin','setRole',{id:users.student.userId,role:'student'});assert.equal((await request('student')).user.role,'student');
await request('admin','setAccountStatus',{id:users.student.userId,status:'suspended'});
await request('student',null,{},403);await request('student','ask',{lesson:teacher.lessons[0].id,question:'Explain force.'},403);
await request('admin','setAccountStatus',{id:users.student.userId,status:'active'});
await request('admin','schoolSettings',{name:'Test School',aiEnabled:false,blockedTopics:''});
assert.equal((await request('student','ask',{lesson:teacher.lessons[0].id,question:'Explain force.'})).status,'restricted');
await request('admin','schoolSettings',{name:'Test School',aiEnabled:true,blockedTopics:'force'});
assert.equal((await request('student','ask',{lesson:teacher.lessons[0].id,question:'Explain force.'})).status,'restricted');
const admin=await request('admin');assert.equal(admin.interactions.length,0);assert.equal(admin.admin.totals.questions,2);assert.ok(admin.admin.audit.length>=6);
database.prepare('DELETE FROM settings WHERE id=?').run('school-owner');
users.visitor={userId:'new-visitor',email:'visitor@example.test'};
assert.equal((await request('visitor')).user.role,'student');assert.equal(database.prepare('SELECT * FROM settings WHERE id=?').get('school-owner'),undefined);
console.log(`${checks} server role checks passed, including migrations, privacy, suspension, policy enforcement, teacher approval, and bootstrap protection.`);
