import cors from "@fastify/cors";
import { RATE_WINDOW_MS, RULES, canTransition, validateCheckIn } from "@acadly-fio/core";
import type { Decision, SessionSnapshot } from "@acadly-fio/core";
import { and, asc, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { EventEmitter } from "node:events";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { readUser, signUser } from "./auth";
import type { Db } from "./db";
import { schema } from "./db";
import { slotOf, tokenFor, verifyBeacon } from "./token";

const { users, classes, enrollments, sessions, checkins, attempts, alerts, activities, responses, exams, examEvents } = schema;

export interface AppOptions {
  db: Db;
  clock?: () => number;
  authSecret?: string;
  /** DEV: deixa o aluno buscar o token no servidor. Em produção o token só chega por Bluetooth. */
  simBeacon?: boolean;
  /** varredura que finaliza sessões expiradas; 0 desliga (testes). */
  sweepMs?: number;
}

type Row = typeof sessions.$inferSelect;
const snap = (s: Row): SessionSnapshot => ({ id: s.id, classId: s.classId, state: s.state as SessionSnapshot["state"], openedAt: s.openedAt, windowMs: s.windowMs });

export async function buildApp(opts: AppOptions) {
  const { db } = opts;
  const clock = opts.clock ?? Date.now;
  const authSecret = opts.authSecret ?? process.env.AUTH_SECRET ?? "dev-secret-change-me";
  const bus = new EventEmitter();
  bus.setMaxListeners(0);
  const emit = (sessionId: string, type: string, data: unknown) => bus.emit(sessionId, { type, data, at: clock() });

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  // ---------- helpers ----------
  const authed = async (req: FastifyRequest, reply: FastifyReply, role?: "PROFESSOR" | "ALUNO") => {
    const header = req.headers.authorization?.replace(/^Bearer /, "");
    const q = (req.query as { token?: string }).token; // EventSource não manda header
    const id = readUser(authSecret, header ?? q);
    const [u] = id ? await db.select().from(users).where(eq(users.id, id)) : [];
    if (!u || (role && u.role !== role)) {
      reply.code(401).send({ error: "unauthorized" });
      return null;
    }
    return u;
  };

  /** Finaliza a sessão se a janela já expirou (lazy + sweeper). */
  const expireIfNeeded = async (s: Row): Promise<Row> => {
    if (s.state === "ABERTA" && s.openedAt !== null && clock() >= s.openedAt + s.windowMs) {
      const closedAt = s.openedAt + s.windowMs;
      const [u] = await db
        .update(sessions)
        .set({ state: "FINALIZADA", closedAt })
        .where(and(eq(sessions.id, s.id), eq(sessions.state, "ABERTA")))
        .returning();
      if (u) emit(s.id, "state", { state: "FINALIZADA", reason: "janela expirada" });
      return u ?? { ...s, state: "FINALIZADA", closedAt };
    }
    return s;
  };

  const loadSession = async (id: string) => {
    const [s] = await db.select().from(sessions).where(eq(sessions.id, id));
    return s ? expireIfNeeded(s) : null;
  };

  const ownSession = async (id: string, profId: string) => {
    const s = await loadSession(id);
    if (!s) return null;
    const [c] = await db.select().from(classes).where(and(eq(classes.id, s.classId), eq(classes.professorId, profId)));
    return c ? s : null;
  };

  let sweeper: NodeJS.Timeout | undefined;
  if ((opts.sweepMs ?? 5000) > 0) {
    sweeper = setInterval(async () => {
      try {
        const open = await db.select().from(sessions).where(eq(sessions.state, "ABERTA"));
        for (const s of open) await expireIfNeeded(s);
      } catch {
        /* próximo ciclo tenta de novo */
      }
    }, opts.sweepMs ?? 5000);
    sweeper.unref();
  }
  app.addHook("onClose", async () => sweeper && clearInterval(sweeper));

  // ---------- público ----------
  app.get("/health", async () => ({ ok: true }));
  app.get("/rules", async () => RULES);

  app.post("/auth/login", async (req, reply) => {
    const body = z.object({ name: z.string().trim().min(2).max(80), role: z.enum(["PROFESSOR", "ALUNO"]), userId: z.string().optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    // userId permite reabrir o app sem criar outra conta (MVP sem senha)
    if (body.data.userId) {
      const [u] = await db.select().from(users).where(eq(users.id, body.data.userId));
      if (u) return { user: u, token: signUser(authSecret, u.id) };
    }
    const [u] = await db.insert(users).values({ id: randomUUID(), name: body.data.name, role: body.data.role, createdAt: clock() }).returning();
    return { user: u, token: signUser(authSecret, u.id) };
  });

  // ---------- turmas ----------
  app.post("/classes", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const body = z.object({ name: z.string().trim().min(2).max(80) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const joinCode = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
    const [c] = await db.insert(classes).values({ id: randomUUID(), name: body.data.name, professorId: u.id, joinCode, createdAt: clock() }).returning();
    return c;
  });

  app.post("/classes/join", async (req, reply) => {
    const u = await authed(req, reply, "ALUNO");
    if (!u) return;
    const body = z.object({ code: z.string().trim().min(4).max(12) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const [c] = await db.select().from(classes).where(eq(classes.joinCode, body.data.code.toUpperCase()));
    if (!c) return reply.code(404).send({ error: "class_not_found" });
    await db.insert(enrollments).values({ classId: c.id, studentId: u.id, createdAt: clock() }).onConflictDoNothing();
    return c;
  });

  app.get("/me/classes", async (req, reply) => {
    const u = await authed(req, reply);
    if (!u) return;
    if (u.role === "PROFESSOR") return db.select().from(classes).where(eq(classes.professorId, u.id)).orderBy(desc(classes.createdAt));
    return db
      .select({ id: classes.id, name: classes.name, joinCode: classes.joinCode })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .where(eq(enrollments.studentId, u.id));
  });

  /** Sessão aberta mais recente de cada turma do aluno (para o app mostrar "chamada em andamento"). */
  app.get("/me/open-sessions", async (req, reply) => {
    const u = await authed(req, reply, "ALUNO");
    if (!u) return;
    const rows = await db
      .select({ s: sessions, className: classes.name })
      .from(enrollments)
      .innerJoin(sessions, eq(sessions.classId, enrollments.classId))
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .where(and(eq(enrollments.studentId, u.id), eq(sessions.state, "ABERTA")));
    const out = [];
    for (const r of rows) {
      const s = await expireIfNeeded(r.s);
      if (s.state === "ABERTA") out.push({ id: s.id, classId: s.classId, className: r.className, openedAt: s.openedAt, windowMs: s.windowMs });
    }
    return out;
  });

  // ---------- sessões (professor) ----------
  app.post("/classes/:id/sessions", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const { id } = req.params as { id: string };
    const [c] = await db.select().from(classes).where(and(eq(classes.id, id), eq(classes.professorId, u.id)));
    if (!c) return reply.code(404).send({ error: "class_not_found" });
    const body = z.object({ windowMs: z.number().int().min(10_000).max(600_000).default(120_000), mode: z.enum(["DIRETO", "REPASSE"]).default("DIRETO") }).safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const [s] = await db
      .insert(sessions)
      .values({ id: randomUUID(), classId: c.id, state: "CRIADA", windowMs: body.data.windowMs, secret: randomBytes(24).toString("hex"), mode: body.data.mode, createdAt: clock() })
      .returning();
    return publicSession(s);
  });

  /** Última chamada da turma: o app do professor a retoma ao reabrir a turma. */
  app.get("/classes/:id/sessions/latest", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const { id } = req.params as { id: string };
    const [c] = await db.select().from(classes).where(and(eq(classes.id, id), eq(classes.professorId, u.id)));
    if (!c) return reply.code(404).send({ error: "class_not_found" });
    const [s] = await db.select().from(sessions).where(eq(sessions.classId, c.id)).orderBy(desc(sessions.createdAt)).limit(1);
    return s ? publicSession(await expireIfNeeded(s)) : null;
  });

  app.post("/sessions/:id/open", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const s = await ownSession((req.params as { id: string }).id, u.id);
    if (!s) return reply.code(404).send({ error: "session_not_found" });
    if (!canTransition(s.state as never, "ABERTA")) return reply.code(409).send({ error: "invalid_transition", state: s.state });
    const [n] = await db.update(sessions).set({ state: "ABERTA", openedAt: clock() }).where(and(eq(sessions.id, s.id), eq(sessions.state, "CRIADA"))).returning();
    if (!n) return reply.code(409).send({ error: "invalid_transition" });
    emit(s.id, "state", { state: "ABERTA" });
    return publicSession(n);
  });

  app.post("/sessions/:id/close", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const s = await ownSession((req.params as { id: string }).id, u.id);
    if (!s) return reply.code(404).send({ error: "session_not_found" });
    if (!canTransition(s.state as never, "FINALIZADA")) return reply.code(409).send({ error: "invalid_transition", state: s.state });
    const [n] = await db.update(sessions).set({ state: "FINALIZADA", closedAt: clock() }).where(and(eq(sessions.id, s.id), eq(sessions.state, "ABERTA"))).returning();
    if (!n) return reply.code(409).send({ error: "invalid_transition" });
    emit(s.id, "state", { state: "FINALIZADA", reason: "encerrada pelo professor" });
    return publicSession(n);
  });

  /** Token que o aparelho do professor transmite por Bluetooth (rotaciona a cada 5 s). */
  app.get("/sessions/:id/beacon", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const s = await ownSession((req.params as { id: string }).id, u.id);
    if (!s) return reply.code(404).send({ error: "session_not_found" });
    const slot = slotOf(clock());
    return { token: tokenFor(s.secret, s.id, slot), slot, expiresAt: (slot + 1) * 5000 };
  });

  /** DEV apenas: simula "ouvir" o beacon sem Bluetooth. Desligado por padrão. */
  app.get("/sessions/:id/sim-beacon", async (req, reply) => {
    if (!opts.simBeacon) return reply.code(404).send({ error: "disabled" });
    const u = await authed(req, reply, "ALUNO");
    if (!u) return;
    const s = await loadSession((req.params as { id: string }).id);
    if (!s) return reply.code(404).send({ error: "session_not_found" });
    return { token: tokenFor(s.secret, s.id, slotOf(clock())) };
  });

  app.get("/sessions/:id", async (req, reply) => {
    const u = await authed(req, reply);
    if (!u) return;
    const s = await loadSession((req.params as { id: string }).id);
    if (!s) return reply.code(404).send({ error: "session_not_found" });
    const [{ n }] = await db.select({ n: count() }).from(checkins).where(eq(checkins.sessionId, s.id));
    return { ...publicSession(s), presentes: Number(n), serverNow: clock() };
  });

  app.get("/sessions/:id/attendance", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const s = await ownSession((req.params as { id: string }).id, u.id);
    if (!s) return reply.code(404).send({ error: "session_not_found" });
    const rows = await db
      .select({ studentId: users.id, name: users.name, method: checkins.method, hops: checkins.hops, rssi: checkins.rssi, review: checkins.review, at: checkins.at })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.studentId))
      .leftJoin(checkins, and(eq(checkins.studentId, users.id), eq(checkins.sessionId, s.id)))
      .where(eq(enrollments.classId, s.classId))
      .orderBy(asc(users.name));
    return rows.map((r) => ({ ...r, present: r.method !== null }));
  });

  app.post("/sessions/:id/manual", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const s = await ownSession((req.params as { id: string }).id, u.id);
    if (!s) return reply.code(404).send({ error: "session_not_found" });
    const body = z.object({ studentId: z.string(), present: z.boolean().default(true) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const [enr] = await db.select().from(enrollments).where(and(eq(enrollments.classId, s.classId), eq(enrollments.studentId, body.data.studentId)));
    if (!enr) return reply.code(404).send({ error: "not_enrolled" });
    if (body.data.present) {
      await db.insert(checkins).values({ id: randomUUID(), sessionId: s.id, studentId: body.data.studentId, deviceId: null, hops: 0, witnesses: [], method: "MANUAL", at: clock() }).onConflictDoUpdate({ target: [checkins.sessionId, checkins.studentId], set: { review: false } }); // confirma uma revisão
    } else {
      await db.delete(checkins).where(and(eq(checkins.sessionId, s.id), eq(checkins.studentId, body.data.studentId)));
    }
    emit(s.id, "checkin", { studentId: body.data.studentId, method: "MANUAL", present: body.data.present });
    return { ok: true };
  });

  app.get("/sessions/:id/attempts", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const s = await ownSession((req.params as { id: string }).id, u.id);
    if (!s) return reply.code(404).send({ error: "session_not_found" });
    const [att, al] = await Promise.all([
      db.select().from(attempts).where(eq(attempts.sessionId, s.id)).orderBy(desc(attempts.at)).limit(200),
      db.select().from(alerts).where(eq(alerts.sessionId, s.id)).orderBy(desc(alerts.at)).limit(100),
    ]);
    return { attempts: att, alerts: al };
  });

  // ---------- check-in (aluno) ----------
  app.post("/sessions/:id/checkin", async (req, reply) => {
    const u = await authed(req, reply, "ALUNO");
    if (!u) return;
    const body = z
      .object({
        deviceId: z.string().min(8).max(128),
        token: z.string().min(1).max(128).optional(),
        /** tokens ouvidos por Bluetooth com a força do sinal; o servidor escolhe o da própria sala */
        readings: z.array(z.object({ token: z.string().min(1).max(128), rssi: z.number().int().min(-127).max(0) })).max(16).default([]),
        hops: z.number().int().min(0).max(10).default(0),
        witnesses: z.array(z.string().max(64)).max(20).default([]),
      })
      .safeParse(req.body);
    if (!body.success || (!body.data.token && body.data.readings.length === 0)) return reply.code(400).send({ error: "invalid_body" });
    const sessionId = (req.params as { id: string }).id;
    const now = clock();

    const decision = await db.transaction(async (tx) => {
      // serializa check-ins da mesma sessão; as UNIQUE do banco são a segunda barreira
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))`);
      let [s] = await tx.select().from(sessions).where(eq(sessions.id, sessionId));
      if (s && s.state === "ABERTA" && s.openedAt !== null && now >= s.openedAt + s.windowMs) {
        await tx.update(sessions).set({ state: "FINALIZADA", closedAt: s.openedAt + s.windowMs }).where(eq(sessions.id, s.id));
        s = { ...s, state: "FINALIZADA", closedAt: s.openedAt + s.windowMs };
      }
      const [enr] = s ? await tx.select().from(enrollments).where(and(eq(enrollments.classId, s.classId), eq(enrollments.studentId, u.id))) : [];
      const present = s ? await tx.select({ studentId: checkins.studentId, deviceId: checkins.deviceId }).from(checkins).where(eq(checkins.sessionId, s.id)) : [];
      // com leituras, vale a que bate com o segredo desta sessão (a de outra sala não conta); sem nenhuma, usa a mais forte
      const heard = [...body.data.readings].sort((x, y) => y.rssi - x.rssi);
      const own = s ? heard.find((r) => verifyBeacon(s.secret, sessionId, r.token, now) !== "invalid") : undefined;
      const picked = own ?? heard[0];
      const token = picked?.token ?? body.data.token ?? "";
      const rssi = picked?.rssi ?? null;
      const [{ n }] = await tx
        .select({ n: count() })
        .from(attempts)
        .where(and(eq(attempts.sessionId, sessionId), eq(attempts.deviceId, body.data.deviceId), gt(attempts.at, now - RATE_WINDOW_MS)));

      const d: Decision = validateCheckIn(
        { sessionId, studentId: u.id, deviceId: body.data.deviceId, token, hops: body.data.hops, witnesses: body.data.witnesses, rssi, now },
        {
          session: s ? snap(s) : null,
          enrolled: !!enr,
          checkedIn: new Map(present.map((p) => [p.studentId, p.deviceId ?? ""] as [string, string])),
          recentAttemptsForDevice: Number(n),
          verifyToken: (tok, sid, t) => (s ? verifyBeacon(s.secret, sid, tok, t) : "invalid"),
        },
      );

      if (s) {
        await tx.insert(attempts).values({ id: randomUUID(), sessionId, studentId: u.id, deviceId: body.data.deviceId, ok: d.ok, rule: d.rule, code: d.code, reason: d.reason, rssi, at: now });
        if (d.ok) {
          await tx.insert(checkins).values({ id: randomUUID(), sessionId, studentId: u.id, deviceId: body.data.deviceId, hops: body.data.hops, witnesses: body.data.witnesses, method: "AUTO", rssi, review: !!d.review, at: now });
        }
        if (d.alert) await tx.insert(alerts).values({ id: randomUUID(), sessionId, kind: d.alert.kind, details: d.alert.details, at: now });
      }
      return d;
    });

    emit(sessionId, "attempt", { studentId: u.id, studentName: u.name, ...decision });
    if (decision.ok) emit(sessionId, "checkin", { studentId: u.id, studentName: u.name, method: "AUTO", present: true });
    if (decision.alert) emit(sessionId, "alert", { ...decision.alert, studentId: u.id });
    return reply.code(decision.ok ? 200 : 422).send(decision);
  });

  // ---------- tempo real (SSE) ----------
  app.get("/sessions/:id/stream", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const s = await ownSession((req.params as { id: string }).id, u.id);
    if (!s) return reply.code(404).send({ error: "session_not_found" });
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    const send = (ev: unknown) => reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
    send({ type: "hello", data: { state: s.state }, at: clock() });
    bus.on(s.id, send);
    const ping = setInterval(() => reply.raw.write(": ping\n\n"), 15000);
    req.raw.on("close", () => {
      clearInterval(ping);
      bus.off(s.id, send);
    });
  });

  // ---------- atividades em tempo real (enquetes) ----------
  app.post("/sessions/:id/activities", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const s = await ownSession((req.params as { id: string }).id, u.id);
    if (!s) return reply.code(404).send({ error: "session_not_found" });
    const body = z.object({ prompt: z.string().trim().min(2).max(300), options: z.array(z.string().trim().min(1).max(100)).min(2).max(6) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const [a] = await db.insert(activities).values({ id: randomUUID(), sessionId: s.id, type: "POLL", prompt: body.data.prompt, options: body.data.options, state: "ABERTA", createdAt: clock() }).returning();
    emit(s.id, "activity", { id: a.id, state: "ABERTA" });
    return a;
  });

  app.get("/sessions/:id/activities", async (req, reply) => {
    const u = await authed(req, reply);
    if (!u) return;
    const sid = (req.params as { id: string }).id;
    const list = await db.select().from(activities).where(eq(activities.sessionId, sid)).orderBy(desc(activities.createdAt));
    const out = [];
    for (const a of list) {
      const rs = await db.select({ choice: responses.choice, n: count() }).from(responses).where(eq(responses.activityId, a.id)).groupBy(responses.choice);
      const tally = a.options.map((_, i) => Number(rs.find((r) => r.choice === i)?.n ?? 0));
      out.push({ ...a, tally });
    }
    return out;
  });

  app.post("/activities/:id/respond", async (req, reply) => {
    const u = await authed(req, reply, "ALUNO");
    if (!u) return;
    const body = z.object({ choice: z.number().int().min(0).max(5) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const [a] = await db.select().from(activities).where(eq(activities.id, (req.params as { id: string }).id));
    if (!a || a.state !== "ABERTA" || body.data.choice >= a.options.length) return reply.code(422).send({ error: "invalid_activity" });
    const [s] = await db.select().from(sessions).where(eq(sessions.id, a.sessionId));
    const [enr] = s ? await db.select().from(enrollments).where(and(eq(enrollments.classId, s.classId), eq(enrollments.studentId, u.id))) : [];
    if (!enr) return reply.code(403).send({ error: "not_enrolled" });
    await db.insert(responses).values({ activityId: a.id, studentId: u.id, choice: body.data.choice, at: clock() }).onConflictDoUpdate({ target: [responses.activityId, responses.studentId], set: { choice: body.data.choice, at: clock() } });
    emit(a.sessionId, "activity", { id: a.id, state: "ABERTA", responded: true });
    return { ok: true };
  });

  app.post("/activities/:id/close", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const [a] = await db.select().from(activities).where(eq(activities.id, (req.params as { id: string }).id));
    const s = a ? await ownSession(a.sessionId, u.id) : null;
    if (!a || !s) return reply.code(404).send({ error: "activity_not_found" });
    await db.update(activities).set({ state: "ENCERRADA" }).where(eq(activities.id, a.id));
    emit(a.sessionId, "activity", { id: a.id, state: "ENCERRADA" });
    return { ok: true };
  });

  // ---------- Modo Prova (fiscal offline, sincroniza depois) ----------
  const ownClass = async (id: string, profId: string) => (await db.select().from(classes).where(and(eq(classes.id, id), eq(classes.professorId, profId))))[0];
  const ownExam = async (id: string, profId: string) => {
    const [e] = await db.select().from(exams).where(eq(exams.id, id));
    return e && (await ownClass(e.classId, profId)) ? e : null;
  };

  app.post("/classes/:id/exams", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const c = await ownClass((req.params as { id: string }).id, u.id);
    if (!c) return reply.code(404).send({ error: "class_not_found" });
    const body = z.object({ name: z.string().trim().min(2).max(80) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const [e] = await db.insert(exams).values({ id: randomUUID(), classId: c.id, name: body.data.name, createdAt: clock() }).returning();
    return e;
  });

  app.get("/classes/:id/exams", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const c = await ownClass((req.params as { id: string }).id, u.id);
    if (!c) return reply.code(404).send({ error: "class_not_found" });
    const [list, [{ n }]] = await Promise.all([
      db.select().from(exams).where(eq(exams.classId, c.id)).orderBy(desc(exams.createdAt)),
      db.select({ n: count() }).from(enrollments).where(eq(enrollments.classId, c.id)),
    ]);
    return list.map((e) => ({ ...e, alunos: Number(n) }));
  });

  /** Baixa a lista de alunos e os eventos já gravados; o app guarda no aparelho para usar sem internet. */
  app.get("/exams/:id", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const e = await ownExam((req.params as { id: string }).id, u.id);
    if (!e) return reply.code(404).send({ error: "exam_not_found" });
    const [roster, events] = await Promise.all([
      db.select({ studentId: users.id, name: users.name }).from(enrollments).innerJoin(users, eq(users.id, enrollments.studentId)).where(eq(enrollments.classId, e.classId)).orderBy(asc(users.name)),
      db.select({ id: examEvents.id, studentId: examEvents.studentId, kind: examEvents.kind, at: examEvents.at }).from(examEvents).where(eq(examEvents.examId, e.id)).orderBy(asc(examEvents.at)),
    ]);
    return { exam: { id: e.id, classId: e.classId, name: e.name, createdAt: e.createdAt }, roster, events };
  });

  /** Lote de eventos do fiscal. Idempotente: o mesmo id enviado de novo é ignorado. */
  app.post("/exams/:id/events", async (req, reply) => {
    const u = await authed(req, reply, "PROFESSOR");
    if (!u) return;
    const e = await ownExam((req.params as { id: string }).id, u.id);
    if (!e) return reply.code(404).send({ error: "exam_not_found" });
    const body = z
      .object({ events: z.array(z.object({ id: z.string().min(8).max(64), studentId: z.string().max(64), kind: z.enum(["ENTROU", "ENTREGOU", "ZERAR"]), at: z.number().int().positive() })).min(1).max(500) })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const ids = [...new Set(body.data.events.map((x) => x.studentId))];
    const ok = await db.select({ id: enrollments.studentId }).from(enrollments).where(and(eq(enrollments.classId, e.classId), inArray(enrollments.studentId, ids)));
    if (ok.length !== ids.length) return reply.code(422).send({ error: "student_not_in_class" });
    const saved = await db.insert(examEvents).values(body.data.events.map((x) => ({ ...x, examId: e.id, receivedAt: clock() }))).onConflictDoNothing().returning({ id: examEvents.id });
    return { saved: saved.length };
  });

  return app;
}

const publicSession = (s: Row) => ({ id: s.id, classId: s.classId, state: s.state, openedAt: s.openedAt, closedAt: s.closedAt, windowMs: s.windowMs, mode: s.mode });
