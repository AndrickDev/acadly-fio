import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import type { Activity, Api, ClassItem, Decision, OpenSession, RuleInfo } from "../api";
import type { ProximityProvider } from "../proximity";
import { deviceId } from "../storage";
import { Badge, Button, Card, H, Mute, c, mmss, s, useInterval } from "../ui";

export function Aluno({ api, provider }: { api: Api; provider: ProximityProvider }) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [open, setOpen] = useState<OpenSession[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(Decision & { sessionId: string }) | null>(null);
  const [rules, setRules] = useState<RuleInfo[]>([]);
  const [activities, setActivities] = useState<Record<string, Activity[]>>({});
  const [, tick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [cl, os] = await Promise.all([api.myClasses(), api.openSessions()]);
      setClasses(cl);
      setOpen(os);
      const acts: Record<string, Activity[]> = {};
      for (const o of os) acts[o.id] = (await api.activities(o.id)).filter((a) => a.state === "ABERTA");
      setActivities(acts);
    } catch {
      /* sem rede */
    }
  }, [api]);

  useEffect(() => {
    refresh();
    api.rules().then(setRules).catch(() => {});
  }, [refresh, api]);
  useInterval(refresh, 3000);
  useInterval(() => tick((n) => n + 1), open.length ? 500 : null);

  const ruleTitle = (id: string) => rules.find((r) => r.id === id)?.title ?? "";

  const checkIn = async (o: OpenSession) => {
    setBusy(true);
    setResult(null);
    try {
      const [reading, dev] = await Promise.all([provider.scan(o.id), deviceId()]);
      const d = await api.checkin(o.id, { deviceId: dev, ...reading });
      setResult({ ...d, sessionId: o.id });
    } catch (e) {
      Alert.alert("Não foi possível marcar", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const done = result?.ok || result?.code === "REJECT_ALREADY_CHECKED_IN";

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>
      {open.length === 0 ? (
        <Card>
          <H>Nenhuma chamada aberta</H>
          <Mute>Quando o professor iniciar a chamada, ela aparece aqui. Mantenha o app aberto e o Bluetooth ligado.</Mute>
        </Card>
      ) : (
        open.map((o) => {
          const remaining = o.openedAt + o.windowMs - Date.now();
          return (
            <Card key={o.id} style={{ borderColor: c.ok, borderWidth: 2 }}>
              <View style={s.row}>
                <Badge text="CHAMADA ABERTA" color={c.ok} />
                <Text style={{ fontSize: 22, fontWeight: "900", color: c.ink }}>{mmss(remaining)}</Text>
              </View>
              <Text style={{ fontWeight: "800", fontSize: 18, color: c.ink }}>{o.className}</Text>
              <Mute>Detecção: {provider.label}</Mute>
              <Button title={done && result?.sessionId === o.id ? "Presença registrada ✓" : "Marcar presença"} onPress={() => checkIn(o)} busy={busy} disabled={done && result?.sessionId === o.id} />

              {result && result.sessionId === o.id && (
                <View style={{ borderLeftWidth: 4, borderLeftColor: done ? c.ok : c.bad, paddingLeft: 10 }}>
                  <Text style={{ fontWeight: "800", color: done ? c.ok : c.bad }}>{done ? "Presente" : "Bloqueado"}</Text>
                  <Text style={{ color: c.ink }}>{result.reason}</Text>
                  <Mute>
                    Regra {result.rule}
                    {ruleTitle(result.rule) ? ` · ${ruleTitle(result.rule)}` : ""}
                  </Mute>
                </View>
              )}

              {(activities[o.id] ?? []).map((a) => (
                <View key={a.id} style={{ gap: 6, marginTop: 8 }}>
                  <Text style={{ fontWeight: "700", color: c.ink }}>{a.prompt}</Text>
                  {a.options.map((opt, i) => (
                    <Button key={i} title={opt} kind="ghost" onPress={() => api.respond(a.id, i).then(() => Alert.alert("Resposta enviada")).catch((e) => Alert.alert("Erro", String(e.message)))} />
                  ))}
                </View>
              ))}
            </Card>
          );
        })
      )}

      <H>Minhas turmas</H>
      {classes.map((k) => (
        <Card key={k.id}>
          <Text style={{ fontWeight: "700", color: c.ink }}>{k.name}</Text>
        </Card>
      ))}
      <Card>
        <TextInput style={s.input} placeholder="Código da turma" autoCapitalize="characters" value={code} onChangeText={setCode} />
        <Button
          title="Entrar na turma"
          disabled={code.trim().length < 4}
          onPress={async () => {
            try {
              await api.joinClass(code.trim());
              setCode("");
              refresh();
            } catch (e) {
              Alert.alert("Erro", e instanceof Error ? e.message : String(e));
            }
          }}
        />
      </Card>
    </ScrollView>
  );
}
