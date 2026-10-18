import { createHmac, timingSafeEqual } from "node:crypto";
import { TOKEN_SLOT_MS } from "@acadly-fio/core";

export const slotOf = (t: number): number => Math.floor(t / TOKEN_SLOT_MS);

export const tokenFor = (secret: string, sessionId: string, slot: number): string =>
  createHmac("sha256", secret).update(`${sessionId}:${slot}`).digest("hex").slice(0, 16);

const eq = (a: string, b: string): boolean => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** ok: slot atual ±1 · stale: slot mais antigo (até ~1 min) · invalid: qualquer outro. */
export function verifyBeacon(secret: string, sessionId: string, token: string, now: number): "ok" | "invalid" | "stale" {
  const cur = slotOf(now);
  for (const d of [0, -1, 1]) if (eq(token, tokenFor(secret, sessionId, cur + d))) return "ok";
  for (let d = 2; d <= 12; d++) if (eq(token, tokenFor(secret, sessionId, cur - d))) return "stale";
  return "invalid";
}
