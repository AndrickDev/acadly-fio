import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, Text, TextInput, View } from "react-native";
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
      const res = await makeApi(baseUrl, null).login(name.trim(), role);
      await Promise.all([save("user", JSON.stringify(res.user)), save("token", res.token)]);
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
          <View style={[s.row, { justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12 }]}>
            <View>
              <H>{user.name}</H>
              <Mute>{user.role === "PROFESSOR" ? "Professor" : "Aluno"}</Mute>
            </View>
            <Button title="Sair" kind="ghost" onPress={logout} style={{ minHeight: 36 }} />
          </View>
          {user.role === "PROFESSOR" ? <Professor api={api} /> : <Aluno api={api} provider={provider} />}
        </View>
      )}
    </SafeAreaView>
  );
}
