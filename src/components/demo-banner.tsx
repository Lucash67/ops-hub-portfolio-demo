"use client";

/** Faixa discreta — ambiente de portfólio / demonstração. */
export function DemoBanner() {
  // This repo is the public portfolio demo; hide only if explicitly disabled.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "false") return null;

  return (
    <div className="relative z-[60] border-b border-brand-orange/20 bg-brand-orange/10 px-3 py-1.5 text-center text-[11px] leading-snug text-text-secondary sm:text-xs">
      <span className="font-medium text-brand-orange">Portfolio Demo</span>
      <span className="mx-1.5 text-text-muted">·</span>
      Conta vazia — no produto real cada usuário cria as próprias operações
    </div>
  );
}
