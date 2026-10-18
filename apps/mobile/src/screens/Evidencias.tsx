import { useEffect, useState } from "react";
import { View } from "react-native";
import type { Api, AttemptRow, RuleInfo } from "../api";
import { CONFIDENCE_LABEL } from "../labels";
import { Chip, Row, SectionTitle, T, colors } from "../ui";

const TONE = { OBSERVADO: "ok", INFERIDO: "warn", PROJETO: "mute" } as const;

/** Painel de Evidências: as regras extraídas do Acadly e qual delas decidiu cada tentativa, ao vivo. */
export function EvidenceBoard({ api, attempts, names }: { api: Api; attempts: AttemptRow[]; names: Record<string, string> }) {
  const [rules, setRules] = useState<RuleInfo[]>([]);
  useEffect(() => {
    api.rules().then(setRules).catch(() => {});
  }, [api]);

  const count = (id: string) => attempts.filter((a) => a.rule === id).length;
  const last = attempts[0];

  return (
    <View style={{ gap: 4 }}>
      <SectionTitle>Última validação</SectionTitle>
      {last ? (
        <View style={{ borderLeftWidth: 4, borderLeftColor: last.ok ? colors.verde : colors.vermelho, paddingLeft: 12, gap: 2, paddingVertical: 4 }}>
          <T v="heading" c={last.ok ? colors.verde : colors.vermelho}>
            {last.ok ? "Aceito" : "Bloqueado"} pela regra {last.rule}
          </T>
          <T v="small" c={colors.mudo}>
            {names[last.studentId] ?? "Aluno"}: {last.reason}
          </T>
        </View>
      ) : (
        <T v="small" c={colors.mudo}>
          Ainda não houve tentativas nesta chamada.
        </T>
      )}

      <View style={{ paddingTop: 12 }}>
        <SectionTitle>Regras do Acadly</SectionTitle>
        <T v="small" c={colors.mudo} style={{ paddingBottom: 4 }}>
          Cada regra mostra de onde veio e quantas vezes decidiu nesta chamada.
        </T>
      </View>
      {rules.map((r, i) => {
        const n = count(r.id);
        const hot = last?.rule === r.id;
        return (
          <Row key={r.id} last={i === rules.length - 1}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: hot ? colors.azul : colors.azulClaro }}>
              <T v="small" c={hot ? colors.branco : colors.azul} style={{ fontFamily: "Outfit_700Bold" }}>
                {r.id}
              </T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="body" style={{ fontFamily: "Outfit_600SemiBold" }}>
                {r.title}
              </T>
              <T v="small" c={colors.mudo}>
                {r.description}
              </T>
              <View style={{ flexDirection: "row", gap: 6, paddingTop: 4, flexWrap: "wrap" }}>
                <Chip text={CONFIDENCE_LABEL[r.confidence]} tone={TONE[r.confidence]} />
                {n > 0 && <Chip text={n === 1 ? "decidiu 1 vez" : `decidiu ${n} vezes`} tone="info" />}
              </View>
            </View>
          </Row>
        );
      })}
    </View>
  );
}
