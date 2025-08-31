import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  serial,
  boolean
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table (matches actual DB structure)
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  userid: varchar('userid', { length: 50 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  pwd: text('pwd'),
  img: text('img'),
  description: text('description'),
  displayName: varchar('display_name', { length: 100 }), 
  role: varchar('role', { length: 10 }).notNull().default('mentee'),
  isBlocked: boolean('is_blocked').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Skills table (matches actual DB structure)
export const skills = pgTable('skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 100 }).unique().notNull(),
});

// Courses table (matches actual DB structure)
export const courses = pgTable('courses', {
  courseId: serial('course_id').primaryKey(),
  mentorId: uuid('mentor_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  level: varchar('level', { length: 50 }),
  duration: integer('duration').default(8),
  maxEnrollment: integer('max_enrollment').default(20),
  objectives: text('objectives'),
  prerequisites: text('prerequisites'),
  skills: text('skills'),
  settings: text('settings'),
  status: varchar('status', { length: 20 }).default('draft'),
  timeSlots: text('time_slots'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Subscriptions table (matches actual DB structure)
export const subscriptions = pgTable('subscriptions', {
  subscriptionId: serial('subscription_id').primaryKey(),
  menteeId: uuid('mentee_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  courseId: integer('course_id').references(() => courses.courseId, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  motivation: text('motivation'),
  experience: text('experience'),
  subscribedAt: timestamp('subscribed_at', { withTimezone: true }).defaultNow(),
});

// Blocked users table (matches actual DB structure)
export const blockedUsers = pgTable('blocked_users', {
  blockerId: uuid('blocker_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  blockedUserId: uuid('blocked_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  blockedAt: timestamp('blocked_at', { withTimezone: true }).defaultNow(),
});

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  mentorCourses: many(courses),
  subscriptions: many(subscriptions),
  blockedByMe: many(blockedUsers, { relationName: 'blocker' }),
  blockedMe: many(blockedUsers, { relationName: 'blocked' }),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  mentor: one(users, {
    fields: [courses.mentorId],
    references: [users.id],
  }),
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  mentee: one(users, {
    fields: [subscriptions.menteeId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [subscriptions.courseId],
    references: [courses.courseId],
  }),
}));

export const blockedUsersRelations = relations(blockedUsers, ({ one }) => ({
  blocker: one(users, {
    fields: [blockedUsers.blockerId],
    references: [users.id],
    relationName: 'blocker'
  }),
  blockedUser: one(users, {
    fields: [blockedUsers.blockedUserId],
    references: [users.id],
    relationName: 'blocked'
  }),
}));