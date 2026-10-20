import type { Api } from "./api";
import { FIO_COMPANY_ID, FIO_SERVICE_UUID, loadBle } from "./ble";

/** O que o aparelho "ouviu" no mesh Bluetooth durante o scan. */
export interface ProximityReading {
  token: string;
  /** saltos até o aparelho do professor (0 = ouviu o professor direto) */
  hops: number;
  /** ids de alunos vizinhos ouvidos no mesh */
  witnesses: string[];
  /** tokens ouvidos por Bluetooth com a força do sinal (dBm); o servidor escolhe o da própria sala */
  readings?: { token: string; rssi: number }[];
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

const SCAN_MS = 6000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const cleanHex = (s: string) => s.toLowerCase().replace(/^0x/, "");

/**
 * Bluetooth real: escuta o anúncio do professor por alguns segundos e devolve cada código ouvido com o sinal.
 * Sem salto e sem repasse (modo direto). Só se prova em aparelho real (docs/bluetooth.md).
 */
export const bleProvider = (): ProximityProvider => ({
  label: "Bluetooth",
  async scan() {
    const ble = loadBle();
    if (!ble) throw new Error("O Bluetooth só funciona no app instalado, não no Expo Go nem no emulador.");
    if (!(await ble.requestBluetoothPermission(["scan", "connect"]))) throw new Error("Permita \"Dispositivos por perto\" nas permissões do app.");
    if (!(await ble.isBluetoothEnabled())) {
      await ble.requestEnable().catch(() => false);
      if (!(await ble.isBluetoothEnabled())) throw new Error("Ligue o Bluetooth para marcar presença.");
    }
    const heard = new Map<string, number[]>();
    const off = ble.addDeviceFoundListener((d) => {
      const raw = d.manufacturerDataEntries?.find((m) => m.companyId === FIO_COMPANY_ID)?.data;
      if (!raw || d.rssi == null) return;
      const t = cleanHex(raw);
      heard.set(t, [...(heard.get(t) ?? []), d.rssi]);
    });
    try {
      ble.startScan({ serviceUUIDs: [FIO_SERVICE_UUID], allowDuplicates: true, scanMode: "lowLatency" });
      await sleep(SCAN_MS);
    } finally {
      try {
        ble.stopScan();
      } catch {
        /* já parado */
      }
      off();
    }
    const readings = [...heard].map(([token, rs]) => ({ token, rssi: median(rs) })).sort((a, b) => b.rssi - a.rssi);
    if (readings.length === 0) throw new Error("Não encontrei o sinal do professor. Chegue mais perto e toque de novo.");
    return { token: readings[0].token, hops: 0, witnesses: [], readings };
  },
});
