import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Vibration, View } from "react-native";
import type { Activity, Api, ClassItem, Decision, OpenSession, RuleInfo } from "../api";
import { Poster } from "../poster";
import type { ProximityProvider } from "../proximity";
import { deviceId } from "../storage";
import { Button, Empty, Field, Hero, Orb, Panel, SectionTitle, SlantBar, T, colors, firstName, mmss, useInterval, type OrbState } from "../ui";

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
      const d = await api.checkin(o.id, { deviceId: dev, ...reading });
      setResult({ ...d, sessionId: o.id });
      if (d.ok) Vibration.vibrate(70);
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

  const o = open[0];
  const mine = o && result?.sessionId === o.id ? result : null;
  const done = !!mine && (mine.ok || mine.code === "REJECT_ALREADY_CHECKED_IN");
  const remaining = o ? Math.max(0, o.openedAt + o.windowMs - Date.now()) : 0;
  const orb: OrbState = !o ? "esperando" : busy ? "buscando" : done ? "feito" : "pronto";

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
      <Hero deep>
        <T v="small" c={colors.sobreAzul}>
          Olá, {firstName(userName)}
        </T>
        {o ? (
          <View style={{ gap: 10 }}>
            <T v="heading" c={colors.branco}>
              {o.className}
            </T>
            <T v="display" c={colors.branco} slant accessibilityLabel={`Faltam ${mmss(remaining)}`}>
              {mmss(remaining)}
            </T>
            <SlantBar ratio={remaining / o.windowMs} onDark />
          </View>
        ) : (
          <View style={{ gap: 4 }}>
            <T v="title" c={colors.branco} slant>
              Nenhuma chamada agora
            </T>
            <T v="small" c={colors.sobreAzul}>
              Quando o professor iniciar, ela aparece aqui. Deixe o app aberto.
            </T>
          </View>
        )}
      </Hero>

      <View style={{ marginTop: -150, alignItems: "center", zIndex: 2 }}>
        <Orb state={orb} onPress={() => o && checkIn(o)} />
      </View>

      <View style={{ paddingHorizontal: 20, gap: 4 }}>
        {done && (
          <View style={{ alignItems: "center", paddingBottom: 12 }}>
            <T v="heading">Presença registrada</T>
            <T v="small" c={colors.mudo}>
              Regra {mine!.rule}: {ruleTitle(mine!.rule).toLowerCase() || "aceito"}.
            </T>
          </View>
        )}
        {mine && !done && (
          <Panel tone="warn">
            <T v="heading" c={colors.laranjaTexto}>
              Não foi possível registrar
            </T>
            <T v="small" c={colors.laranjaTexto}>
              {mine.reason} (regra {mine.rule}: {ruleTitle(mine.rule).toLowerCase()}).
            </T>
          </Panel>
        )}

        {open.slice(1).map((x) => (
          <Button key={x.id} title={`Marcar presença em ${x.className}`} kind="secondary" onPress={() => checkIn(x)} />
        ))}

        {open.map((s) =>
          (activities[s.id] ?? []).map((a) => (
            <View key={a.id} style={{ gap: 10, paddingBottom: 12 }}>
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
        {classes.map((k) => (
          <Poster key={k.id} name={k.name} />
        ))}

        <View style={{ paddingTop: 20, gap: 12 }}>
          <SectionTitle>Entrar em uma turma</SectionTitle>
          <Field placeholder="Código da turma" autoCapitalize="characters" value={code} onChangeText={setCode} onSubmitEditing={joinClass} returnKeyType="done" />
          <Button title="Entrar na turma" kind="brand" onPress={joinClass} disabled={code.trim().length < 4} />
        </View>
      </View>
    </ScrollView>
  );
}
