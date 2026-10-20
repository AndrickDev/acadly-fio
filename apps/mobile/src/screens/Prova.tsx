import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Share, Switch, View, useWindowDimensions } from "react-native";
import type { Api, ClassItem, ExamItem } from "../api";
import { addEvent, ataText, hhmm, nextKind, openExam, saveLocalExam, stateOf, syncExam, type ExamState, type LocalExam } from "../exam";
import { Button, Chip, Empty, Field, Panel, SectionTitle, T, colors, useInterval } from "../ui";

/** Modo Prova: lista do fiscal que funciona sem internet e sincroniza depois. */
export function Prova({ api, cls }: { api: Api; cls: ClassItem }) {
  const [list, setList] = useState<ExamItem[]>([]);
  const [name, setName] = useState("");
  const [le, setLe] = useState<LocalExam | null>(null);
  const [ata, setAta] = useState(false);
  const [offline, setOffline] = useState(false); // simula a sala sem internet, para demonstrar
  const [busy, setBusy] = useState(false);
  const { width } = useWindowDimensions();
  const tileW = Math.floor((width - 40 - 20) / 3);
  const fail = (e: unknown) => Alert.alert("Não deu certo", e instanceof Error ? e.message : String(e));

  const loadList = useCallback(() => api.exams(cls.id).then(setList).catch(() => {}), [api, cls.id]);
  useEffect(() => {
    loadList();
  }, [loadList]);

  const open = async (id: string) => {
    setBusy(true);
    try {
      setLe(await openExam(api, id));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    if (name.trim().length < 2) return;
    try {
      const e = await api.createExam(cls.id, name.trim());
      setName("");
      await loadList();
      await open(e.id);
    } catch (e) {
      fail(e);
    }
  };

  const push = async (next: LocalExam) => {
    setLe(next);
    await saveLocalExam(next); // grava a cada toque: se o app fechar, nada se perde
  };
  const sync = useCallback(
    async (quiet = false) => {
      if (!le || offline || le.pending.length === 0) return;
      try {
        setLe(await syncExam(api, le));
      } catch (e) {
        if (!quiet) fail(e);
      }
    },
    [api, le, offline],
  );
  useInterval(() => sync(true), le && !offline && le.pending.length > 0 ? 5000 : null);

  /* ---------- lista de provas ---------- */
  if (!le) {
    return (
      <View style={{ gap: 14 }}>
        <Panel>
          <T v="heading">Prova sem internet</T>
          <T v="small" c={colors.mudo}>
            Baixe a lista antes da prova. Na sala, cada toque fica salvo no seu celular e é enviado quando a internet voltar.
          </T>
        </Panel>
        <SectionTitle>Nova prova</SectionTitle>
        <Field placeholder="Ex.: P1 de Cálculo" value={name} onChangeText={setName} onSubmitEditing={create} returnKeyType="done" />
        <Button title="Criar prova com a lista da turma" icon="document-text-outline" onPress={create} disabled={name.trim().length < 2} busy={busy} />
        <SectionTitle>Provas desta turma</SectionTitle>
        {list.length === 0 ? (
          <Empty title="Nenhuma prova ainda" text="Crie a primeira acima." />
        ) : (
          list.map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${e.name}`}
              onPress={() => open(e.id)}
              style={{ borderWidth: 1, borderColor: colors.linha, borderRadius: 14, backgroundColor: colors.superficie, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Ionicons name="document-text-outline" size={26} color={colors.acao} />
              <View style={{ flex: 1 }}>
                <T v="heading">{e.name}</T>
                <T v="small" c={colors.mudo}>
                  {e.alunos ?? 0} alunos · criada {new Date(e.createdAt).toLocaleDateString("pt-BR")}
                </T>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mudo} />
            </Pressable>
          ))
        )}
      </View>
    );
  }

  /* ---------- dentro da prova ---------- */
  const rows = le.roster.map((r) => ({ ...r, ...stateOf(le.events, r.studentId) }));
  const dentro = rows.filter((r) => r.state === "dentro").length;
  const entregou = rows.filter((r) => r.state === "entregou").length;
  const faltam = rows.length - dentro - entregou;

  const tap = (studentId: string, state: ExamState) => {
    const k = nextKind(state);
    if (k) push(addEvent(le, studentId, k));
  };
  const undo = (studentId: string, state: ExamState) => {
    if (state !== "ausente") push(addEvent(le, studentId, "ZERAR"));
  };

  const header = (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Button
          title="Voltar"
          kind="ghost"
          small
          icon="chevron-back"
          onPress={() => {
            if (ata) setAta(false);
            else {
              setLe(null);
              loadList();
            }
          }}
        />
        <T v="heading" style={{ flex: 1 }} numberOfLines={1}>
          {le.exam.name}
        </T>
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Chip text={offline ? "Sem internet (simulado)" : le.pending.length > 0 ? `${le.pending.length} por enviar` : "Tudo enviado"} tone={offline || le.pending.length > 0 ? "warn" : "ok"} />
        <Chip text="Salvo neste celular" tone="info" />
      </View>
    </View>
  );

  if (ata) {
    return (
      <View style={{ gap: 14 }}>
        {header}
        <SectionTitle>Ata da prova</SectionTitle>
        <View style={{ borderWidth: 1, borderColor: colors.linha, borderRadius: 14, backgroundColor: colors.superficie }}>
          <View style={{ flexDirection: "row", padding: 12, borderBottomWidth: 1, borderBottomColor: colors.linha }}>
            <T v="small" c={colors.mudo} style={{ flex: 1 }}>
              Aluno
            </T>
            <T v="small" c={colors.mudo} style={{ width: 56 }}>
              Entrou
            </T>
            <T v="small" c={colors.mudo} style={{ width: 56 }}>
              Saiu
            </T>
          </View>
          {rows.map((r, i) => (
            <View key={r.studentId} style={{ flexDirection: "row", padding: 12, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.linha }}>
              <T v="small" style={{ flex: 1 }} numberOfLines={1}>
                {r.name}
              </T>
              <T v="small" c={r.state === "ausente" ? colors.vermelho : colors.tinta} style={{ width: 56 }}>
                {hhmm(r.enteredAt)}
              </T>
              <T v="small" c={r.state === "dentro" ? colors.laranjaTexto : colors.tinta} style={{ width: 56 }}>
                {r.state === "dentro" ? "dentro" : hhmm(r.leftAt)}
              </T>
            </View>
          ))}
        </View>
        <Button title="Compartilhar ata (texto)" icon="share-outline" onPress={() => Share.share({ title: le.exam.name, message: ataText(le) }).catch(() => {})} />
        <T v="small" c={colors.mudo}>
          O PDF para assinar e arquivar vem na próxima etapa. Se a secretaria aceitar a ata digital, o papel deixa de ser necessário.
        </T>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {header}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
          { n: dentro, l: "Fazendo", c: colors.acao },
          { n: entregou, l: "Entregaram", c: colors.verde },
          { n: faltam, l: "Faltam", c: colors.mudo },
        ].map((x) => (
          <View key={x.l} style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.linha, backgroundColor: colors.superficie, padding: 12, alignItems: "center" }}>
            <T v="title" c={x.c} slant>
              {x.n}
            </T>
            <T v="small" c={colors.mudo}>
              {x.l}
            </T>
          </View>
        ))}
      </View>

      <T v="small" c={colors.mudo}>
        Toque para registrar: 1º toque entrou, 2º entregou. Segure para desfazer.
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {rows.map((r) => {
          const done = r.state === "entregou";
          const inside = r.state === "dentro";
          const parts = r.name.trim().split(/\s+/);
          const short = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
          return (
            <Pressable
              key={r.studentId}
              accessibilityRole="button"
              accessibilityLabel={`${r.name}, ${r.state === "ausente" ? "ainda não entrou" : inside ? "fazendo a prova" : "entregou"}. ${done ? "Segure para desfazer" : "Toque para registrar"}`}
              onPress={() => tap(r.studentId, r.state)}
              onLongPress={() => undo(r.studentId, r.state)}
              style={{ width: tileW, height: 92 }}
            >
              <View style={{ flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: done ? colors.azul : inside ? colors.acao : colors.linha, backgroundColor: done ? colors.azul : inside ? colors.laranjaClaro : "transparent", transform: [{ skewX: "-6deg" }] }}>
                <View style={{ flex: 1, transform: [{ skewX: "6deg" }], alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 4 }}>
                  <Ionicons name={done ? "checkmark-done" : inside ? "pencil" : "ellipse-outline"} size={20} color={done || inside ? colors.acao : colors.mudo} />
                  <T v="small" c={done ? colors.branco : inside ? colors.tinta : colors.mudo} numberOfLines={1} style={{ fontSize: 13, lineHeight: 17 }}>
                    {short}
                  </T>
                  <T v="small" c={done ? colors.sobreAzul : colors.mudo} style={{ fontSize: 11, lineHeight: 14 }}>
                    {done ? `saiu ${hhmm(r.leftAt)}` : inside ? `entrou ${hhmm(r.enteredAt)}` : "—"}
                  </T>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4, gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T v="body">Simular sala sem internet</T>
          <T v="small" c={colors.mudo}>
            Para demonstrar: os toques ficam salvos e sobem quando você desliga.
          </T>
        </View>
        <Switch value={offline} onValueChange={setOffline} trackColor={{ true: colors.acao }} accessibilityLabel="Simular sala sem internet" />
      </View>
      <Button title={le.pending.length > 0 ? `Enviar agora (${le.pending.length})` : "Tudo enviado"} kind="secondary" icon="cloud-upload-outline" onPress={() => sync(false)} disabled={offline || le.pending.length === 0} />
      <Button title="Ver a ata" icon="list-outline" onPress={() => setAta(true)} />
    </View>
  );
}
