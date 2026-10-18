import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { Api, AttemptRow, RuleInfo } from "../api";
import { Badge, Card, H, Mute, c } from "../ui";

const CONF_COLOR = { OBSERVADO: c.ok, INFERIDO: c.warn, PROJETO: c.mute } as const;

/** Painel de Evidências do Acadly: catálogo R1..R10 e qual regra decidiu cada tentativa, ao vivo. */
export function EvidenceBoard({ api, attempts, names }: { api: Api; attempts: AttemptRow[]; names: Record<string, string> }) {
  const [rules, setRules] = useState<RuleInfo[]>([]);
  useEffect(() => {
    api.rules().then(setRules).catch(() => {});
  }, [api]);

  const count = (id: string) => attempts.filter((a) => a.rule === id).length;
  const last = attempts[0];

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <H>Painel de Evidências</H>
        <Mute>Regras extraídas do Acadly (EVIDENCE.md) e a regra que decidiu cada validação.</Mute>
        {last ? (
          <View style={{ borderLeftWidth: 4, borderLeftColor: last.ok ? c.ok : c.bad, paddingLeft: 10, marginTop: 4 }}>
            <Text style={{ fontWeight: "800", color: last.ok ? c.ok : c.bad }}>
              Última: {last.rule} · {last.ok ? "ACEITO" : "BLOQUEADO"}
            </Text>
            <Text style={{ color: c.ink }}>
              {names[last.studentId] ?? "aluno"} — {last.reason}
            </Text>
          </View>
        ) : (
          <Mute>Nenhuma tentativa ainda nesta sessão.</Mute>
        )}
      </Card>

      {rules.map((r) => {
        const n = count(r.id);
        const hot = last?.rule === r.id;
        return (
          <Card key={r.id} style={{ borderColor: hot ? c.brand : c.line, borderWidth: hot ? 2 : 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={{ fontWeight: "900", color: c.brand }}>{r.id}</Text>
              <Text style={{ fontWeight: "700", color: c.ink, flexShrink: 1 }}>{r.title}</Text>
              <Badge text={r.confidence} color={CONF_COLOR[r.confidence]} />
              {n > 0 && <Badge text={`${n}×`} color={c.brand} />}
            </View>
            <Mute>{r.description}</Mute>
          </Card>
        );
      })}
    </View>
  );
}
