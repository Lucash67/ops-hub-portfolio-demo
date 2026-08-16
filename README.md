# Ops Hub — Portfolio Demo

Demonstração pública de um **centro operacional de gestão** multi-negócio.

> Dados 100% fictícios. Sem Supabase. Sem banco de produção.

## Conta demo

| Campo | Valor |
|-------|--------|
| E-mail | `demo@portfolio.com` |
| Senha | `Demo123!` |

## Stack

Next.js 14 · React 18 · TypeScript · Tailwind · Recharts · SQLite (`better-sqlite3`) · Drizzle · TanStack Query · JWT

Na Vercel o SQLite roda em `/tmp` e o seed fictício sobe no boot (sem Postgres/Supabase).

## Local

```bash
pnpm install
cp .env.example .env.local
pnpm seed:demo
pnpm dev
```

http://localhost:3001

## Deploy (Vercel)

Variáveis:

- `DB_PROVIDER=sqlite`
- `AUTH_SECRET=` (aleatório ≥ 32 chars)
- `NEXT_PUBLIC_DEMO_MODE=true`
- `DEMO_SQLITE_TMP=true` (opcional; na Vercel `/tmp` já é usado via `VERCEL=1`)

Não configure `DATABASE_URL`.
