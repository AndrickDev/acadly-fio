/**
 * Bateria de simulação: dezenas de alunos concorrentes contra a API real
 * (Fastify + Postgres/PGlite em memória), com relógio controlável.
 *
 *   npm run simulate
 *
 * Gera tests/report.md e tests/report.json. Sai com código 1 se algum critério falhar.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "../apps/server/src/app";
import { openDb } from "../apps/server/src/db";
import { slotOf, tokenFor } from "../apps/server/src/token";

const here = dirname(fileURLToPath(import.meta.url));

type Category =
  | "NORMAL"
  | "NORMAL_MESH"
  | "DUP_DEVICE"
  | "DUP_STUDENT"
  | "OUT_BEFORE_OPEN"
  | "OUT_AFTER_CLOSE"
  | "ORPHAN_CLUSTER"
  | "BAD_TOKEN"
  | "NOT_ENROLLED";

interface Scenario {
  id: number;
  category: Category;
  legit: boolean;
  /** regra que deve decidir (R10 = aceito) */
  expectRule: string;
  run: () => Promise<{ status: number; rule: string; code: string }>;
}

const clock = { now: 1_800_000_000_000 };
const handle = await openDb(); // PGlite em memória
const app = await buildApp({ db: handle.db, clock: () => clock.now, sweepMs: 0 });

const post = async (url: string, token: string | null, payload: unknown) => {
  const res = await app.inject({ method: "POST", url, payload: payload as object, headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: res.statusCode, body: res.json() };
};
const get = async (url: string, token: string) => (await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } })).json();

// ---------- cenário base ----------
const prof = (await post("/auth/login", null, { name: "Profa Simulada", role: "PROFESSOR" })).body;
const turma = (await post("/classes", prof.token, { name: "Turma Simulação" })).body;

const mkStudent = async (i: number, enroll = true) => {
  const r = (await post("/auth/login", null, { name: `Aluno ${String(i).padStart(3, "0")}`, role: "ALUNO" })).body;
  if (enroll) await post("/classes/join", r.token, { code: turma.joinCode });
  return { id: r.user.id as string, token: r.token as string };
};

const N_ANCHOR = 20;
const N_NORMAL = 80; // 40 diretos + 40 via mesh
const N_DUP_DEVICE = 15;
const N_DUP_STUDENT = 10;
const N_BEFORE = 13;
const N_AFTER = 12;
const N_ORPHAN = 10;
const N_BAD_TOKEN = 10;
const N_NOT_ENROLLED = 5;
const total = N_ANCHOR + N_NORMAL + N_DUP_DEVICE + N_DUP_STUDENT + N_BEFORE + N_AFTER + N_ORPHAN + N_BAD_TOKEN + N_NOT_ENROLLED;

const students = await Promise.all(Array.from({ length: total }, (_, i) => mkStudent(i, i < total - N_NOT_ENROLLED)));
let cursor = 0;
const take = (n: number) => students.slice(cursor, (cursor += n));

const sessionOpen = (await post(`/classes/${turma.id}/sessions`, prof.token, { windowMs: 120_000 })).body;
const sessionIdle = (await post(`/classes/${turma.id}/sessions`, prof.token, { windowMs: 120_000 })).body; // nunca aberta
const beacon = async (sessionId: string) => (await get(`/sessions/${sessionId}/beacon`, prof.token)).token as string;

const checkin = async (sessionId: string, s: { token: string }, p: { deviceId: string; token: string; hops?: number; witnesses?: string[] }) => {
  const r = await post(`/sessions/${sessionId}/checkin`, s.token, { hops: 0, witnesses: [], ...p });
  return { status: r.status, rule: r.body.rule as string, code: r.body.code as string };
};
const dev = (tag: string, i: number) => `dev-${tag}-${String(i).padStart(4, "0")}-xxxxxxxx`;

const results: { sc: Scenario; got: { status: number; rule: string; code: string } }[] = [];
const execute = async (batch: Scenario[]) => {
  const out = await Promise.all(batch.map(async (sc) => ({ sc, got: await sc.run() })));
  results.push(...out);
};
let nextId = 1;
const scenario = (category: Category, legit: boolean, expectRule: string, run: Scenario["run"]): Scenario => ({ id: nextId++, category, legit, expectRule, run });

// ---------- fase 0: abre sessão ----------
await post(`/sessions/${sessionOpen.id}/open`, prof.token, {});
clock.now += 20_000; // 20 s dentro da janela
const tokOpen = await beacon(sessionOpen.id);

