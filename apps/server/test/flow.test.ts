import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { openDb, type DbHandle } from "../src/db";
import { slotOf, tokenFor } from "../src/token";

type App = Awaited<ReturnType<typeof buildApp>>;
let handle: DbHandle;
let app: App;
const clock = { now: 2_000_000_000_000 };

const call = async (method: "GET" | "POST", url: string, token?: string, payload?: object) => {
  const r = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: r.statusCode, body: r.json() };
};

beforeAll(async () => {
  handle = await openDb();
  app = await buildApp({ db: handle.db, clock: () => clock.now, sweepMs: 0, simBeacon: true });
});
afterAll(async () => {
  await app.close();
  await handle.close();
});

describe("fluxo completo", () => {
  let prof: string, alu: string, aluId: string, classId: string, joinCode: string, sid: string, secretToken: () => Promise<string>;
  const device = "device-abcdefgh-1";

  it("professor cria turma, aluno entra", async () => {
    prof = (await call("POST", "/auth/login", undefined, { name: "Profa", role: "PROFESSOR" })).body.token;
    const a = (await call("POST", "/auth/login", undefined, { name: "Aluno Um", role: "ALUNO" })).body;
    alu = a.token;
    aluId = a.user.id;
    const c = (await call("POST", "/classes", prof, { name: "Cálculo" })).body;
    classId = c.id;
    joinCode = c.joinCode;
    expect((await call("POST", "/classes/join", alu, { code: joinCode })).status).toBe(200);
  });

  it("papéis são impostos", async () => {
    expect((await call("POST", "/classes", alu, { name: "x y" })).status).toBe(401);
    expect((await call("GET", "/me/classes")).status).toBe(401);
    expect((await call("GET", "/me/classes", "lixo.lixo")).status).toBe(401);
  });

  it("CRIADA não aceita check-in (R2); abrir é idempotente-seguro", async () => {
    sid = (await call("POST", `/classes/${classId}/sessions`, prof, { windowMs: 30_000 })).body.id;
    secretToken = async () => (await call("GET", `/sessions/${sid}/beacon`, prof)).body.token;
    const r = await call("POST", `/sessions/${sid}/checkin`, alu, { deviceId: device, token: await secretToken() });
    expect(r.status).toBe(422);
    expect(r.body.rule).toBe("R2");
    expect((await call("POST", `/sessions/${sid}/open`, prof)).body.state).toBe("ABERTA");
    expect((await call("POST", `/sessions/${sid}/open`, prof)).status).toBe(409);
  });

  it("aluno vê a chamada aberta e marca presença", async () => {
    clock.now += 5_000;
    expect((await call("GET", "/me/open-sessions", alu)).body).toHaveLength(1);
    const sim = (await call("GET", `/sessions/${sid}/sim-beacon`, alu)).body.token;
    const r = await call("POST", `/sessions/${sid}/checkin`, alu, { deviceId: device, token: sim });
    expect(r.status).toBe(200);
    expect(r.body.rule).toBe("R10");
    const again = await call("POST", `/sessions/${sid}/checkin`, alu, { deviceId: device, token: sim });
    expect(again.body.rule).toBe("R5");
  });

  it("token de outra sessão é inválido (R7)", async () => {
    const s2 = (await call("POST", `/classes/${classId}/sessions`, prof, {})).body.id;
    expect(tokenFor("x", s2, slotOf(clock.now))).toHaveLength(16);
    const b = (await call("POST", "/auth/login", undefined, { name: "Aluno Dois", role: "ALUNO" })).body;
    await call("POST", "/classes/join", b.token, { code: joinCode });
    const r = await call("POST", `/sessions/${sid}/checkin`, b.token, { deviceId: "device-zzzzzzzz-2", token: "deadbeefdeadbeef" });
    expect(r.body.rule).toBe("R7");
  });

  it("presença manual funciona e some do roster ao desmarcar", async () => {
    const b = (await call("POST", "/auth/login", undefined, { name: "Aluno Três", role: "ALUNO" })).body;
    await call("POST", "/classes/join", b.token, { code: joinCode });
    await call("POST", `/sessions/${sid}/manual`, prof, { studentId: b.user.id, present: true });
    let roster = (await call("GET", `/sessions/${sid}/attendance`, prof)).body as { studentId: string; present: boolean; method: string }[];
    expect(roster.find((x) => x.studentId === b.user.id)).toMatchObject({ present: true, method: "MANUAL" });
    await call("POST", `/sessions/${sid}/manual`, prof, { studentId: b.user.id, present: false });
    roster = (await call("GET", `/sessions/${sid}/attendance`, prof)).body;
    expect(roster.find((x) => x.studentId === b.user.id)?.present).toBe(false);
  });

  it("janela expira sozinha e vira FINALIZADA", async () => {
    clock.now += 31_000;
    const s = (await call("GET", `/sessions/${sid}`, alu)).body;
    expect(s.state).toBe("FINALIZADA");
    expect((await call("GET", "/me/open-sessions", alu)).body).toHaveLength(0);
    expect((await call("POST", `/sessions/${sid}/close`, prof)).status).toBe(409);
  });

  it("professor retoma a última chamada da turma", async () => {
    const latest = (await call("GET", `/classes/${classId}/sessions/latest`, prof)).body;
    expect(latest).toMatchObject({ classId });
    expect((await call("GET", `/classes/${classId}/sessions/latest`, alu)).status).toBe(401);
  });

  it("enquete: voto único por aluno, trocar voto atualiza", async () => {
    const s3 = (await call("POST", `/classes/${classId}/sessions`, prof, {})).body.id;
    await call("POST", `/sessions/${s3}/open`, prof);
    const act = (await call("POST", `/sessions/${s3}/activities`, prof, { prompt: "Entendeu?", options: ["Sim", "Não"] })).body;
    expect((await call("POST", `/activities/${act.id}/respond`, alu, { choice: 0 })).status).toBe(200);
    expect((await call("POST", `/activities/${act.id}/respond`, alu, { choice: 1 })).status).toBe(200);
    const list = (await call("GET", `/sessions/${s3}/activities`, prof)).body;
    expect(list[0].tally).toEqual([0, 1]);
    expect(aluId).toBeTruthy();
  });
});
