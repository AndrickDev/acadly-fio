import { createHmac, timingSafeEqual } from "node:crypto";

/** Token de sessão simples: base64url(userId).hmac. MVP — trocar por OIDC/JWT em produção. */
export function signUser(secret: string, userId: string): string {
  const body = Buffer.from(userId).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readUser(secret: string, token: string | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", secret).update(body).digest("base64url");
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  return Buffer.from(body, "base64url").toString();
}
