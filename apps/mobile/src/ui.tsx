import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, type ReactNode } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from "react-native";
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
  display: { fontFamily: font.extra, fontSize: 76, lineHeight: 80, letterSpacing: -2 },
  title: { fontFamily: font.bold, fontSize: 28, lineHeight: 33, letterSpacing: -0.5 },
  heading: { fontFamily: font.semi, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: font.reg, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: font.reg, fontSize: 14, lineHeight: 20 },
  button: { fontFamily: font.semi, fontSize: 16, lineHeight: 20 },
};

/** `slant` inclina o texto como o itálico do logotipo (use só em números e títulos grandes). */
export function T({ v = "body", c = colors.tinta, slant, style, ...rest }: TextProps & { v?: Variant; c?: string; slant?: boolean }) {
  return <Text {...rest} style={[VARIANTS[v], { color: c }, slant && { transform: [{ skewX: "-8deg" }] }, style]} />;
}

/* ---------- botões ---------- */
type Kind = "primary" | "brand" | "secondary" | "danger" | "ghost" | "outline";
const kindStyle = (k: Kind): { bg: string; fg: string; border?: string } =>
  ({
    primary: { bg: colors.acao, fg: colors.acaoTexto }, // laranja da marca: a ação principal da tela
    brand: { bg: colors.azul, fg: colors.branco },
    secondary: { bg: colors.azulClaro, fg: colors.azulTexto },
    danger: { bg: colors.vermelhoClaro, fg: colors.vermelho },
    ghost: { bg: "transparent", fg: colors.azulTexto },
    outline: { bg: "transparent", fg: colors.branco, border: "rgba(255,255,255,0.6)" }, // sobre o azul
  })[k];

export function Button({ title, onPress, kind = "primary", icon, busy, disabled, small, style }: { title: string; onPress: () => void; kind?: Kind; icon?: keyof typeof Ionicons.glyphMap; busy?: boolean; disabled?: boolean; small?: boolean; style?: ViewStyle }) {
  const k = kindStyle(kind);
  const s = S();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={busy || disabled}
      android_ripple={{ color: "rgba(0,0,0,0.12)" }}
      style={({ pressed }) => [s.btn, { backgroundColor: k.bg, minHeight: small ? 40 : 54, paddingHorizontal: small ? 14 : 22, opacity: disabled ? 0.4 : pressed ? 0.88 : 1 }, k.border ? { borderWidth: 1.5, borderColor: k.border } : null, style]}
    >
      {busy ? (
        <ActivityIndicator color={k.fg} />
      ) : (
        <View style={s.row}>
          {icon && <Ionicons name={icon} size={small ? 18 : 21} color={k.fg} />}
          <T v="button" c={k.fg} style={small ? { fontSize: 14 } : undefined}>
            {title}
          </T>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color = colors.branco }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string; color?: string }) {
  const s = S();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={10} style={s.iconBtn}>
      <Ionicons name={icon} size={24} color={color} />
    </Pressable>
  );
}

/* ---------- campos ---------- */
export function Field(props: TextInputProps) {
  const s = S();
  return <TextInput placeholderTextColor={colors.mudo} {...props} style={[s.input, props.style]} />;
}

/* ---------- peças pequenas ---------- */
type Tone = "ok" | "warn" | "bad" | "info" | "mute";
const toneStyle = (t: Tone): { bg: string; fg: string } =>
  ({
    ok: { bg: colors.verdeClaro, fg: colors.verde },
    warn: { bg: colors.laranjaClaro, fg: colors.laranjaTexto },
    bad: { bg: colors.vermelhoClaro, fg: colors.vermelho },
    info: { bg: colors.azulClaro, fg: colors.azulTexto },
    mute: { bg: colors.chipMudo, fg: colors.mudo },
  })[t];

export function Chip({ text, tone = "info" }: { text: string; tone?: Tone }) {
  const t = toneStyle(tone);
  const s = S();
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
      <T v="heading" c={colors.azulTexto} style={{ fontSize: size * 0.4, lineHeight: size * 0.5 }}>
        {ini || "?"}
      </T>
    </View>
  );
}

