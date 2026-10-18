import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

export async function load(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function save(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    /* sem armazenamento seguro: segue em memória */
  }
}

/**
 * Identificador da instalação (persistente). iOS/Android modernos não expõem serial de hardware;
 * em produção reforce com Play Integrity / App Attest para amarrar o id ao aparelho de verdade.
 */
export async function deviceId(): Promise<string> {
  const cur = await load("deviceId");
  if (cur) return cur;
  const id = Crypto.randomUUID();
  await save("deviceId", id);
  return id;
}
