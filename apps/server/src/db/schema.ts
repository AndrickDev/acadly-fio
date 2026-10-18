import { bigint, boolean, index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

const ms = (name: string) => bigint(name, { mode: "number" });

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(), // PROFESSOR | ALUNO
  createdAt: ms("created_at").notNull(),
});

export const classes = pgTable("classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  professorId: text("professor_id").notNull().references(() => users.id),
  joinCode: text("join_code").notNull().unique(),
  createdAt: ms("created_at").notNull(),
});

export const enrollments = pgTable(
  "enrollments",
  {
    classId: text("class_id").notNull().references(() => classes.id),
    studentId: text("student_id").notNull().references(() => users.id),
    createdAt: ms("created_at").notNull(),
  },
  (t) => [uniqueIndex("enrollments_uq").on(t.classId, t.studentId)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  classId: text("class_id").notNull().references(() => classes.id),
  state: text("state").notNull(), // CRIADA | ABERTA | FINALIZADA
  openedAt: ms("opened_at"),
  closedAt: ms("closed_at"),
  windowMs: integer("window_ms").notNull(),
  secret: text("secret").notNull(),
  createdAt: ms("created_at").notNull(),
});

export const checkins = pgTable(
  "checkins",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull().references(() => sessions.id),
    studentId: text("student_id").notNull().references(() => users.id),
    deviceId: text("device_id"), // null em presença manual
    hops: integer("hops").notNull().default(0),
    witnesses: jsonb("witnesses").$type<string[]>().notNull().default([]),
    method: text("method").notNull(), // AUTO | MANUAL
    at: ms("at").notNull(),
  },
  (t) => [
    uniqueIndex("checkins_student_uq").on(t.sessionId, t.studentId),
    // Postgres trata NULLs como distintos: presenças manuais não colidem.
    uniqueIndex("checkins_device_uq").on(t.sessionId, t.deviceId),
  ],
);

export const attempts = pgTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    studentId: text("student_id").notNull(),
    deviceId: text("device_id").notNull(),
    ok: boolean("ok").notNull(),
    rule: text("rule").notNull(),
    code: text("code").notNull(),
    reason: text("reason").notNull(),
    at: ms("at").notNull(),
  },
  (t) => [index("attempts_device_idx").on(t.sessionId, t.deviceId, t.at)],
);

export const alerts = pgTable("alerts", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  kind: text("kind").notNull(),
  details: text("details").notNull(),
  at: ms("at").notNull(),
});

export const activities = pgTable("activities", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id),
  type: text("type").notNull(), // POLL
  prompt: text("prompt").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  state: text("state").notNull(), // ABERTA | ENCERRADA
  createdAt: ms("created_at").notNull(),
});

export const responses = pgTable(
  "responses",
  {
    activityId: text("activity_id").notNull().references(() => activities.id),
    studentId: text("student_id").notNull().references(() => users.id),
    choice: integer("choice").notNull(),
    at: ms("at").notNull(),
  },
  (t) => [uniqueIndex("responses_uq").on(t.activityId, t.studentId)],
);
