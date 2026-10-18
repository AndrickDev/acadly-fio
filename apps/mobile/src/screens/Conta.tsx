import { ScrollView, View } from "react-native";
import type { User } from "../api";
import { Avatar, Button, Chip, Hero, Row, T, colors } from "../ui";

export function Conta({ user, baseUrl, onLogout }: { user: User; baseUrl: string; onLogout: () => void }) {
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
      <View style={{ paddingHorizontal: 20, gap: 4 }}>
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
            <Chip text="Protótipo, detecção simulada" tone="warn" />
          </View>
        </Row>
        <View style={{ paddingTop: 24 }}>
          <Button title="Sair da conta" kind="danger" icon="log-out-outline" onPress={onLogout} />
        </View>
      </View>
    </ScrollView>
  );
}
