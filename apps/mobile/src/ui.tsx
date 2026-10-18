import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, font, radius } from "./theme";

export { colors };

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/* ---------- tipografia ---------- */
type Variant = "display" | "title" | "heading" | "body" | "small" | "button";
const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontFamily: font.extra, fontSize: 72, lineHeight: 74, letterSpacing: -2 },
  title: { fontFamily: font.bold, fontSize: 28, lineHeight: 33, letterSpacing: -0.5 },
  heading: { fontFamily: font.semi, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: font.reg, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: font.reg, fontSize: 14, lineHeight: 20 },
  button: { fontFamily: font.semi, fontSize: 16, lineHeight: 20 },
};

export function T({ v = "body", c = colors.tinta, style, ...rest }: TextProps & { v?: Variant; c?: string }) {
  return <Text {...rest} style={[VARIANTS[v], { color: c }, style]} />;
}

/* ---------- botões ---------- */
type Kind = "primary" | "secondary" | "danger" | "ghost" | "onDark";
const KIND: Record<Kind, { bg: string; fg: string }> = {
  primary: { bg: colors.azul, fg: colors.branco },
  secondary: { bg: colors.azulClaro, fg: colors.azul },
  danger: { bg: colors.vermelhoClaro, fg: colors.vermelho },
  ghost: { bg: "transparent", fg: colors.azul },
  onDark: { bg: colors.branco, fg: colors.azul },
};

export function Button({ title, onPress, kind = "primary", icon, busy, disabled, small, style }: { title: string; onPress: () => void; kind?: Kind; icon?: keyof typeof Ionicons.glyphMap; busy?: boolean; disabled?: boolean; small?: boolean; style?: ViewStyle }) {
  const k = KIND[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={busy || disabled}
      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
      style={({ pressed }) => [s.btn, { backgroundColor: k.bg, minHeight: small ? 40 : 52, paddingHorizontal: small ? 14 : 20, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style]}
    >
      {busy ? (
        <ActivityIndicator color={k.fg} />
      ) : (
        <View style={s.row}>
          {icon && <Ionicons name={icon} size={small ? 18 : 20} color={k.fg} />}
          <T v="button" c={k.fg} style={small ? { fontSize: 14 } : undefined}>
            {title}
          </T>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color = colors.branco }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string; color?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} style={s.iconBtn}>
      <Ionicons name={icon} size={24} color={color} />
    </Pressable>
  );
}

/* ---------- campos ---------- */
export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.mudo} {...props} style={[s.input, props.style]} />;
}

/* ---------- peças pequenas ---------- */
type Tone = "ok" | "warn" | "bad" | "info" | "mute";
const TONE: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: colors.verdeClaro, fg: colors.verde },
  warn: { bg: colors.laranjaClaro, fg: colors.laranjaTexto },
  bad: { bg: colors.vermelhoClaro, fg: colors.vermelho },
  info: { bg: colors.azulClaro, fg: colors.azul },
  mute: { bg: "#E9EEF4", fg: colors.mudo },
};

export function Chip({ text, tone = "info" }: { text: string; tone?: Tone }) {
  const t = TONE[tone];
  return (
    <View style={[s.chip, { backgroundColor: t.bg }]}>
      <T v="small" c={t.fg} style={{ fontFamily: font.semi, fontSize: 13, lineHeight: 17 }}>
        {text}
      </T>
    </View>
  );
}

export function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const ini = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.azulClaro, alignItems: "center", justifyContent: "center" }}>
      <T v="heading" c={colors.azul} style={{ fontSize: size * 0.4, lineHeight: size * 0.5 }}>
        {ini || "?"}
      </T>
    </View>
  );
}

export function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={s.segment}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)} style={[s.segmentItem, on && { backgroundColor: colors.branco }]}>
            <T v="button" c={on ? colors.azul : colors.mudo} style={{ fontSize: 15 }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Progresso em paralelogramos, ecoando os acentos inclinados do logotipo. */
export function SlantBar({ ratio, onDark = false, segments = 20 }: { ratio: number; onDark?: boolean; segments?: number }) {
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * segments);
  return (
    <View style={{ flexDirection: "row", gap: 4, height: 12 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}>
      {Array.from({ length: segments }, (_, i) => (
        <View key={i} style={{ flex: 1, borderRadius: 2, transform: [{ skewX: "-20deg" }], backgroundColor: i < filled ? colors.laranja : onDark ? colors.trilhoSobreAzul : colors.linha }} />
      ))}
    </View>
  );
}

/** Faixa azul de topo, com a borda inferior inclinada como o "fio" do logotipo. */
export function Hero({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.azul, paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 44, overflow: "hidden", gap: 10 }}>
      {children}
      <View pointerEvents="none" style={{ position: "absolute", left: -30, right: -30, bottom: -20, height: 40, backgroundColor: colors.fundo, transform: [{ skewY: "-2.5deg" }] }} />
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={[s.row, { justifyContent: "space-between", paddingTop: 8 }]}>
      <T v="heading">{children}</T>
      {right}
    </View>
  );
}

/** Linha de lista: separada por divisor, sem caixa própria. */
export function Row({ children, last }: { children: ReactNode; last?: boolean }) {
  return <View style={[s.listRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.linha }]}>{children}</View>;
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <View style={{ paddingVertical: 8, gap: 4 }}>
      <T v="heading">{title}</T>
      <T v="small" c={colors.mudo}>
        {text}
      </T>
    </View>
  );
}

export type TabKey = string;
export function TabBar<K extends TabKey>({ tabs, active, onChange }: { tabs: { key: K; label: string; icon: keyof typeof Ionicons.glyphMap; iconOn: keyof typeof Ionicons.glyphMap }[]; active: K; onChange: (k: K) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.tabbar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label} onPress={() => onChange(t.key)} style={s.tab}>
            {on && <View style={s.tabMark} />}
            <Ionicons name={on ? t.iconOn : t.icon} size={24} color={on ? colors.azul : colors.mudo} />
            <T v="small" c={on ? colors.azul : colors.mudo} style={{ fontFamily: on ? font.semi : font.reg, fontSize: 13 }}>
              {t.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export const mmss = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** "3 de 12 alunos presentes", "1 de 1 aluno presente". */
export const presentLine = (present: number, total: number) => `${present} de ${total} ${total === 1 ? "aluno presente" : "alunos presentes"}`;

export const firstName =(n: string) => n.trim().split(/\s+/)[0] ?? n;

export const s = StyleSheet.create({
  btn: { borderRadius: radius.m, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { borderWidth: 1.5, borderColor: colors.linha, backgroundColor: colors.branco, borderRadius: radius.m, paddingHorizontal: 16, minHeight: 52, fontSize: 16, fontFamily: font.reg, color: colors.tinta },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, alignSelf: "flex-start" },
  segment: { flexDirection: "row", backgroundColor: colors.azulClaro, borderRadius: radius.m, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: radius.m - 4, alignItems: "center", justifyContent: "center" },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  tabbar: { flexDirection: "row", backgroundColor: colors.branco, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.linha, paddingTop: 6 },
  tab: { flex: 1, alignItems: "center", gap: 2, paddingTop: 6, minHeight: 52 },
  tabMark: { position: "absolute", top: -6, width: 30, height: 4, borderRadius: 2, backgroundColor: colors.laranja, transform: [{ skewX: "-20deg" }] },
});
