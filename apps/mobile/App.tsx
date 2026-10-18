import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { makeApi, type Role, type User } from "./src/api";
import { simulatedProvider } from "./src/proximity";
import { Aluno } from "./src/screens/Aluno";
import { Professor } from "./src/screens/Professor";
import { load, save } from "./src/storage";
import { Button, Card, H, Mute, c, s } from "./src/ui";

const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3333";

export default function App() {
  const [ready, setReady] = useState(false);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URL);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [u, t, url] = await Promise.all([load("user"), load("token"), load("baseUrl")]);
      if (url) setBaseUrl(url);
      if (u && t) {
        setUser(JSON.parse(u));
        setToken(t);
      }
      setReady(true);
    })();
  }, []);

  const api = useMemo(() => makeApi(baseUrl, token), [baseUrl, token]);
  const provider = useMemo(() => simulatedProvider(api), [api]);

  const login = async (role: Role) => {
    setBusy(true);
    try {
      await save("baseUrl", baseUrl);
      // reaproveita a conta já criada para este papel (senão cada "Sair" geraria um usuário novo)
      const known = await load(`uid_${role}`);
      const res = await makeApi(baseUrl, null).login(name.trim(), role, known ?? undefined);
      await Promise.all([save("user", JSON.stringify(res.user)), save("token", res.token), save(`uid_${role}`, res.user.id)]);
      setUser(res.user);
      setToken(res.token);
    } catch (e) {
      Alert.alert("Não conectou", `${e instanceof Error ? e.message : e}\n\nConfira o endereço do servidor e se o celular está na mesma rede.`);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await Promise.all([save("user", null), save("token", null)]);
    setUser(null);
    setToken(null);
  };

  if (!ready) return null;

  return (
    <SafeAreaProvider>
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="dark" />
      {!user ? (
        <View style={{ padding: 16, gap: 12, paddingTop: 48 }}>
          <Text style={{ fontSize: 30, fontWeight: "900", color: c.ink }}>Acadly Fio</Text>
          <Mute>Presença por proximidade, sem GPS.</Mute>
          <Card>
            <TextInput style={s.input} placeholder="Seu nome" value={name} onChangeText={setName} />
            <TextInput style={s.input} placeholder="Endereço do servidor" autoCapitalize="none" autoCorrect={false} value={baseUrl} onChangeText={setBaseUrl} />
            <Button title="Entrar como Professor" onPress={() => login("PROFESSOR")} busy={busy} disabled={name.trim().length < 2} />
            <Button title="Entrar como Aluno" kind="ghost" onPress={() => login("ALUNO")} busy={busy} disabled={name.trim().length < 2} />
          </Card>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingRight: 72 }}>
            <H>{user.name}</H>
            <Mute>{user.role === "PROFESSOR" ? "Professor" : "Aluno"}</Mute>
          </View>
          <View style={{ flex: 1 }}>{user.role === "PROFESSOR" ? <Professor api={api} /> : <Aluno api={api} provider={provider} />}</View>
          {/* rodapé: o botão flutuante do Expo Go cobre o canto superior direito */}
          <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.card }}>
            <Button title={`Sair e trocar de perfil (${user.role === "PROFESSOR" ? "Professor" : "Aluno"})`} kind="ghost" onPress={logout} />
          </View>
        </View>
      )}
    </SafeAreaView>
    </SafeAreaProvider>
  );
}
