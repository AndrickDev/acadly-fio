import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { T, colors } from "./ui";

/** Turma como "pôster": inicial grande num bloco inclinado (o itálico do logotipo) em vez de avatar redondo de banco. */
export function Poster({ name, sub, onPress }: { name: string; sub?: string; onPress?: () => void }) {
  const inner = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 8 }}>
      <View style={{ width: 58, height: 58, borderRadius: 12, backgroundColor: colors.azul, transform: [{ skewX: "-10deg" }] }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", transform: [{ skewX: "10deg" }] }}>
          <T v="title" c={colors.branco} style={{ fontFamily: "Outfit_800ExtraBold" }}>
            {name.trim()[0]?.toUpperCase() ?? "?"}
          </T>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <T v="heading" numberOfLines={2}>
          {name}
        </T>
        {!!sub && (
          <T v="small" c={colors.mudo}>
            {sub}
          </T>
        )}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={22} color={colors.acao} />}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`Abrir turma ${name}`} onPress={onPress}>
      {inner}
    </Pressable>
  ) : (
    inner
  );
}
