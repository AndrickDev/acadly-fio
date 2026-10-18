import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import type { Activity, Api, ClassItem, Decision, OpenSession, RuleInfo } from "../api";
import type { ProximityProvider } from "../proximity";
import { deviceId } from "../storage";
import { Avatar, Button, Empty, Field, Hero, Row, SectionTitle, SlantBar, T, colors, firstName, mmss, useInterval } from "../ui";

export function Aluno({ api, provider, userName }: { api: Api; provider: ProximityProvider; userName: string }) {
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
      setResult({ ...(await api.checkin(o.id, { deviceId: dev, ...reading })), sessionId: o.id });
    } catch (e) {
      Alert.alert("Não foi possível marcar", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const joinClass = async () => {
    if (code.trim().length < 4) return;
    try {
      await api.joinClass(code.trim());
      setCode("");
      refresh();
    } catch (e) {
      Alert.alert("Não deu certo", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
      <Hero>
        <T v="small" c={colors.sobreAzul}>
          Aluno
        </T>
        <T v="title" c={colors.branco}>
          Olá, {firstName(userName)}
        </T>

        {open.length === 0 ? (
          <View style={{ gap: 4, paddingTop: 10 }}>
            <T v="heading" c={colors.branco}>
              Nenhuma chamada agora
            </T>
            <T v="small" c={colors.sobreAzul}>
              Quando o professor iniciar, ela aparece aqui. Deixe o app aberto.
            </T>
          </View>
        ) : (
          open.map((o) => {
            const remaining = Math.max(0, o.openedAt + o.windowMs - Date.now());
            const mine = result?.sessionId === o.id ? result : null;
            const done = !!mine && (mine.ok || mine.code === "REJECT_ALREADY_CHECKED_IN");
            return (
              <View key={o.id} style={{ gap: 12, paddingTop: 10 }}>
                <T v="heading" c={colors.branco}>
                  {o.className}
                </T>
                <T v="display" c={colors.branco} accessibilityLabel={`Faltam ${mmss(remaining)}`}>
                  {mmss(remaining)}
                </T>
                <SlantBar ratio={remaining / o.windowMs} onDark />

                {done ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                    <Ionicons name="checkmark-circle" size={36} color={colors.branco} />
                    <View style={{ flex: 1 }}>
                      <T v="heading" c={colors.branco}>
                        Presença registrada
                      </T>
                      <T v="small" c={colors.sobreAzul}>
                        Regra {mine!.rule}, {ruleTitle(mine!.rule).toLowerCase() || "aceito"}.
                      </T>
                    </View>
                  </View>
                ) : (
                  <Button title={busy ? "Procurando o professor" : "Marcar presença"} kind="onDark" icon="radio" busy={busy} onPress={() => checkIn(o)} />
                )}

                {mine && !done && (
                  <View style={{ backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 14, padding: 14, gap: 2 }}>
                    <T v="heading" c={colors.branco}>
                      Não foi possível registrar
                    </T>
                    <T v="small" c={colors.sobreAzul}>
                      {mine.reason}
                    </T>
                    <T v="small" c={colors.sobreAzul}>
                      Regra {mine.rule}: {ruleTitle(mine.rule)}
                    </T>
                  </View>
                )}
              </View>
            );
          })
        )}
      </Hero>

      <View style={{ paddingHorizontal: 20, gap: 4 }}>
        {open.map((o) =>
          (activities[o.id] ?? []).map((a) => (
            <View key={a.id} style={{ gap: 8, paddingBottom: 16 }}>
              <SectionTitle>Enquete</SectionTitle>
              <T v="body">{a.prompt}</T>
              {a.options.map((opt, i) => (
                <Button key={i} title={opt} kind="secondary" onPress={() => api.respond(a.id, i).then(() => Alert.alert("Resposta enviada")).catch((e) => Alert.alert("Não deu certo", String(e.message)))} />
              ))}
            </View>
          )),
        )}

        <SectionTitle>Minhas turmas</SectionTitle>
        {classes.length === 0 && <Empty title="Você ainda não está em nenhuma turma" text="Peça o código ao professor e digite abaixo." />}
        {classes.map((k, i) => (
          <Row key={k.id} last={i === classes.length - 1}>
            <Avatar name={k.name} />
            <T v="body" style={{ fontFamily: "Outfit_600SemiBold", flex: 1 }}>
              {k.name}
            </T>
          </Row>
        ))}

        <View style={{ paddingTop: 24, gap: 12 }}>
          <SectionTitle>Entrar em uma turma</SectionTitle>
          <Field placeholder="Código da turma" autoCapitalize="characters" value={code} onChangeText={setCode} onSubmitEditing={joinClass} returnKeyType="done" />
          <Button title="Entrar na turma" kind="secondary" onPress={joinClass} disabled={code.trim().length < 4} />
        </View>
      </View>
    </ScrollView>
  );
}