// ---------- fase A: âncoras (hops 0) ----------
const anchors = take(N_ANCHOR);
await execute(anchors.map((s, i) => scenario("NORMAL", true, "R10", () => checkin(sessionOpen.id, s, { deviceId: dev("anc", i), token: tokOpen }))));

// ---------- fase B: tudo o mais, concorrente ----------
const normalDirect = take(N_NORMAL / 2);
const normalMesh = take(N_NORMAL / 2);
const dupDevice = take(N_DUP_DEVICE);
const dupStudent = take(N_DUP_STUDENT);
const orphans = take(N_ORPHAN);
const badToken = take(N_BAD_TOKEN);
const before = take(N_BEFORE);
const after = take(N_AFTER);
const stray = take(N_NOT_ENROLLED); // por último: são os que mkStudent não matriculou

const rnd = (n: number) => 1 + Math.floor(Math.random() * n);
const phaseB: Scenario[] = [
  ...normalDirect.map((s, i) => scenario("NORMAL", true, "R10", () => checkin(sessionOpen.id, s, { deviceId: dev("dir", i), token: tokOpen }))),
  ...normalMesh.map((s, i) =>
    scenario("NORMAL_MESH", true, "R10", () =>
      checkin(sessionOpen.id, s, { deviceId: dev("mesh", i), token: tokOpen, hops: rnd(3), witnesses: [anchors[i % N_ANCHOR].id, anchors[(i + 7) % N_ANCHOR].id] }),
    ),
  ),
  // aluno novo usando o MESMO aparelho de uma âncora já presente -> R6
  ...dupDevice.map((s, i) => scenario("DUP_DEVICE", false, "R6", () => checkin(sessionOpen.id, s, { deviceId: dev("anc", i % N_ANCHOR), token: tokOpen }))),
  // aluno já presente tentando de novo, de outro aparelho -> R5
  ...dupStudent.map((_, i) => scenario("DUP_STUDENT", false, "R5", () => checkin(sessionOpen.id, anchors[i], { deviceId: dev("again", i), token: tokOpen }))),
  // hops>0 com testemunhas que ninguém viu na sala (cluster fantasma) -> R9
  ...orphans.map((s, i) => scenario("ORPHAN_CLUSTER", false, "R9", () => checkin(sessionOpen.id, s, { deviceId: dev("orph", i), token: tokOpen, hops: 1, witnesses: ["fantasma-1", "fantasma-2"] }))),
  // token forjado -> R7
  ...badToken.map((s, i) => scenario("BAD_TOKEN", false, "R7", () => checkin(sessionOpen.id, s, { deviceId: dev("bad", i), token: "0000000000000000" }))),
  // quem não está na turma -> R3
  ...stray.map((s, i) => scenario("NOT_ENROLLED", false, "R3", () => checkin(sessionOpen.id, s, { deviceId: dev("stray", i), token: tokOpen }))),
  // sessão que o professor nunca abriu -> R2
  ...before.map((s, i) => scenario("OUT_BEFORE_OPEN", false, "R2", async () => checkin(sessionIdle.id, s, { deviceId: dev("pre", i), token: tokenFor("qualquer", sessionIdle.id, slotOf(clock.now)) }))),
];
// embaralha para forçar intercalação real
phaseB.sort(() => Math.random() - 0.5);
await execute(phaseB);

// ---------- fase C: janela expira ----------
clock.now += 130_000;
await execute(after.map((s, i) => scenario("OUT_AFTER_CLOSE", false, "R2", () => checkin(sessionOpen.id, s, { deviceId: dev("late", i), token: tokOpen }))));

// ---------- relatório ----------
const accepted = (r: (typeof results)[number]) => r.got.status === 200 && r.got.rule === "R10";
const legit = results.filter((r) => r.sc.legit);
const fraud = results.filter((r) => !r.sc.legit);
const tp = legit.filter(accepted).length; // legítimo aceito
const fn = legit.length - tp; // legítimo bloqueado (falso positivo de fraude)
const tn = fraud.filter((r) => !accepted(r)).length; // fraude bloqueada
const fp = fraud.length - tn; // fraude aceita (grave)
const ruleMatch = results.filter((r) => r.got.rule === r.sc.expectRule).length;
const pct = (a: number, b: number) => (b === 0 ? "n/a" : `${((a / b) * 100).toFixed(1)}%`);

