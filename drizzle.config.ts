import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/lib/db/postgres/schema.ts", "./src/lib/db/postgres/schema-engine.ts"],
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
