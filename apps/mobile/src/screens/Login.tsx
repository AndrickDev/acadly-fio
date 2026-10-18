import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import type { Role } from "../api";
import { Button, Field, Hero, T, colors } from "../ui";

const ROLES: { key: Role; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "ALUNO", label: "Sou aluno", icon: "person-outline" },
  { key: "PROFESSOR", label: "Sou professor", icon: "easel-outline" },
];

export function Login({ baseUrl, setBaseUrl, busy, onLogin, onLab }: { baseUrl: string; setBaseUrl: (u: string) => void; busy: boolean; onLogin: (name: string, role: Role) => void; onLab: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("ALUNO");
  const [showServer, setShowServer] = useState(false);
  const ok = name.trim().length >= 2;
  const go = () => ok && onLogin(name.trim(), role);

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
        <Field placeholder="Seu nome" value={name} onChangeText={setName} onSubmitEditing={go} returnKeyType="go" autoCapitalize="words" />
        <Button title="Entrar" icon="arrow-forward" onPress={go} busy={busy} disabled={!ok} />

        <View style={{ gap: 10, paddingTop: 8 }}>
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