export function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const s = S();
  return (
    <View style={s.segment}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)} style={[s.segmentItem, on && { backgroundColor: colors.ativo }]}>
            <T v="button" c={on ? colors.ativoTexto : colors.mudo} style={{ fontSize: 15 }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Progresso em paralelogramos laranja, ecoando os acentos do logotipo. */
export function SlantBar({ ratio, onDark = false, segments = 20 }: { ratio: number; onDark?: boolean; segments?: number }) {
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * segments);
  return (
    <View style={{ flexDirection: "row", gap: 4, height: 12 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}>
      {Array.from({ length: segments }, (_, i) => (
        <View key={i} style={{ flex: 1, borderRadius: 2, transform: [{ skewX: "-20deg" }], backgroundColor: i < filled ? colors.acao : onDark ? colors.trilhoSobreAzul : colors.linha }} />
      ))}
    </View>
  );
}

/** Marca de seção: o paralelogramo laranja do logotipo. */
export const Marker = () => <View style={{ width: 9, height: 20, borderRadius: 2, backgroundColor: colors.acao, transform: [{ skewX: "-20deg" }] }} />;

/** Faixa escura de topo com filete laranja, borda inferior inclinada. `deep` deixa espaço para algo que a atravessa. */
export function Hero({ children, deep }: { children: ReactNode; deep?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.hero, paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: deep ? 130 : 44, overflow: "hidden", gap: 10 }}>
      {children}
      <View pointerEvents="none" style={{ position: "absolute", left: -30, right: -30, bottom: -14, height: 40, backgroundColor: colors.acao, transform: [{ skewY: "-2.5deg" }] }} />
      <View pointerEvents="none" style={{ position: "absolute", left: -30, right: -30, bottom: -20, height: 40, backgroundColor: colors.fundo, transform: [{ skewY: "-2.5deg" }] }} />
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const s = S();
  return (
    <View style={[s.row, { justifyContent: "space-between", paddingTop: 10 }]}>
      <View style={s.row}>
        <Marker />
        <T v="heading">{children}</T>
      </View>
      {right}
    </View>
  );
}

/** Bloco de apoio: só onde um grupo de campos ou alertas precisa de um plano próprio. */
export function Panel({ children, tone }: { children: ReactNode; tone?: "warn" }) {
  return <View style={{ backgroundColor: tone === "warn" ? colors.laranjaClaro : colors.superficie, borderRadius: radius.l, padding: 16, gap: 12 }}>{children}</View>;
}

