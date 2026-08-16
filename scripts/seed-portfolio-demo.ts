/**
 * Seed CLI — reinicia o SQLite local e popula dados fictícios.
 * Uso: pnpm seed:demo
 */
import "./load-env";
import fs from "fs";
import path from "path";

process.env.DB_PROVIDER = "sqlite";
process.env.NEXT_PUBLIC_DEMO_MODE = "true";
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  process.env.AUTH_SECRET = "portfolio-demo-auth-secret-min-32-chars!!";
}

async function main() {
  const dataDir = path.join(process.cwd(), "data");
  for (const name of ["ops-hub-demo.db", "lucas-business-os.db"]) {
    const dbPath = path.join(dataDir, name);
    for (const suffix of ["", "-wal", "-shm"]) {
      const f = dbPath + suffix;
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
        console.log("Removed", f);
      }
    }
  }
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const { ensureDemoData, DEMO_EMAIL, DEMO_PASSWORD } = await import(
    "../src/lib/demo/ensure-demo-data"
  );
  await ensureDemoData({ force: true });
  console.log(`Seed OK. Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
