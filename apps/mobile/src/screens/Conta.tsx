import { ScrollView, View } from "react-native";
import type { CallMode, User } from "../api";
import type { ThemePref } from "../theme";
import { Avatar, Button, Chip, Hero, Row, Segmented, SectionTitle, T, colors } from "../ui";

export function Conta({ user, baseUrl, themePref, onTheme, providerLabel, mode, onMode, onLab, onLogout }: { user: User; baseUrl: string; themePref: ThemePref; onTheme: (t: ThemePref) => void; providerLabel: string; mode: CallMode; onMode: (m: CallMode) => void; onLab: () => void; onLogout: () => void }) {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <Hero>
        <Avatar name={user.name} size={64} />
        <T v="title" c={colors.branco}>
          {user.name}
        </T>
        <T v="small" c={colors.sobreAzul}>
          {user.role === "PROFESSOR" ? "Professor" : "Aluno"}
        </T>
      </Hero>
      <View style={{ paddingHorizontal: 20, gap: 8 }}>
        <SectionTitle>Aparência</SectionTitle>
        <Segmented
          value={themePref}
          onChange={onTheme}
          options={[
            { key: "escuro", label: "Escuro" },
            { key: "claro", label: "Claro" },
            { key: "sistema", label: "Sistema" },
          ]}
        />

        {user.role === "PROFESSOR" && (
          <>
            <SectionTitle>Modo da chamada</SectionTitle>
            <Segmented
              value={mode}
              onChange={onMode}
              options={[
                { key: "DIRETO", label: "Direto" },
                { key: "REPASSE", label: "Repasse" },
              ]}
            />
            <T v="small" c={colors.mudo}>
              {mode === "DIRETO" ? "Os alunos ouvem o seu celular. Serve para salas comuns." : "Para salas grandes: os alunos repassam o sinal. Ainda não existe; por ora age como Direto."}
            </T>
          </>
        )}

        <View style={{ paddingTop: 12 }}>
          <Row>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="small" c={colors.mudo}>
                Servidor
              </T>
              <T v="body">{baseUrl}</T>
            </View>
          </Row>
          <Row last>
            <View style={{ flex: 1, gap: 4 }}>
              <T v="small" c={colors.mudo}>
                Versão
              </T>
              <Chip text={providerLabel === "Bluetooth" ? "Protótipo, Bluetooth" : "Protótipo, detecção simulada"} tone="warn" />
            </View>
          </Row>
        </View>

        <View style={{ paddingTop: 16, gap: 12 }}>
          <Button title="Laboratório Bluetooth" kind="secondary" icon="bluetooth-outline" onPress={onLab} />
          <Button title="Sair da conta" kind="danger" icon="log-out-outline" onPress={onLogout} />
        </View>
      </View>
    </ScrollView>
  );
}
