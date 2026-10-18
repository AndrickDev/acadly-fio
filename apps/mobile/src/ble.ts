/**
 * Constantes do anúncio Bluetooth. Professor e aluno precisam usar exatamente estes valores.
 * Detalhes e riscos: docs/bluetooth.md.
 */

/** UUID de serviço do Chamada Fio (128 bits). Serve de filtro para o aluno só ver anúncios nossos. */
export const FIO_SERVICE_UUID = "6f1d5c3a-8b27-4e91-9c04-5d2a7e3b1f60";

/** Identificador de fabricante reservado para testes (0xFFFF). Não é de nenhuma empresa. */
export const FIO_COMPANY_ID = 0xffff;

/** Bytes do código no anúncio. 128 bits de UUID (18) + fabricante (4 + N) + flags (3) cabem em 31 só com N <= 6. */
export const TOKEN_BYTES = 6;

export const randomTokenHex = (bytes = TOKEN_BYTES): string =>
  Array.from({ length: bytes }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");

/**
 * A biblioteca é nativa: no Expo Go ela não existe e importá-la derruba o app.
 * Por isso o carregamento é preguiçoso e devolve null quando indisponível.
 */
export type BleModule = typeof import("munim-bluetooth");
export function loadBle(): BleModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("munim-bluetooth") as BleModule;
  } catch {
    return null;
  }
}
