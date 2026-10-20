import * as Crypto from "expo-crypto";
import type { Api, ExamDownload, ExamEvent, ExamKind } from "./api";
import { load, save } from "./storage";

/**
 * Modo Prova: o fiscal registra no celular, sem depender de internet. Cada toque vira um evento com id próprio,
 * guardado no aparelho e enviado depois (o servidor ignora ids repetidos). Protótipo: usa o armazenamento seguro
 * do Android, que aguenta uma turma; para provas grandes trocar por banco local.
 */
export type ExamState = "ausente" | "dentro" | "entregou";

export interface LocalExam {
  exam: ExamDownload["exam"];
  roster: ExamDownload["roster"];
  events: ExamEvent[];
  /** ids dos eventos ainda não enviados */
  pending: string[];
}

const key = (id: string) => `exam_${id}`;

export async function loadLocalExam(id: string): Promise<LocalExam | null> {
  const raw = await load(key(id));
  try {
    return raw ? (JSON.parse(raw) as LocalExam) : null;
  } catch {
    return null;
  }
}
export const saveLocalExam = (e: LocalExam) => save(key(e.exam.id), JSON.stringify(e));

/** Baixa a lista; mantém o que já foi marcado no aparelho e ainda não foi enviado. */
export async function openExam(api: Api, id: string): Promise<LocalExam> {
  const local = await loadLocalExam(id);
  try {
    const d = await api.exam(id);
    const pending = local?.pending ?? [];
    const byId = new Map(d.events.map((e) => [e.id, e]));
    for (const e of local?.events ?? []) if (pending.includes(e.id)) byId.set(e.id, e);
    const merged: LocalExam = { exam: d.exam, roster: d.roster, events: [...byId.values()].sort((a, b) => a.at - b.at), pending };
    await saveLocalExam(merged);
    return merged;
  } catch (e) {
    if (local) return local; // sem rede: segue com o que está no aparelho
    throw e;
  }
}

export function stateOf(events: ExamEvent[], studentId: string): { state: ExamState; enteredAt?: number; leftAt?: number } {
  let state: ExamState = "ausente";
  let enteredAt: number | undefined;
  let leftAt: number | undefined;
  for (const e of events) {
    if (e.studentId !== studentId) continue;
    if (e.kind === "ENTROU") {
      state = "dentro";
      enteredAt = e.at;
      leftAt = undefined;
    } else if (e.kind === "ENTREGOU") {
      state = "entregou";
      leftAt = e.at;
      enteredAt ??= e.at;
    } else {
      state = "ausente";
      enteredAt = undefined;
      leftAt = undefined;
    }
  }
  return { state, enteredAt, leftAt };
}

export const nextKind = (s: ExamState): ExamKind | null => (s === "ausente" ? "ENTROU" : s === "dentro" ? "ENTREGOU" : null);

export function addEvent(le: LocalExam, studentId: string, kind: ExamKind, at = Date.now()): LocalExam {
  const ev: ExamEvent = { id: Crypto.randomUUID(), studentId, kind, at };
  return { ...le, events: [...le.events, ev].sort((a, b) => a.at - b.at), pending: [...le.pending, ev.id] };
}

/** Envia os eventos pendentes. Lança erro se a rede falhar; nesse caso nada é perdido. */
export async function syncExam(api: Api, le: LocalExam): Promise<LocalExam> {
  if (le.pending.length === 0) return le;
  const batch = le.events.filter((e) => le.pending.includes(e.id));
  await api.sendExamEvents(le.exam.id, batch);
  const done = { ...le, pending: le.pending.filter((id) => !batch.some((b) => b.id === id)) };
  await saveLocalExam(done);
  return done;
}

export const hhmm = (at?: number) => (at ? new Date(at).toTimeString().slice(0, 5) : "--:--");

/** Texto da ata para compartilhar (CSV simples). O PDF vem depois. */
export function ataText(le: LocalExam): string {
  const rows = le.roster.map((r) => {
    const s = stateOf(le.events, r.studentId);
    return `${r.name};${hhmm(s.enteredAt)};${hhmm(s.leftAt)};${s.state === "ausente" ? "não compareceu" : s.state === "dentro" ? "não entregou" : "entregou"}`;
  });
  return [`ATA: ${le.exam.name}`, "Aluno;Entrada;Saída;Situação", ...rows].join("\n");
}
