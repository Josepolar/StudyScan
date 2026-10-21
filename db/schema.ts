// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const profiles = sqliteTable('profiles', { id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull(), role: text('role').notNull().default('student'), status:text('status').notNull().default('active') });
export const auditLogs = sqliteTable('audit_logs', { id:text('id').primaryKey(), actor:text('actor').notNull(), action:text('action').notNull(), target:text('target').notNull(), created:text('created').notNull() }, t=>[index('idx_audit_created').on(t.created)]);
export const settings = sqliteTable('settings', { id: text('id').primaryKey(), value: text('value').notNull() });
export const classrooms = sqliteTable('classrooms', { id: text('id').primaryKey(), owner: text('owner').notNull(), name: text('name').notNull(), code: text('code').notNull().unique() });
export const memberships = sqliteTable('memberships', { id: text('id').primaryKey(), classroom: text('classroom').notNull(), student: text('student').notNull() }, t => [index('idx_memberships_student').on(t.student)]);
export const lessons = sqliteTable('lessons', { id: text('id').primaryKey(), owner: text('owner').notNull(), data: text('data').notNull(), updated: text('updated').notNull() }, t => [index('idx_lessons_owner').on(t.owner)]);
export const assignments = sqliteTable('assignments', { id: text('id').primaryKey(), owner: text('owner').notNull(), lesson: text('lesson').notNull(), data: text('data').notNull() });
export const interactions = sqliteTable('interactions', { id: text('id').primaryKey(), owner: text('owner').notNull(), student: text('student').notNull(), lesson: text('lesson').notNull(), assignment: text('assignment'), question: text('question').notNull(), answer: text('answer').notNull(), sources: text('sources').notNull(), status: text('status').notNull(), flagged: integer('flagged').notNull().default(0), resolved: integer('resolved').notNull().default(0), note: text('note').notNull().default(''), created: text('created').notNull() }, t=>[index('idx_interactions_owner_created').on(t.owner,t.created),index('idx_interactions_student_lesson').on(t.student,t.lesson)]);
export const progress = sqliteTable('progress', { id: text('id').primaryKey(), student: text('student').notNull(), lesson: text('lesson').notNull(), completed: integer('completed').notNull().default(0) });
export const files = sqliteTable('files', { id: text('id').primaryKey(), owner: text('owner').notNull(), lesson: text('lesson').notNull(), name: text('name').notNull(), size: integer('size').notNull() });