const byCat = new Map<Category, { n: number; ok: number }>();
for (const r of results) {
  const c = byCat.get(r.sc.category) ?? { n: 0, ok: 0 };
  c.n++;
  if (r.sc.legit ? accepted(r) : !accepted(r) && r.got.rule === r.sc.expectRule) c.ok++;
  byCat.set(r.sc.category, c);
}
const byRule = new Map<string, number>();
for (const r of results) byRule.set(r.got.rule, (byRule.get(r.got.rule) ?? 0) + 1);

const dbPresent = (await get(`/sessions/${sessionOpen.id}/attendance`, prof.token)).filter((a: { present: boolean }) => a.present).length;
const dbAlerts = (await get(`/sessions/${sessionOpen.id}/attempts`, prof.token)).alerts as { kind: string }[];
const alertKinds = new Map<string, number>();
for (const a of dbAlerts) alertKinds.set(a.kind, (alertKinds.get(a.kind) ?? 0) + 1);

const criteria = [
  { name: "Nenhuma fraude aceita (duplicata, fora da janela, token, cluster)", pass: fp === 0 },
  { name: "≥ 98% dos legítimos aceitos", pass: tp / legit.length >= 0.98 },
  { name: "Regra decisória igual à esperada em 100% dos cenários", pass: ruleMatch === results.length },
  { name: "Presentes no banco = legítimos aceitos (sem duplicata gravada)", pass: dbPresent === tp },
];

const lines: string[] = [];
lines.push(`# Relatório de simulação de presença`, ``, `- Cenários: **${results.length}** (executados com concorrência real contra a API)`);
lines.push(`- Banco: PGlite (Postgres embutido, em memória) · Relógio simulado`, ``);
lines.push(`## Acurácia`, ``, `| Métrica | Valor |`, `|---|---|`);
lines.push(`| Legítimos aceitos (TP) | ${tp}/${legit.length} (${pct(tp, legit.length)}) |`);
lines.push(`| Legítimos bloqueados por engano (FN) | ${fn} |`);
lines.push(`| Fraudes bloqueadas (TN) | ${tn}/${fraud.length} (${pct(tn, fraud.length)}) |`);
lines.push(`| Fraudes aceitas (FP) | ${fp} |`);
lines.push(`| Acurácia geral | ${pct(tp + tn, results.length)} |`);
lines.push(`| Regra decisória correta | ${ruleMatch}/${results.length} (${pct(ruleMatch, results.length)}) |`, ``);
lines.push(`## Por categoria`, ``, `| Categoria | Cenários | Corretos |`, `|---|---|---|`);
for (const [c, v] of byCat) lines.push(`| ${c} | ${v.n} | ${v.ok} (${pct(v.ok, v.n)}) |`);
lines.push(``, `## Regra acionada`, ``, `| Regra | Vezes |`, `|---|---|`);
for (const [r, n] of [...byRule].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1)))) lines.push(`| ${r} | ${n} |`);
lines.push(``, `## Alertas de anomalia gerados`, ``, `| Tipo | Qtde |`, `|---|---|`);
for (const [k, n] of alertKinds) lines.push(`| ${k} | ${n} |`);
lines.push(``, `## Critérios de aceite`, ``);
for (const c of criteria) lines.push(`- ${c.pass ? "✅" : "❌"} ${c.name}`);
const failures = results.filter((r) => (r.sc.legit ? !accepted(r) : accepted(r) || r.got.rule !== r.sc.expectRule));
if (failures.length) {
  lines.push(``, `## Divergências`, ``);
  for (const f of failures.slice(0, 30)) lines.push(`- #${f.sc.id} ${f.sc.category}: esperado ${f.sc.expectRule}, obtido ${f.got.rule}/${f.got.code} (HTTP ${f.got.status})`);
}

const md = lines.join("\n") + "\n";
writeFileSync(join(here, "report.md"), md);
writeFileSync(
  join(here, "report.json"),
  JSON.stringify({ total: results.length, tp, fn, tn, fp, ruleMatch, dbPresent, byCategory: Object.fromEntries(byCat), byRule: Object.fromEntries(byRule), alerts: Object.fromEntries(alertKinds), criteria }, null, 2),
);
console.log(md);

await app.close();
await handle.close();
process.exit(criteria.every((c) => c.pass) ? 0 : 1);
