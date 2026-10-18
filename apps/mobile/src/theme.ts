/**
 * Identidade Unifio. Azul #004998 e laranja #ED8A25 vêm do logotipo oficial (pixels exatos).
 *
 * Dois temas com os MESMOS nomes de cor. `colors` é um objeto único que `applyTheme` atualiza;
 * o App remonta a árvore ao trocar de tema, então os componentes só leem `colors.x`.
 *
 * Regra de uso: azul é a ação; laranja é "olhe aqui" (progresso, atenção, revisar).
 * No claro, laranja nunca é texto sobre branco (contraste 2,6:1): texto usa `laranjaTexto`.
 */
const claro = {
  marca: "#004998", // azul do logotipo, nunca muda
  azul: "#004998",
  azulEscuro: "#00305F",
  azulClaro: "#E6EEF7",
  azulTexto: "#004998",
  laranja: "#ED8A25",
  laranjaClaro: "#FDF0E1",
  laranjaTexto: "#8A4B00",
  branco: "#FFFFFF",
  superficie: "#FFFFFF",
  ativo: "#FFFFFF",
  ativoTexto: "#004998",
  hero: "#004998",
  fundo: "#F4F7FB",
  tinta: "#0E1B2C",
  mudo: "#5B6B7F",
  linha: "#DDE5EE",
  chipMudo: "#E9EEF4",
  verde: "#1E8E5A",
  verdeClaro: "#E3F4EB",
  vermelho: "#C62828",
  vermelhoClaro: "#FBE9E9",
  sobreAzul: "rgba(255,255,255,0.78)",
  trilhoSobreAzul: "rgba(255,255,255,0.22)",
};

const escuro: typeof claro = {
  marca: "#004998",
  azul: "#2A6FDB",
  azulEscuro: "#0E2D5C",
  azulClaro: "#16294A",
  azulTexto: "#7DB3FF",
  laranja: "#ED8A25",
  laranjaClaro: "#2D2012",
  laranjaTexto: "#F2A55A",
  branco: "#FFFFFF",
  superficie: "#121C2E",
  ativo: "#2B466F",
  ativoTexto: "#FFFFFF",
  hero: "#0E2D5C",
  fundo: "#0A1220",
  tinta: "#EAF0F8",
  mudo: "#95A5BC",
  linha: "#25364F",
  chipMudo: "#1B2A44",
  verde: "#39D08F",
  verdeClaro: "#12301F",
  vermelho: "#FF7A7A",
  vermelhoClaro: "#3A1D22",
  sobreAzul: "rgba(255,255,255,0.78)",
  trilhoSobreAzul: "rgba(255,255,255,0.18)",
};

export type ThemeName = "claro" | "escuro";
export type ThemePref = ThemeName | "sistema";

export const colors: typeof claro = { ...escuro };
export const applyTheme = (n: ThemeName) => void Object.assign(colors, n === "claro" ? claro : escuro);

export const radius = { s: 8, m: 14, l: 20, full: 999 };
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28 };

export const font = {
  reg: "Outfit_400Regular",
  med: "Outfit_500Medium",
  semi: "Outfit_600SemiBold",
  bold: "Outfit_700Bold",
  extra: "Outfit_800ExtraBold",
};
