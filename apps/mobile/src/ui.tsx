import { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

export const c = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  ink: "#12141C",
  mute: "#6B7280",
  line: "#E5E7EB",
  brand: "#4F46E5",
  ok: "#059669",
  warn: "#D97706",
  bad: "#DC2626",
};

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function Button({ title, onPress, kind = "primary", busy, disabled, style }: { title: string; onPress: () => void; kind?: "primary" | "ghost" | "danger"; busy?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const bg = kind === "primary" ? c.brand : kind === "danger" ? c.bad : "transparent";
  const fg = kind === "ghost" ? c.brand : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1, borderWidth: kind === "ghost" ? 1 : 0, borderColor: c.brand }, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => <View style={[s.card, style]}>{children}</View>;

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[s.badge, { backgroundColor: color + "22" }]}>
      <Text style={{ color, fontWeight: "700", fontSize: 12 }}>{text}</Text>
    </View>
  );
}

export const H = ({ children }: { children: React.ReactNode }) => <Text style={s.h}>{children}</Text>;
export const Mute = ({ children }: { children: React.ReactNode }) => <Text style={s.mute}>{children}</Text>;

export const s = StyleSheet.create({
  btn: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  btnText: { fontSize: 16, fontWeight: "700" },
  card: { backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.line, gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" },
  h: { fontSize: 20, fontWeight: "800", color: c.ink },
  mute: { color: c.mute, fontSize: 14 },
  input: { borderWidth: 1, borderColor: c.line, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16, color: c.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});

export const mmss = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
