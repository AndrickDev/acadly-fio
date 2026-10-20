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
    expect(tokenFor("x", s2, slotOf(clock.now))).toHaveLength(12);
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

describe("Bluetooth: leituras, sinal fraco e revisão", () => {
  let prof: string, alu: string, aluId: string, sid: string, outraSid: string;
  const beacon = async (id: string) => (await call("GET", `/sessions/${id}/beacon`, prof)).body.token as string;

  it("prepara duas chamadas abertas (sala e sala vizinha)", async () => {
    prof = (await call("POST", "/auth/login", undefined, { name: "Prof BLE", role: "PROFESSOR" })).body.token;
    const a = (await call("POST", "/auth/login", undefined, { name: "Aluno BLE", role: "ALUNO" })).body;
    alu = a.token;
    aluId = a.user.id;
    const c1 = (await call("POST", "/classes", prof, { name: "Sala A" })).body;
    const c2 = (await call("POST", "/classes", prof, { name: "Sala B" })).body;
    await call("POST", "/classes/join", alu, { code: c1.joinCode });
    const s1 = (await call("POST", `/classes/${c1.id}/sessions`, prof, { windowMs: 120_000 })).body;
    const s2 = (await call("POST", `/classes/${c2.id}/sessions`, prof, { windowMs: 120_000 })).body;
    expect(s1.mode).toBe("DIRETO");
    sid = s1.id;
    outraSid = s2.id;
    await call("POST", `/sessions/${sid}/open`, prof);
    await call("POST", `/sessions/${outraSid}/open`, prof);
  });

  it("token tem 12 hex (6 bytes), o que cabe no anúncio", async () => {
    expect(await beacon(sid)).toMatch(/^[0-9a-f]{12}$/);
  });

  it("só ouviu a sala vizinha: rejeita (R7)", async () => {
    const r = await call("POST", `/sessions/${sid}/checkin`, alu, { deviceId: "device-ble-0001", readings: [{ token: await beacon(outraSid), rssi: -50 }] });
    expect(r.status).toBe(422);
    expect(r.body.rule).toBe("R7");
  });

  it("ouviu a vizinha forte e a própria sala fraca: aceita para revisão", async () => {
    const r = await call("POST", `/sessions/${sid}/checkin`, alu, {
      deviceId: "device-ble-0001",
      readings: [
        { token: await beacon(outraSid), rssi: -45 },
        { token: await beacon(sid), rssi: -88 },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, review: true });
    const row = (await call("GET", `/sessions/${sid}/attendance`, prof)).body.find((x: { studentId: string }) => x.studentId === aluId);
    expect(row).toMatchObject({ present: true, review: true, rssi: -88 });
  });

  it("professor confirma a revisão", async () => {
    await call("POST", `/sessions/${sid}/manual`, prof, { studentId: aluId, present: true });
    const row = (await call("GET", `/sessions/${sid}/attendance`, prof)).body.find((x: { studentId: string }) => x.studentId === aluId);
    expect(row).toMatchObject({ present: true, review: false });
  });
});

describe("Modo Prova: lista do fiscal que sincroniza depois", () => {
  let prof: string, outro: string, classId: string, examId: string, ana: string, bia: string;
  const ev = (id: string, studentId: string, kind: string, at: number) => ({ id, studentId, kind, at });

  it("cria a prova a partir da turma e baixa a lista", async () => {
    prof = (await call("POST", "/auth/login", undefined, { name: "Fiscal", role: "PROFESSOR" })).body.token;
    outro = (await call("POST", "/auth/login", undefined, { name: "Outro Prof", role: "PROFESSOR" })).body.token;
    const a = (await call("POST", "/auth/login", undefined, { name: "Ana Prova", role: "ALUNO" })).body;
    const b = (await call("POST", "/auth/login", undefined, { name: "Bia Prova", role: "ALUNO" })).body;
    ana = a.user.id;
    bia = b.user.id;
    const c = (await call("POST", "/classes", prof, { name: "Física" })).body;
    classId = c.id;
    await call("POST", "/classes/join", a.token, { code: c.joinCode });
    await call("POST", "/classes/join", b.token, { code: c.joinCode });
    const e = await call("POST", `/classes/${classId}/exams`, prof, { name: "P1 de Física" });
    expect(e.status).toBe(200);
    examId = e.body.id;
    const d = (await call("GET", `/exams/${examId}`, prof)).body;
    expect(d.roster.map((r: { name: string }) => r.name)).toEqual(["Ana Prova", "Bia Prova"]);
    expect(d.events).toEqual([]);
  });

  it("outro professor não acessa a prova", async () => {
    expect((await call("GET", `/exams/${examId}`, outro)).status).toBe(404);
    expect((await call("POST", `/exams/${examId}/events`, outro, { events: [ev("evento-x1", ana, "ENTROU", 1)] })).status).toBe(404);
  });

  it("recebe eventos em lote e reenviar não duplica", async () => {
    const lote = [ev("evento-01", ana, "ENTROU", 1000), ev("evento-02", bia, "ENTROU", 1100), ev("evento-03", ana, "ENTREGOU", 5000)];
    expect((await call("POST", `/exams/${examId}/events`, prof, { events: lote })).body.saved).toBe(3);
    expect((await call("POST", `/exams/${examId}/events`, prof, { events: lote })).body.saved).toBe(0);
    const d = (await call("GET", `/exams/${examId}`, prof)).body;
    expect(d.events).toHaveLength(3);
  });

  it("rejeita aluno que não é da turma e tipo inválido", async () => {
    expect((await call("POST", `/exams/${examId}/events`, prof, { events: [ev("evento-09", "ninguem", "ENTROU", 1)] })).status).toBe(422);
    expect((await call("POST", `/exams/${examId}/events`, prof, { events: [ev("evento-08", ana, "VOOU", 1)] })).status).toBe(400);
  });

  it("lista as provas da turma com contagem", async () => {
    const l = (await call("GET", `/classes/${classId}/exams`, prof)).body;
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ id: examId, name: "P1 de Física", alunos: 2 });
  });
});
