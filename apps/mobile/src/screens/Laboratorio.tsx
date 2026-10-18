import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { FIO_COMPANY_ID, FIO_SERVICE_UUID, loadBle, randomTokenHex } from "../ble";
import { Button, Chip, Hero, IconButton, Row, Segmented, SectionTitle, T, colors, useInterval } from "../ui";

/** Ferramenta de medição do Bluetooth (docs/bluetooth.md). Não faz parte do uso normal do app. */
type Seen = { id: string; token: string; rssi: number[]; last: number; count: number };
type Point = { label: string; avg: number; min: number; max: number; n: number };

const POINTS = ["1 m", "5 m", "10 m", "Atrás da parede", "Corredor", "No bolso"];
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

export function Laboratorio({ onBack }: { onBack: () => void }) {
  const ble = useMemo(() => loadBle(), []);
  const [msg, setMsg] = useState("");
  const [emitting, setEmitting] = useState(false);
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<"fio" | "todos">("fio");
  const [seen, setSeen] = useState<Record<string, Seen>>({});
  const [point, setPoint] = useState(POINTS[0]);
  const [log, setLog] = useState<Point[]>([]);
  const unsub = useRef<null | (() => void)>(null);
  const [, tick] = useState(0);
  useInterval(() => tick((n) => n + 1), scanning ? 1000 : null);

  useEffect(
    () => () => {
      try {
        ble?.stopScan();
        ble?.stopAdvertising();
      } catch {
        /* já parado */
      }
      unsub.current?.();
    },
    [ble],
  );

  const ready = async () => {
    if (!ble) {
      setMsg("O Bluetooth só funciona no aplicativo instalado (build de desenvolvimento), não no Expo Go nem no emulador.");
      return false;
    }
    if (!(await ble.requestBluetoothPermission(["scan", "connect", "advertise"]))) {
      setMsg("Permissão de Bluetooth negada. Libere em Configurações do aparelho, Aplicativos, Chamada Fio, Permissões.");
      return false;
    }
    if (!(await ble.isBluetoothEnabled())) {
      setMsg("O Bluetooth está desligado. Ligue e tente de novo.");
      return false;
    }
    setMsg("");
    return true;
  };

  const startEmit = async () => {
    if (!(await ready())) return;
    const t = randomTokenHex();
    setToken(t);
    try {
      ble!.startAdvertising({ serviceUUIDs: [FIO_SERVICE_UUID], manufacturerDataEntries: [{ companyId: FIO_COMPANY_ID, data: t }] });
      setEmitting(true);
    } catch (e) {
      setMsg(`Não conseguiu emitir: ${e instanceof Error ? e.message : e}`);
    }
  };
  const stopEmit = () => {
    try {
      ble?.stopAdvertising();
    } catch {
      /* já parado */
    }
    setEmitting(false);
  };

  const stopListen = () => {
    try {
      ble?.stopScan();
    } catch {
      /* já parado */
    }
    unsub.current?.();
    unsub.current = null;
    setScanning(false);
  };
  const startListen = async () => {
    if (!(await ready())) return;
    unsub.current?.();
    unsub.current = ble!.addDeviceFoundListener((d) => {
      if (d.rssi == null) return;
      const tok = d.manufacturerDataEntries?.find((m) => m.companyId === FIO_COMPANY_ID)?.data ?? "";
      setSeen((prev) => {
        const cur = prev[d.id] ?? { id: d.id, token: tok, rssi: [], last: 0, count: 0 };
        return { ...prev, [d.id]: { ...cur, token: tok || cur.token, rssi: [...cur.rssi.slice(-29), d.rssi!], last: Date.now(), count: cur.count + 1 } };
      });
    });
    try {
      ble!.startScan({ serviceUUIDs: filter === "fio" ? [FIO_SERVICE_UUID] : undefined, allowDuplicates: true, scanMode: "lowLatency" });
      setScanning(true);
    } catch (e) {
      setMsg(`Não conseguiu escutar: ${e instanceof Error ? e.message : e}`);
    }
  };

  const list = Object.values(seen)
    .sort((a, b) => avg(b.rssi.slice(-10)) - avg(a.rssi.slice(-10)))
    .slice(0, 6);

  const record = () => {
    const best = list[0];
    if (!best || best.rssi.length === 0) return;
    setLog((l) => [...l, { label: point, avg: avg(best.rssi), min: Math.min(...best.rssi), max: Math.max(...best.rssi), n: best.rssi.length }]);
    setSeen((prev) => ({ ...prev, [best.id]: { ...best, rssi: [] } })); // zera para o próximo ponto
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
      <Hero>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginLeft: -8 }}>
          <IconButton icon="arrow-back" label="Voltar" onPress={onBack} />
          <T v="title" c={colors.branco}>
            Laboratório Bluetooth
          </T>
        </View>
        <T v="small" c={colors.sobreAzul}>
          Ferramenta de medição. Não faz parte do uso normal.
        </T>
      </Hero>

      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        {!!msg && (
          <View style={{ backgroundColor: colors.laranjaClaro, borderRadius: 14, padding: 14 }}>
            <T v="small" c={colors.laranjaTexto}>
              {msg}
            </T>
          </View>
        )}

        <SectionTitle>Emitir (celular do professor)</SectionTitle>
        {emitting && <Chip text={`Emitindo o código ${token}`} tone="ok" />}
        <Button title={emitting ? "Parar de emitir" : "Começar a emitir"} icon={emitting ? "stop-circle-outline" : "radio"} kind={emitting ? "danger" : "primary"} onPress={emitting ? stopEmit : startEmit} />

        <SectionTitle>Escutar (celular do aluno)</SectionTitle>
        <Segmented
          value={filter}
          onChange={(f) => {
            setFilter(f);
            if (scanning) stopListen();
          }}
          options={[
            { key: "fio", label: "Só Chamada Fio" },
            { key: "todos", label: "Todos" },
          ]}
        />
        <Button title={scanning ? "Parar de escutar" : "Começar a escutar"} icon={scanning ? "stop-circle-outline" : "ear-outline"} kind={scanning ? "danger" : "secondary"} onPress={scanning ? stopListen : startListen} />

        {scanning && list.length === 0 && (
          <T v="small" c={colors.mudo}>
            Nada ouvido ainda. Se o outro celular está emitindo e nada aparece, troque para "Todos" para ver se o aparelho escuta alguma coisa.
          </T>
        )}
        <View>
          {list.map((d, i) => (
            <Row key={d.id} last={i === list.length - 1}>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="body" style={{ fontFamily: "Outfit_600SemiBold" }}>
                  {d.token ? `Código ${d.token}` : "Sem código"}
                </T>
                <T v="small" c={colors.mudo}>
                  {`Sinal ${avg(d.rssi.slice(-10))} dBm (mín ${Math.min(...d.rssi)}, máx ${Math.max(...d.rssi)}), ${d.count} leituras, há ${Math.round((Date.now() - d.last) / 1000)} s`}
                </T>
              </View>
            </Row>
          ))}
        </View>

        <SectionTitle>Gravar um ponto de medição</SectionTitle>
        <T v="small" c={colors.mudo}>
          Fique parado no ponto, espere umas 10 leituras e grave. A média e o intervalo vão para a lista abaixo.
        </T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {POINTS.map((p) => (
            <Button key={p} title={p} kind={p === point ? "primary" : "secondary"} small onPress={() => setPoint(p)} />
          ))}
        </View>
        <Button title={`Gravar média em "${point}"`} icon="save-outline" onPress={record} disabled={list.length === 0} />

        {log.length > 0 && (
          <View>
            <SectionTitle right={<Button title="Limpar" kind="ghost" small onPress={() => setLog([])} />}>Medições</SectionTitle>
            {log.map((p, i) => (
              <Row key={i} last={i === log.length - 1}>
                <View style={{ flex: 1 }}>
                  <T v="body" style={{ fontFamily: "Outfit_600SemiBold" }}>
                    {p.label}
                  </T>
                  <T v="small" c={colors.mudo}>
                    {`média ${p.avg} dBm, de ${p.min} a ${p.max}, ${p.n} leituras`}
                  </T>
                </View>
              </Row>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
