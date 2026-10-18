/** Textos em português simples para o que o servidor devolve em código. */
export const ALERT_LABEL: Record<string, string> = {
  DUPLICATE_DEVICE: "Mesmo aparelho usado por dois alunos",
  BURST: "Muitas tentativas seguidas",
  ORPHAN_CLUSTER: "Sinal sem nenhum colega presente por perto",
  STALE_TOKEN_REPLAY: "Código antigo reaproveitado",
};

export const CONFIDENCE_LABEL = { OBSERVADO: "Observado no Acadly", INFERIDO: "Inferido", PROJETO: "Decisão da Fio" } as const;
