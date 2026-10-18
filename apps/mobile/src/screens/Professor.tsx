import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, View, useWindowDimensions } from "react-native";
import type { Activity, AlertRow, Api, AttemptRow, AttendanceRow, ClassItem, SessionInfo } from "../api";
import { ALERT_LABEL } from "../labels";
import { Poster } from "../poster";
import { Button, Chip, Empty, Field, Hero, IconButton, Panel, SectionTitle, Segmented, SlantBar, StudentTile, T, colors, firstName, mmss, presentLine, useInterval } from "../ui";
import { EvidenceBoard } from "./Evidencias";

export function Professor({ api, userName }: { api: Api; userName: string }) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [cls, setCls] = useState<ClassItem | null>(null);
  const [newName, setNewName] = useState("");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [roster, setRoster] = useState<AttendanceRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tab, setTab] = useState<"chamada" | "evidencias">("chamada");
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0); // serverNow - Date.now()
  const [, tick] = useState(0);
  const [windowMin, setWindowMin] = useState<"2" | "5" | "10">("2");
  const [pollPrompt, setPollPrompt] = useState("");
  const [pollOpts, setPollOpts] = useState("Sim, Não");
  const { width } = useWindowDimensions();
  const tileW = Math.floor((width - 40 - 20) / 3); // 3 colunas, 20 px de margem de cada lado, 10 px entre peças

  const fail = (e: unknown) => Alert.alert("Não deu certo", e instanceof Error ? e.message : String(e));

  const loadClasses = useCallback(() => api.myClasses().then(setClasses).catch(() => {}), [api]);
  useInterval(() => !cls && loadClasses(), 5000);
  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // ao abrir a turma, retoma a última chamada (a tela não guarda sessão entre aberturas)
  useEffect(() => {
    if (!cls) return;
    api.latestSession(cls.id).then((s) => s && setSession(s)).catch(() => {});
  }, [api, cls?.id]);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const [sess, ros, att, act] = await Promise.all([api.session(session.id), api.attendance(session.id), api.attempts(session.id), api.activities(session.id)]);
      setSession(sess);
      if (sess.serverNow) setOffset(sess.serverNow - Date.now());
      setRoster(ros);
      setAttempts(att.attempts);
      setAlerts(att.alerts);
      setActivities(act);
    } catch {
      /* sem rede: mantém a última leitura */
    }
  }, [api, session?.id]);
  useInterval(refresh, session ? 2000 : null);
  useInterval(() => tick((n) => n + 1), session?.state === "ABERTA" ? 500 : null);

  const names = useMemo(() => Object.fromEntries(roster.map((r) => [r.studentId, r.name])), [roster]);
  const present = roster.filter((r) => r.present).length;
  const isOpen = session?.state === "ABERTA";
  const remaining = isOpen && session.openedAt ? Math.max(0, session.openedAt + session.windowMs - (Date.now() + offset)) : 0;

  const startCall = async () => {
    if (!cls) return;
    setBusy(true);
    try {
      const created = await api.createSession(cls.id, Number(windowMin) * 60_000);
      setSession(await api.openSession(created.id));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const createClass = async () => {
    if (newName.trim().length < 2) return;
    try {
      await api.createClass(newName.trim());
      setNewName("");
      loadClasses();
    } catch (e) {
      fail(e);
    }
  };

  /* ---------- lista de turmas ---------- */
  if (!cls) {
    return (
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        <Hero>
          <T v="small" c={colors.sobreAzul}>
            Olá, {firstName(userName)}
          </T>
          <T v="title" c={colors.branco} slant>
            Suas turmas
          </T>
        </Hero>
        <View style={{ paddingHorizontal: 20, gap: 4 }}>
          {classes.length === 0 && <Empty title="Nenhuma turma ainda" text="Crie a primeira abaixo e passe o código para os alunos." />}
          {classes.map((k) => (
            <Poster key={k.id} name={k.name} sub={`Código ${k.joinCode}`} onPress={() => setCls(k)} />
          ))}

          <View style={{ paddingTop: 24 }}>
            <Panel>
              <SectionTitle>Nova turma</SectionTitle>
              <Field placeholder="Nome da turma" value={newName} onChangeText={setNewName} onSubmitEditing={createClass} returnKeyType="done" />
              <Button title="Criar turma" icon="add" onPress={createClass} disabled={newName.trim().length < 2} />
            </Panel>
          </View>
        </View>
      </ScrollView>
    );
  }

  /* ---------- turma aberta ---------- */
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
      <Hero>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginLeft: -8 }}>
          <IconButton
            icon="arrow-back"
            label="Voltar para as turmas"
            onPress={() => {
              setCls(null);
              setSession(null);
              setRoster([]);
            }}
          />
          <T v="title" c={colors.branco} style={{ flexShrink: 1 }}>
            {cls.name}
          </T>
        </View>
        <T v="small" c={colors.sobreAzul}>
          Código da turma {cls.joinCode}
        </T>

        {isOpen ? (
          <View style={{ gap: 12, paddingTop: 6 }}>
            <T v="small" c={colors.sobreAzul}>
              Chamada aberta
            </T>
            <T v="display" c={colors.branco} slant accessibilityLabel={`Faltam ${mmss(remaining)}`}>
              {mmss(remaining)}
            </T>
            <SlantBar ratio={remaining / (session?.windowMs ?? 1)} onDark />
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <T v="title" c={colors.acao} slant style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 40, lineHeight: 44 }}>
                {present}/{roster.length}
              </T>
              <T v="body" c={colors.sobreAzul}>
                presentes
              </T>
            </View>
            <Button title="Encerrar chamada" kind="outline" icon="stop-circle-outline" onPress={() => session && api.closeSession(session.id).then(setSession).catch(fail)} />
          </View>
        ) : (
          <View style={{ gap: 2, paddingTop: 6 }}>
            <T v="heading" c={colors.branco}>
              {session ? "Chamada encerrada" : "Nenhuma chamada em andamento"}
            </T>
            {session && (
              <T v="small" c={colors.sobreAzul}>
                {presentLine(present, roster.length)}.
              </T>
            )}
          </View>
        )}
      </Hero>

      <View style={{ paddingHorizontal: 20, gap: 16 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: "chamada", label: "Chamada" },
            { key: "evidencias", label: "Evidências" },
          ]}
        />

        {tab === "evidencias" ? (
          <EvidenceBoard api={api} attempts={attempts} names={names} />
        ) : (
          <>
            {!isOpen && (
              <Panel>
                <SectionTitle>{session ? "Nova chamada" : "Iniciar chamada"}</SectionTitle>
                <T v="small" c={colors.mudo}>
                  Tempo que os alunos têm para marcar presença.
                </T>
                <Segmented
                  value={windowMin}
                  onChange={setWindowMin}
                  options={[
                    { key: "2", label: "2 min" },
                    { key: "5", label: "5 min" },
                    { key: "10", label: "10 min" },
                  ]}
                />
                <Button title="Iniciar chamada" icon="radio" onPress={startCall} busy={busy} />
              </Panel>
            )}

            {alerts.length > 0 && (
              <Panel tone="warn">
                <T v="heading" c={colors.laranjaTexto}>
                  Para revisar ({alerts.length})
                </T>
                {alerts.slice(0, 5).map((a) => (
                  <View key={a.id} style={{ gap: 2 }}>
                    <T v="small" c={colors.laranjaTexto} style={{ fontFamily: "Outfit_600SemiBold" }}>
                      {ALERT_LABEL[a.kind] ?? a.kind}
                    </T>
                    <T v="small" c={colors.laranjaTexto}>
                      {a.details}
                    </T>
                  </View>
                ))}
              </Panel>
            )}

            {session && (
              <View style={{ gap: 12 }}>
                <SectionTitle right={<Chip text={`${present} de ${roster.length}`} tone="info" />}>A sala</SectionTitle>
                {roster.length === 0 ? (
                  <Empty title="Nenhum aluno na turma" text="Peça para os alunos entrarem com o código da turma." />
                ) : (
                  <>
                    <T v="small" c={colors.mudo}>
                      Toque num aluno para marcar ou desfazer a presença.
                    </T>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      {roster.map((r) => (
                        <StudentTile key={r.studentId} name={r.name} present={r.present} width={tileW} onPress={() => api.manual(session.id, r.studentId, !r.present).then(refresh).catch(fail)} />
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}

            {session && (
              <Panel>
                <SectionTitle>Enquete rápida</SectionTitle>
                <Field placeholder="Pergunta para a turma" value={pollPrompt} onChangeText={setPollPrompt} />
                <Field placeholder="Opções separadas por vírgula" value={pollOpts} onChangeText={setPollOpts} />
                <Button
                  title="Publicar enquete"
                  kind="brand"
                  disabled={pollPrompt.trim().length < 2}
                  onPress={async () => {
                    const opts = pollOpts.split(",").map((o) => o.trim()).filter(Boolean);
                    try {
                      await api.createPoll(session.id, pollPrompt.trim(), opts);
                      setPollPrompt("");
                      refresh();
                    } catch (e) {
                      fail(e);
                    }
                  }}
                />
                {activities.map((a) => (
                  <View key={a.id} style={{ gap: 6, paddingTop: 8 }}>
                    <T v="heading">{a.prompt}</T>
                    {a.options.map((o, i) => (
                      <T key={i} v="small" c={colors.mudo}>
                        {o}: {a.tally[i]}
                      </T>
                    ))}
                    {a.state === "ABERTA" ? <Button title="Encerrar enquete" kind="ghost" small onPress={() => api.closePoll(a.id).then(refresh).catch(fail)} /> : <Chip text="Encerrada" tone="mute" />}
                  </View>
                ))}
              </Panel>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
