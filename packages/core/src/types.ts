export type SessionState = "CRIADA" | "ABERTA" | "FINALIZADA";

export type RejectCode =
  | "REJECT_SESSION_NOT_FOUND"
  | "REJECT_OUT_OF_WINDOW"
  | "REJECT_NOT_ENROLLED"
  | "REJECT_RATE_LIMITED"
  | "REJECT_ALREADY_CHECKED_IN"
  | "REJECT_DUPLICATE_DEVICE"
  | "REJECT_INVALID_TOKEN"
  | "REJECT_TOO_MANY_HOPS"
  | "REJECT_NO_ANCHOR";

export type AlertKind =
  | "DUPLICATE_DEVICE"
  | "BURST"
  | "ORPHAN_CLUSTER"
  | "STALE_TOKEN_REPLAY";

export type RuleId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8" | "R9" | "R10";

export interface SessionSnapshot {
  id: string;
  classId: string;
  state: SessionState;
  openedAt: number | null;
  windowMs: number;
}

export interface CheckInAttempt {
  sessionId: string;
  studentId: string;
  deviceId: string;
  token: string;
  hops: number;
  /** studentIds de vizinhos ouvidos no mesh */
  witnesses: string[];
  /** força do sinal do professor (dBm) ouvida pelo aluno; ausente na detecção simulada */
  rssi?: number | null;
  now: number;
}

export interface ValidationContext {
  session: SessionSnapshot | null;
  enrolled: boolean;
  /** studentId -> deviceId dos check-ins já aceitos nesta sessão */
  checkedIn: ReadonlyMap<string, string>;
  /** tentativas recentes (últimos RATE_WINDOW_MS) deste deviceId, sem contar a atual */
  recentAttemptsForDevice: number;
  verifyToken: (token: string, sessionId: string, now: number) => "ok" | "invalid" | "stale";
}

export interface Decision {
  ok: boolean;
  rule: RuleId;
  code: RejectCode | "ACCEPT";
  reason: string;
  alert?: { kind: AlertKind; details: string };
  /** aceito, mas o professor deve revisar (sinal fraco) */
  review?: boolean;
}
