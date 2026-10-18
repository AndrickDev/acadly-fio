import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold, useFonts } from "@expo-google-fonts/outfit";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Alert, View, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { makeApi, type Role, type User } from "./src/api";
import { simulatedProvider } from "./src/proximity";
import { Aluno } from "./src/screens/Aluno";
import { Conta } from "./src/screens/Conta";
import { Laboratorio } from "./src/screens/Laboratorio";
import { Login } from "./src/screens/Login";
import { Professor } from "./src/screens/Professor";
import { load, save } from "./src/storage";
import { applyTheme, colors, type ThemeName, type ThemePref } from "./src/theme";
import { TabBar } from "./src/ui";

const DEFAULT_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3333";

export default function App() {
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold });
  const [ready, setReady] = useState(false);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URL);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"inicio" | "conta">("inicio");
  const [lab, setLab] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>("escuro");
  const system = useColorScheme();
  const theme: ThemeName = themePref === "sistema" ? (system === "light" ? "claro" : "escuro") : themePref;
  applyTheme(theme); // idempotente; a árvore remonta (key) quando o tema muda

  const chooseTheme = (t: ThemePref) => {
    setThemePref(t);
    save("theme", t);
  };

  useEffect(() => {
    (async () => {
      const [u, t, url, th] = await Promise.all([load("user"), load("token"), load("baseUrl"), load("theme")]);
      if (th === "claro" || th === "escuro" || th === "sistema") setThemePref(th);
      if (url) setBaseUrl(url);
      if (u && t) {
        setUser(JSON.parse(u));
        setToken(t);
      }
      setReady(true);
    })();
  }, []);


  const login = async (name: string, role: Role) => {
    setBusy(true);
    try {
      await save("baseUrl", baseUrl);
      // reaproveita a conta já criada para este papel (senão cada "Sair" geraria um usuário novo)
      const known = await load(`uid_${role}`);
      const res = await makeApi(baseUrl, null).login(name, role, known ?? undefined);
      await Promise.all([save("user", JSON.stringify(res.user)), save("token", res.token), save(`uid_${role}`, res.user.id)]);
      setUser(res.user);
      setToken(res.token);
      setTab("inicio");
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

  const api = useMemo(() => makeApi(baseUrl, token, logout), [baseUrl, token]);
  const provider = useMemo(() => simulatedProvider(api), [api]);

  if (!fontsLoaded || !ready) return <View style={{ flex: 1, backgroundColor: colors.hero }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View key={theme} style={{ flex: 1, backgroundColor: colors.fundo }}>
        {lab ? (
          <Laboratorio onBack={() => setLab(false)} />
        ) : !user ? (
          <Login baseUrl={baseUrl} setBaseUrl={setBaseUrl} busy={busy} onLogin={login} onLab={() => setLab(true)} />
        ) : (
          <>
            {/* as duas abas ficam montadas para não perder turma e chamada ao trocar de aba */}
            <View style={{ flex: 1, display: tab === "inicio" ? "flex" : "none" }}>
              {user.role === "PROFESSOR" ? <Professor api={api} userName={user.name} /> : <Aluno api={api} provider={provider} userName={user.name} />}
            </View>
            <View style={{ flex: 1, display: tab === "conta" ? "flex" : "none" }}>
              <Conta user={user} baseUrl={baseUrl} themePref={themePref} onTheme={chooseTheme} onLab={() => setLab(true)} onLogout={logout} />
            </View>
            <TabBar
              active={tab}
              onChange={setTab}
              tabs={[
                { key: "inicio", label: user.role === "PROFESSOR" ? "Turmas" : "Início", icon: user.role === "PROFESSOR" ? "school-outline" : "home-outline", iconOn: user.role === "PROFESSOR" ? "school" : "home" },
                { key: "conta", label: "Conta", icon: "person-outline", iconOn: "person" },
              ]}
            />
          </>
        )}
      </View>
    </SafeAreaProvider>
  );
}
