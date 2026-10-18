import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import type { Activity, Api, AlertRow, AttemptRow, AttendanceRow, ClassItem, SessionInfo } from "../api";
import { Badge, Button, Card, H, Mute, c, mmss, s, useInterval } from "../ui";
import { EvidenceBoard } from "./Evidencias";

export function Professor({ api }: { api: Api }) {
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
  const [pollPrompt, setPollPrompt] = useState("");
  const [pollOpts, setPollOpts] = useState("Sim, Não");

  const fail = (e: unknown) => Alert.alert("Erro", e instanceof Error ? e.message : String(e));

  const loadClasses = useCallback(() => api.myClasses().then(setClasses).catch(() => {}), [api]);
  useInterval(() => !cls && loadClasses(), 5000);
  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

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

  const startCall = async () => {
    if (!cls) return;
    setBusy(true);
    try {
      const created = await api.createSession(cls.id);
      const opened = await api.openSession(created.id);
      setSession(opened);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const remaining = session?.state === "ABERTA" && session.openedAt ? session.openedAt + session.windowMs - (Date.now() + offset) : 0;

  if (!cls) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <H>Minhas turmas</H>
        {classes.map((k) => (
          <Card key={k.id}>
            <Text style={{ fontWeight: "800", fontSize: 17, color: c.ink }}>{k.name}</Text>
            <Mute>Código para os alunos entrarem: {k.joinCode}</Mute>
            <Button title="Abrir turma" onPress={() => setCls(k)} />
          </Card>
        ))}
        <Card>
          <TextInput style={s.input} placeholder="Nome da nova turma" value={newName} onChangeText={setNewName} />
          <Button
            title="Criar turma"
            disabled={newName.trim().length < 2}
            onPress={async () => {
              try {
                await api.createClass(newName.trim());
                setNewName("");
                loadClasses();
              } catch (e) {
                fail(e);
              }
            }}
          />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={s.row}>
        <Button
          title="‹ Turmas"
          kind="ghost"
          onPress={() => {
            setCls(null);
            setSession(null);
          }}
        />
        <Text style={{ fontWeight: "800", fontSize: 17, color: c.ink, flexShrink: 1 }}>{cls.name}</Text>
      </View>
      <Mute>Código da turma: {cls.joinCode}</Mute>

      <View style={s.row}>
        <Button title="Chamada" kind={tab === "chamada" ? "primary" : "ghost"} onPress={() => setTab("chamada")} style={{ flex: 1 }} />
        <Button title="Evidências" kind={tab === "evidencias" ? "primary" : "ghost"} onPress={() => setTab("evidencias")} style={{ flex: 1 }} />
      </View>

      {tab === "evidencias" ? (
        <EvidenceBoard api={api} attempts={attempts} names={names} />
      ) : (
        <>
          <Card>
            {!session || session.state === "FINALIZADA" ? (
              <>
                <H>{session ? "Chamada finalizada" : "Nenhuma chamada em andamento"}</H>
                {session && <Mute>{present} presentes de {roster.length}.</Mute>}
                <Button title={session ? "Iniciar nova chamada" : "Iniciar chamada"} onPress={startCall} busy={busy} />
              </>
            ) : (
              <>
                <View style={s.row}>
                  <Badge text="CHAMADA ABERTA" color={c.ok} />
                  <Text style={{ fontSize: 28, fontWeight: "900", color: c.ink }}>{mmss(remaining)}</Text>
                </View>
                <Mute>Alunos devem estar com o app aberto. Fecha sozinha ao fim do tempo.</Mute>
                <Button
                  title="Encerrar agora"
                  kind="danger"
                  onPress={() => api.closeSession(session.id).then(setSession).catch(fail)}
                />
              </>
            )}
          </Card>

          {alerts.length > 0 && (
            <Card style={{ borderColor: c.warn }}>
              <H>⚠ Alertas de anomalia ({alerts.length})</H>
              {alerts.slice(0, 5).map((a) => (
                <View key={a.id}>
                  <Badge text={a.kind} color={c.warn} />
                  <Mute>{a.details}</Mute>
                </View>
              ))}
            </Card>
          )}

          {session && (
            <Card>
              <H>
                Presença {present}/{roster.length}
              </H>
              {roster.map((r) => (
                <View key={r.studentId} style={[s.row, { justifyContent: "space-between", paddingVertical: 4 }]}>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={{ color: c.ink, fontWeight: "600" }}>{r.name}</Text>
                    {r.present && <Mute>{r.method === "MANUAL" ? "manual" : `automática · ${r.hops ?? 0} salto(s)`}</Mute>}
                  </View>
                  <Button
                    title={r.present ? "Presente ✓" : "Marcar"}
                    kind={r.present ? "ghost" : "primary"}
                    style={{ minHeight: 36, paddingHorizontal: 12 }}
                    onPress={() => api.manual(session.id, r.studentId, !r.present).then(refresh).catch(fail)}
                  />
                </View>
              ))}
              {roster.length === 0 && <Mute>Nenhum aluno matriculado ainda.</Mute>}
            </Card>
          )}

          {session && (
            <Card>
              <H>Enquete rápida</H>
              <TextInput style={s.input} placeholder="Pergunta" value={pollPrompt} onChangeText={setPollPrompt} />
              <TextInput style={s.input} placeholder="Opções separadas por vírgula" value={pollOpts} onChangeText={setPollOpts} />
              <Button
                title="Publicar enquete"
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
                <View key={a.id} style={{ gap: 4, paddingTop: 8 }}>
                  <Text style={{ fontWeight: "700", color: c.ink }}>{a.prompt}</Text>
                  {a.options.map((o, i) => (
                    <Mute key={i}>
                      {o}: {a.tally[i]}
                    </Mute>
                  ))}
                  {a.state === "ABERTA" ? <Button title="Encerrar enquete" kind="ghost" onPress={() => api.closePoll(a.id).then(refresh).catch(fail)} /> : <Badge text="ENCERRADA" color={c.mute} />}
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}
