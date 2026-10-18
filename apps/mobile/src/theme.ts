/**
 * Identidade Unifio, versão laranja. O laranja #ED8A25 (do logotipo) é a cor dominante: ação, destaque,
 * aba ativa e progresso. O azul do logotipo sai da interface e fica só no ícone.
 * Os nomes `azul*` continuam existindo (os componentes os leem) mas hoje apontam para o laranja queimado
 * (#B45309, texto branco com 5:1) e seus tons. Neutros quentes (marrom-grafite) no lugar do azul-acinzentado.
 *
 * Dois temas com os MESMOS nomes de cor. `colors` é um objeto único que `applyTheme` atualiza;
 * o App remonta a árvore ao trocar de tema, então os componentes só leem `colors.x`.
 * No claro, laranja nunca é texto sobre branco (contraste 2,6:1): texto usa `laranjaTexto`.
 */
const claro = {
  marca: "#004998", // azul do logotipo, só para o ícone
  azul: "#B45309",
  azulEscuro: "#8A3F06",
  azulClaro: "#FBEBDA",
  azulTexto: "#8A3F06",
  laranja: "#ED8A25",
  laranjaClaro: "#FDF0E1",
  laranjaTexto: "#8A4B00",
  acao: "#ED8A25",
  acaoTexto: "#1C1511",
  branco: "#FFFFFF",
  superficie: "#FFFFFF",
  ativo: "#FFFFFF",
  ativoTexto: "#8A3F06",
  hero: "#1F1712",
  fundo: "#F8F4EF",
  tinta: "#1C1511",
  mudo: "#6B5F55",
  linha: "#E7DED4",
  chipMudo: "#EFE8E0",
  verde: "#1E8E5A",
  verdeClaro: "#E3F4EB",
  vermelho: "#C62828",
  vermelhoClaro: "#FBE9E9",
  sobreAzul: "rgba(255,255,255,0.78)",
  trilhoSobreAzul: "rgba(255,255,255,0.22)",
};

const escuro: typeof claro = {
  marca: "#004998",
  azul: "#B45309",
  azulEscuro: "#8A3F06",
  azulClaro: "#2D2012",
  azulTexto: "#F2A55A",
  laranja: "#ED8A25",
  laranjaClaro: "#2D2012",
  laranjaTexto: "#F2A55A",
  acao: "#ED8A25",
  acaoTexto: "#1C1511",
  branco: "#FFFFFF",
  superficie: "#1D1611",
  ativo: "#43301F",
  ativoTexto: "#FFFFFF",
  hero: "#2A1B10",
  fundo: "#120D09",
  tinta: "#F5EEE6",
  mudo: "#A8998A",
  linha: "#33291F",
  chipMudo: "#2A2119",
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