/** Linha de lista, sem divisor: o espaço separa. */
export function Row({ children }: { children: ReactNode; last?: boolean }) {
  const s = S();
  return <View style={s.listRow}>{children}</View>;
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

/** Peça de aluno na grade da sala: paralelogramo, texto reto. Azul com visto laranja = presente. */
export function StudentTile({ name, present, width, onPress }: { name: string; present: boolean; width: number; onPress: () => void }) {
  const parts = name.trim().split(/\s+/);
  const short = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${present ? "presente" : "ausente"}. Toque para ${present ? "desfazer" : "marcar presença"}`} onPress={onPress} style={{ width, height: 80 }}>
      <View style={{ flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: present ? colors.azul : colors.linha, backgroundColor: present ? colors.azul : "transparent", transform: [{ skewX: "-6deg" }] }}>
        <View style={{ flex: 1, transform: [{ skewX: "6deg" }], alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 4 }}>
          <Ionicons name={present ? "checkmark-circle" : "ellipse-outline"} size={20} color={present ? colors.acao : colors.mudo} />
          <T v="small" c={present ? colors.branco : colors.mudo} numberOfLines={1} style={{ fontFamily: font.semi, fontSize: 13, lineHeight: 17 }}>
            {short}
          </T>
        </View>
      </View>
    </Pressable>
  );
}

/** O botão do aluno: um disco de sinal. Os anéis só animam enquanto procura o professor (movimento que responde ao toque). */
export type OrbState = "esperando" | "pronto" | "buscando" | "feito";
export function Orb({ state, onPress }: { state: OrbState; onPress: () => void }) {
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  const r3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const rings = [r1, r2, r3];
    if (state !== "buscando") {
      rings.forEach((r) => r.setValue(0));
      return;
    }
    const loops = rings.map((r, i) =>
      Animated.loop(Animated.sequence([Animated.delay(i * 450), Animated.timing(r, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }), Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: true })])),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [state, r1, r2, r3]);

  const core = state === "feito" ? colors.verde : state === "esperando" ? colors.superficie : colors.acao;
  const fg = state === "esperando" ? colors.mudo : state === "feito" ? colors.fundo : colors.acaoTexto;
  const label = state === "feito" ? "Presente" : state === "buscando" ? "Procurando o professor" : state === "esperando" ? "Aguardando a chamada" : "Marcar presença";
  const ring = (r: Animated.Value) => ({ position: "absolute" as const, width: 176, height: 176, borderRadius: 88, borderWidth: 3, borderColor: colors.acao, opacity: r.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }] });

  return (
    <View style={{ height: 250, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: 222, height: 222, borderRadius: 111, borderWidth: 1.5, borderColor: state === "esperando" ? colors.linha : colors.acao, opacity: 0.3 }} />
      <View style={{ position: "absolute", width: 262, height: 262, borderRadius: 131, borderWidth: 1.5, borderColor: state === "esperando" ? colors.linha : colors.acao, opacity: 0.14 }} />
      {state === "buscando" && [r1, r2, r3].map((r, i) => <Animated.View key={i} pointerEvents="none" style={ring(r)} />)}
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: state !== "pronto" }} disabled={state !== "pronto"} onPress={onPress} style={{ width: 176, height: 176, borderRadius: 88, backgroundColor: core, alignItems: "center", justifyContent: "center", gap: 6, padding: 18 }}>
        {state === "buscando" ? <ActivityIndicator color={fg} size="large" /> : <Ionicons name={state === "feito" ? "checkmark" : state === "esperando" ? "time-outline" : "radio"} size={state === "feito" ? 64 : 48} color={fg} />}
        <T v="button" c={fg} style={{ textAlign: "center", fontSize: 15, lineHeight: 18 }}>
          {label}
        </T>
      </Pressable>
    </View>
  );
}

export type TabKey = string;
export function TabBar<K extends TabKey>({ tabs, active, onChange }: { tabs: { key: K; label: string; icon: keyof typeof Ionicons.glyphMap; iconOn: keyof typeof Ionicons.glyphMap }[]; active: K; onChange: (k: K) => void }) {
  const insets = useSafeAreaInsets();
  const s = S();
  return (
    <View style={[s.tabbar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label} onPress={() => onChange(t.key)} style={s.tab}>
            {on && <View style={s.tabMark} />}
            <Ionicons name={on ? t.iconOn : t.icon} size={24} color={on ? colors.acao : colors.mudo} />
            <T v="small" c={on ? colors.tinta : colors.mudo} style={{ fontFamily: on ? font.semi : font.reg, fontSize: 13 }}>
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

export const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

const build = () =>
  StyleSheet.create({
    btn: { borderRadius: radius.m, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    input: { borderWidth: 1.5, borderColor: colors.linha, backgroundColor: colors.superficie, borderRadius: radius.m, paddingHorizontal: 16, minHeight: 54, fontSize: 16, fontFamily: font.reg, color: colors.tinta },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, alignSelf: "flex-start" },
    segment: { flexDirection: "row", backgroundColor: colors.azulClaro, borderRadius: radius.m, padding: 4, gap: 4 },
    segmentItem: { flex: 1, minHeight: 42, borderRadius: radius.m - 4, alignItems: "center", justifyContent: "center" },
    listRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 },
    tabbar: { flexDirection: "row", backgroundColor: colors.superficie, paddingTop: 6 },
    tab: { flex: 1, alignItems: "center", gap: 2, paddingTop: 6, minHeight: 52 },
    tabMark: { position: "absolute", top: -6, width: 34, height: 4, borderRadius: 2, backgroundColor: colors.acao, transform: [{ skewX: "-20deg" }] },
  });

const cache = new Map<string, ReturnType<typeof build>>();
/** Estilos do tema atual (cache por tema, pois `colors` muda quando o tema troca). */
const S = () => {
  const key = colors.fundo;
  let v = cache.get(key);
  if (!v) cache.set(key, (v = build()));
  return v;
};
