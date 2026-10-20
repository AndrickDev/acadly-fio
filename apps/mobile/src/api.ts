export type Role = "PROFESSOR" | "ALUNO";
export interface User {
  id: string;
  name: string;
  role: Role;
}
export interface ClassItem {
  id: string;
  name: string;
  joinCode: string;
}
/** Como a chamada descobre os alunos. REPASSE (mesh) ainda não existe: por ora age como DIRETO. */
export type CallMode = "DIRETO" | "REPASSE";
export interface SessionInfo {
  id: string;
  classId: string;
  state: "CRIADA" | "ABERTA" | "FINALIZADA";
  openedAt: number | null;
  closedAt: number | null;
  windowMs: number;
  mode?: CallMode;
  presentes?: number;
  serverNow?: number;
}
export interface OpenSession {
  id: string;
  classId: string;
  className: string;
  openedAt: number;
  windowMs: number;
}
export interface AttendanceRow {
  studentId: string;
  name: string;
  present: boolean;
  method: "AUTO" | "MANUAL" | null;
  hops: number | null;
  rssi: number | null;
  /** aceito com sinal fraco: o professor confirma */
  review: boolean | null;
  at: number | null;
}
export interface AttemptRow {
  id: string;
  studentId: string;
  ok: boolean;
  rule: string;
  code: string;
  reason: string;
  at: number;
}
export interface AlertRow {
  id: string;
  kind: string;
  details: string;
  at: number;
}
export interface Decision {
  ok: boolean;
  rule: string;
  code: string;
  reason: string;
  review?: boolean;
}
export interface RuleInfo {
  id: string;
  title: string;
  description: string;
  confidence: "OBSERVADO" | "INFERIDO" | "PROJETO";
}
export interface Activity {
  id: string;
  prompt: string;
  options: string[];
  state: "ABERTA" | "ENCERRADA";
  tally: number[];
}

export type ExamKind = "ENTROU" | "ENTREGOU" | "ZERAR";
export interface ExamEvent {
  id: string;
  studentId: string;
  kind: ExamKind;
  at: number;
}
export interface ExamItem {
  id: string;
  name: string;
  createdAt: number;
  alunos?: number;
}
export interface ExamDownload {
  exam: { id: string; classId: string; name: string; createdAt: number };
  roster: { studentId: string; name: string }[];
  events: ExamEvent[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: any,
  ) {
    super(body?.reason ?? body?.error ?? `HTTP ${status}`);
  }
}

export function makeApi(baseUrl: string, token: string | null, onUnauthorized?: () => void) {
  const base = baseUrl.replace(/\/+$/, "");
  async function req<T>(method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(base + path, {
        method,
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && token) onUnauthorized?.(); // sessão salva que o servidor não reconhece mais
      if (!res.ok && !okStatuses.includes(res.status)) throw new ApiError(res.status, data);
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    login: (name: string, role: Role, userId?: string) => req<{ user: User; token: string }>("POST", "/auth/login", { name, role, userId }),
    rules: () => req<RuleInfo[]>("GET", "/rules"),
    myClasses: () => req<ClassItem[]>("GET", "/me/classes"),
    createClass: (name: string) => req<ClassItem>("POST", "/classes", { name }),
    joinClass: (code: string) => req<ClassItem>("POST", "/classes/join", { code }),
    openSessions: () => req<OpenSession[]>("GET", "/me/open-sessions"),
    createSession: (classId: string, windowMs = 120_000, mode: CallMode = "DIRETO") => req<SessionInfo>("POST", `/classes/${classId}/sessions`, { windowMs, mode }),
    latestSession: (classId: string) => req<SessionInfo | null>("GET", `/classes/${classId}/sessions/latest`),
    openSession: (id: string) => req<SessionInfo>("POST", `/sessions/${id}/open`, {}),
    closeSession: (id: string) => req<SessionInfo>("POST", `/sessions/${id}/close`, {}),
    session: (id: string) => req<SessionInfo>("GET", `/sessions/${id}`),
    attendance: (id: string) => req<AttendanceRow[]>("GET", `/sessions/${id}/attendance`),
    attempts: (id: string) => req<{ attempts: AttemptRow[]; alerts: AlertRow[] }>("GET", `/sessions/${id}/attempts`),
    beacon: (id: string) => req<{ token: string; expiresAt: number }>("GET", `/sessions/${id}/beacon`),
    simBeacon: (id: string) => req<{ token: string }>("GET", `/sessions/${id}/sim-beacon`),
    manual: (id: string, studentId: string, present: boolean) => req("POST", `/sessions/${id}/manual`, { studentId, present }),
    // 422 = regra rejeitou; o corpo traz a decisão e deve ser mostrado, não tratado como erro de rede
    checkin: (id: string, body: { deviceId: string; token?: string; readings?: { token: string; rssi: number }[]; hops: number; witnesses: string[] }) =>
      req<Decision>("POST", `/sessions/${id}/checkin`, body, [422]),
    exams: (classId: string) => req<ExamItem[]>("GET", `/classes/${classId}/exams`),
    createExam: (classId: string, name: string) => req<ExamItem>("POST", `/classes/${classId}/exams`, { name }),
    exam: (id: string) => req<ExamDownload>("GET", `/exams/${id}`),
    sendExamEvents: (id: string, events: ExamEvent[]) => req<{ saved: number }>("POST", `/exams/${id}/events`, { events }),
    activities: (sessionId: string) => req<Activity[]>("GET", `/sessions/${sessionId}/activities`),
    createPoll: (sessionId: string, prompt: string, options: string[]) => req("POST", `/sessions/${sessionId}/activities`, { prompt, options }),
    respond: (activityId: string, choice: number) => req("POST", `/activities/${activityId}/respond`, { choice }),
    closePoll: (activityId: string) => req("POST", `/activities/${activityId}/close`, {}),
  };
}
export type Api = ReturnType<typeof makeApi>;
