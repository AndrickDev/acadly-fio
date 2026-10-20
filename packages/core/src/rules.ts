import type { RuleId } from "./types";

export const MAX_HOPS = 3;
export const DEFAULT_WINDOW_MS = 120_000;
export const TOKEN_SLOT_MS = 5_000;
export const RATE_WINDOW_MS = 10_000;
export const RATE_MAX_ATTEMPTS = 5;
/** Tamanho do token em hex. 12 = 6 bytes, o que cabe no anúncio Bluetooth (docs/bluetooth.md). */
export const TOKEN_HEX_LEN = 12;
/**
 * PROVISÓRIO, NÃO CALIBRADO: abaixo disso (dBm) a presença vai para revisão do professor.
 * Só vale depois das medições em sala (docs/bluetooth.md); o RSSI varia muito com aparelho, bolso e posição.
 */
export const RSSI_REVISAR_ABAIXO = -80;

export type Confidence = "OBSERVADO" | "INFERIDO" | "PROJETO";

export interface RuleInfo {
  id: RuleId;
  title: string;
  description: string;
  confidence: Confidence;
  source?: string;
}

/** Catálogo exibido no Painel de Evidências. Espelha EVIDENCE.md §3. */
export const RULES: readonly RuleInfo[] = [
  { id: "R1", title: "Sessão existe", description: "A sessão informada precisa existir.", confidence: "PROJETO" },
  {
    id: "R2",
    title: "Janela ativa",
    description: "Sessão ABERTA e agora < abertura + janela (padrão 120 s).",
    confidence: "OBSERVADO",
    source: "https://moodle-lti.acadly.com/faq.html",
  },
  { id: "R3", title: "Aluno matriculado", description: "O aluno precisa estar matriculado na turma.", confidence: "INFERIDO" },
  { id: "R4", title: "Limite de tentativas", description: "Até 5 tentativas por dispositivo a cada 10 s.", confidence: "PROJETO" },
  { id: "R5", title: "Um check-in por aluno", description: "Cada aluno marca presença uma vez por sessão.", confidence: "INFERIDO" },
  {
    id: "R6",
    title: "Dispositivo único",
    description: "Um deviceId só pode ser usado por um aluno por sessão (anti celular-do-amigo).",
    confidence: "PROJETO",
  },
  { id: "R7", title: "Token de proximidade", description: "Token HMAC rotativo (5 s, ±1 slot) emitido pelo professor.", confidence: "PROJETO" },
  { id: "R8", title: "Limite de saltos", description: "No máximo 3 saltos no mesh até o professor.", confidence: "PROJETO" },
  {
    id: "R9",
    title: "Âncora do mesh",
    description: "Com hops > 0, ao menos uma testemunha já está presente (impede clusters fantasmas).",
    confidence: "PROJETO",
  },
  { id: "R10", title: "Aceito", description: "Todas as regras passaram; check-in AUTO gravado. Com sinal fraco, fica marcado para o professor revisar.", confidence: "PROJETO" },
] as const;
