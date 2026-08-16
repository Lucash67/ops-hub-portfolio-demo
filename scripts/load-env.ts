/**
 * Carrega variáveis de `.env` e `.env.local` para scripts CLI (tsx/node).
 * Next.js faz isso automaticamente; scripts standalone não.
 *
 * Precedência (igual ao Next.js): `.env` → `.env.local` (local sobrescreve).
 * Variáveis já definidas no shell não são sobrescritas.
 */
import fs from "fs";
import path from "path";

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

export function loadEnvLocal(cwd = process.cwd()): void {
  for (const file of [".env", ".env.local"]) {
    const filePath = path.join(cwd, file);
    if (!fs.existsSync(filePath)) continue;

    const parsed = parseEnvFile(fs.readFileSync(filePath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

loadEnvLocal();
