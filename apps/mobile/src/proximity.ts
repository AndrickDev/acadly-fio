import type { Api } from "./api";

/** O que o aparelho "ouviu" no mesh Bluetooth durante o scan. */
export interface ProximityReading {
  token: string;
  /** saltos até o aparelho do professor (0 = ouviu o professor direto) */
  hops: number;
  /** ids de alunos vizinhos ouvidos no mesh */
  witnesses: string[];
}

export interface ProximityProvider {
  readonly label: string;
  scan(sessionId: string): Promise<ProximityReading>;
}

/**
 * DEV / Expo Go: não usa rádio nenhum, busca o token no servidor.
 * Só funciona com o servidor em SIM_BEACON=1 e NÃO prova presença física.
 */
export const simulatedProvider = (api: Api): ProximityProvider => ({
  label: "Simulado (dev)",
  async scan(sessionId) {
    const { token } = await api.simBeacon(sessionId);
    return { token, hops: 0, witnesses: [] };
  },
});

/**
 * Produção: scan BLE do beacon do professor e relay de vizinhos.
 * Requer development build com react-native-ble-plx (não roda no Expo Go).
 * Contrato já está pronto no servidor: token HMAC rotativo, hops e testemunhas.
 */
export const bleProvider = (): ProximityProvider => ({
  label: "Bluetooth",
  async scan() {
    throw new Error("Bluetooth real ainda não implementado: requer development build (react-native-ble-plx).");
  },
});
