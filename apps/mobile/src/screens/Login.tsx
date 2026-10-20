import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import type { Role } from "../api";
import { Button, Chip, Field, Hero, T, colors } from "../ui";

const ROLES: { key: Role; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "ALUNO", label: "Sou aluno", icon: "person-outline" },
  { key: "PROFESSOR", label: "Sou professor", icon: "easel-outline" },
];

/** DEMONSTRAÇÃO: contas de exemplo para mostrar o fluxo. O login real (Moodle/Google institucional) entra depois. */
const DEMO: Record<Role, { id: string; name: string }> = {
  PROFESSOR: { id: "helena.martins@unifio.edu.br", name: "Helena Martins" },
  ALUNO: { id: "2024010231", name: "Lucas Almeida" },
};

/** Nome exibido a partir do que foi digitado (o servidor ainda identifica só por nome). */
function nameFrom(id: string, role: Role): string {
  const t = id.trim();
  if (t === DEMO[role].id) return DEMO[role].name;
  if (t.includes("@"))
    return t
      .split("@")[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p[0].toUpperCase() + p.slice(1))
      .join(" ");
  return role === "ALUNO" ? `Aluno ${t}` : `Professor ${t}`;
}

export function Login({ baseUrl, setBaseUrl, busy, onLogin, onLab }: { baseUrl: string; setBaseUrl: (u: string) => void; busy: boolean; onLogin: (name: string, role: Role) => void; onLab: () => void }) {
  const [role, setRole] = useState<Role>("ALUNO");
  const [id, setId] = useState("");
  const [senha, setSenha] = useState("");
  const [showServer, setShowServer] = useState(false);
  const ok = id.trim().length >= 3 && senha.length >= 1;
  const go = () => ok && onLogin(nameFrom(id, role), role);
  const demo = () => onLogin(DEMO[role].name, role);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
      <Hero>
        <View style={{ paddingTop: 20, paddingBottom: 8, gap: 16 }}>
          {/* versão do logotipo para fundo azul: letras brancas, acentos laranja preservados */}
          <Image source={require("../../assets/unifio-logo-branco.png")} style={{ width: 224, height: 72 }} resizeMode="contain" accessibilityLabel="Unifio, Centro Universitário de Ourinhos" />
          <T v="title" c={colors.branco} slant style={{ fontSize: 34, lineHeight: 38 }}>
            Chamada na sala,{"\n"}sem papel e sem fila.
          </T>
        </View>
      </Hero>

      <View style={{ paddingHorizontal: 20, gap: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {ROLES.map((r) => {
            const on = r.key === role;
            return (
              <Pressable key={r.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setRole(r.key)} style={{ flex: 1, borderRadius: 16, borderWidth: 2, borderColor: on ? colors.acao : colors.linha, backgroundColor: on ? colors.laranjaClaro : colors.superficie, padding: 16, gap: 10 }}>
                <Ionicons name={r.icon} size={28} color={on ? colors.acao : colors.mudo} />
                <T v="heading" c={on ? colors.tinta : colors.mudo}>
                  {r.label}
                </T>
              </Pressable>
            );
          })}
        </View>

        <Field placeholder={role === "ALUNO" ? "RA ou e-mail institucional" : "E-mail institucional"} value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
        <Field placeholder="Senha" value={senha} onChangeText={setSenha} secureTextEntry onSubmitEditing={go} returnKeyType="go" />
        <Button title="Entrar" icon="arrow-forward" onPress={go} busy={busy} disabled={!ok} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.linha }} />
          <T v="small" c={colors.mudo}>
            ou
          </T>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.linha }} />
        </View>
        <Button title="Entrar com conta Google institucional" kind="secondary" icon="logo-google" onPress={demo} busy={busy} />

        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.linha, backgroundColor: colors.superficie, padding: 14, gap: 8 }}>
          <Chip text="Demonstração" tone="warn" />
          <T v="small" c={colors.mudo}>
            Este login é só para mostrar o fluxo: qualquer senha entra. No uso real, o acesso será com o RA e a senha do Moodle ou com a conta Google da Unifio.
          </T>
          <Pressable accessibilityRole="button" onPress={demo} hitSlop={8} style={{ alignSelf: "flex-start" }}>
            <T v="small" c={colors.azulTexto} style={{ textDecorationLine: "underline" }}>
              Entrar como {DEMO[role].name} ({role === "ALUNO" ? "aluno" : "professor"})
            </T>
          </Pressable>
        </View>

        <View style={{ gap: 10, paddingTop: 4 }}>
          <Pressable accessibilityRole="button" onPress={() => setShowServer((v) => !v)} hitSlop={8} style={{ alignSelf: "flex-start" }}>
            <T v="small" c={colors.azulTexto} style={{ textDecorationLine: "underline" }}>
              {showServer ? "Ocultar servidor" : "Configurar servidor"}
            </T>
          </Pressable>
          {showServer && <Field placeholder="Endereço do servidor" autoCapitalize="none" autoCorrect={false} value={baseUrl} onChangeText={setBaseUrl} />}
          <Pressable accessibilityRole="button" onPress={onLab} hitSlop={8} style={{ alignSelf: "flex-start" }}>
            <T v="small" c={colors.azulTexto} style={{ textDecorationLine: "underline" }}>
              Laboratório Bluetooth (teste)
            </T>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
