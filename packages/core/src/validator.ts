import { MAX_HOPS, RATE_MAX_ATTEMPTS, RSSI_REVISAR_ABAIXO } from "./rules";
import type { CheckInAttempt, Decision, SessionSnapshot, SessionState, ValidationContext } from "./types";

const TRANSITIONS: Record<SessionState, SessionState[]> = {
  CRIADA: ["ABERTA"],
  ABERTA: ["FINALIZADA"],
  FINALIZADA: [],
};

export const canTransition = (from: SessionState, to: SessionState): boolean => TRANSITIONS[from].includes(to);

/** Janela semiaberta [abertura, abertura + janela). */
export const isWindowOpen = (s: SessionSnapshot, now: number): boolean =>
  s.state === "ABERTA" && s.openedAt !== null && now >= s.openedAt && now < s.openedAt + s.windowMs;

const reject = (rule: Decision["rule"], code: Exclude<Decision["code"], "ACCEPT">, reason: string, alert?: Decision["alert"]): Decision => ({
  ok: false,
  rule,
  code,
  reason,
  ...(alert ? { alert } : {}),
});

/** Executa R1..R10 em ordem; a primeira regra que falha decide. Função pura. */
export function validateCheckIn(a: CheckInAttempt, ctx: ValidationContext): Decision {
  const { session } = ctx;
  if (!session) return reject("R1", "REJECT_SESSION_NOT_FOUND", "Sessão não encontrada.");

  if (!isWindowOpen(session, a.now)) {
    return reject("R2", "REJECT_OUT_OF_WINDOW", "Fora da janela ativa da chamada.");
  }

  if (!ctx.enrolled) return reject("R3", "REJECT_NOT_ENROLLED", "Aluno não matriculado nesta turma.");

  if (ctx.recentAttemptsForDevice >= RATE_MAX_ATTEMPTS) {
    return reject("R4", "REJECT_RATE_LIMITED", "Tentativas demais em pouco tempo.", {
      kind: "BURST",
      details: `device=${a.deviceId} aluno=${a.studentId}`,
    });
  }

  if (ctx.checkedIn.has(a.studentId)) {
    return reject("R5", "REJECT_ALREADY_CHECKED_IN", "Presença já registrada.");
  }

  for (const [studentId, deviceId] of ctx.checkedIn) {
    if (deviceId === a.deviceId && studentId !== a.studentId) {
      return reject("R6", "REJECT_DUPLICATE_DEVICE", "Este dispositivo já registrou outro aluno.", {
        kind: "DUPLICATE_DEVICE",
        details: `device=${a.deviceId} já usado por ${studentId}; tentativa de ${a.studentId}`,
      });
    }
  }

  const tok = ctx.verifyToken(a.token, a.sessionId, a.now);
  if (tok !== "ok") {
    return reject(
      "R7",
      "REJECT_INVALID_TOKEN",
      tok === "stale" ? "Token expirado (possível replay)." : "Token de proximidade inválido.",
      tok === "stale" ? { kind: "STALE_TOKEN_REPLAY", details: `device=${a.deviceId} aluno=${a.studentId}` } : undefined,
    );
  }

  if (a.hops > MAX_HOPS) return reject("R8", "REJECT_TOO_MANY_HOPS", `Mais de ${MAX_HOPS} saltos até o professor.`);

  if (a.hops > 0) {
    const anchored = a.witnesses.some((w) => w !== a.studentId && ctx.checkedIn.has(w));
    if (!anchored) {
      return reject("R9", "REJECT_NO_ANCHOR", "Nenhuma testemunha presente ancora o mesh.", {
        kind: "ORPHAN_CLUSTER",
        details: `aluno=${a.studentId} testemunhas=[${a.witnesses.join(",")}]`,
      });
    }
  }

  if (a.rssi != null && a.rssi < RSSI_REVISAR_ABAIXO) {
    return { ok: true, rule: "R10", code: "ACCEPT", reason: "Presença registrada; o professor vai confirmar (sinal fraco).", review: true };
  }
  return { ok: true, rule: "R10", code: "ACCEPT", reason: "Presença registrada." };
}
