import { mkdirSync } from "node:fs";
import { buildApp } from "./app";
import { openDb } from "./db";

const port = Number(process.env.PORT ?? 3333);
const dataDir = process.env.PGLITE_DIR ?? "./.data/pg";
if (!process.env.DATABASE_URL) mkdirSync(dataDir, { recursive: true }); // PGlite não cria pastas pai
const handle = await openDb({ url: process.env.DATABASE_URL, dataDir });
const app = await buildApp({ db: handle.db, simBeacon: process.env.SIM_BEACON === "1" });

await app.listen({ port, host: "0.0.0.0" });
console.log(`acadly-fio server :${port} · db=${handle.kind}${process.env.SIM_BEACON === "1" ? " · SIM_BEACON ligado (somente dev)" : ""}`);

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await app.close();
    await handle.close();
    process.exit(0);
  });
}
