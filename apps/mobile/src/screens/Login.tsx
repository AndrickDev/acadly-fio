import { useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import type { Role } from "../api";
import { Button, Field, Hero, Segmented, T, colors } from "../ui";

export function Login({ baseUrl, setBaseUrl, busy, onLogin }: { baseUrl: string; setBaseUrl: (u: string) => void; busy: boolean; onLogin: (name: string, role: Role) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("ALUNO");
  const [showServer, setShowServer] = useState(false);
  const ok = name.trim().length >= 2;
  const go = () => ok && onLogin(name.trim(), role);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
      <Hero>
        <View style={{ paddingTop: 24, paddingBottom: 12, gap: 14 }}>
          {/* versão do logotipo para fundo azul: letras brancas, acentos laranja preservados */}
          <Image source={require("../../assets/unifio-logo-branco.png")} style={{ width: 224, height: 72 }} resizeMode="contain" accessibilityLabel="Unifio, Centro Universitário de Ourinhos" />
          <T v="title" c={colors.branco}>
            Chamada por proximidade
          </T>
          <T v="body" c={colors.sobreAzul}>
            Sem GPS, sem lista de papel, sem fila.
          </T>
        </View>
      </Hero>

      <View style={{ paddingHorizontal: 20, gap: 16, paddingBottom: 32 }}>
        <Segmented
          value={role}
          onChange={setRole}
          options={[
            { key: "ALUNO", label: "Sou aluno" },
            { key: "PROFESSOR", label: "Sou professor" },
          ]}
        />
        <Field placeholder="Seu nome" value={name} onChangeText={setName} onSubmitEditing={go} returnKeyType="go" autoCapitalize="words" />
        <Button title="Entrar" onPress={go} busy={busy} disabled={!ok} />

        <Pressable accessibilityRole="button" onPress={() => setShowServer((v) => !v)} hitSlop={8} style={{ alignSelf: "flex-start" }}>
          <T v="small" c={colors.azul} style={{ textDecorationLine: "underline" }}>
            {showServer ? "Ocultar servidor" : "Configurar servidor"}
          </T>
        </Pressable>
        {showServer && <Field placeholder="Endereço do servidor" autoCapitalize="none" autoCorrect={false} value={baseUrl} onChangeText={setBaseUrl} />}
      </View>
    </ScrollView>
  );
}
