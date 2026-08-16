"use client";

/** Faixa discreta — ambiente de portfólio / demonstração. */
export function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return null;

  return (
    <div className="relative z-[60] border-b border-brand-orange/20 bg-brand-orange/10 px-3 py-1.5 text-center text-[11px] leading-snug text-text-secondary sm:text-xs">
      <span className="font-medium text-brand-orange">Portfolio Demo</span>
      <span className="mx-1.5 text-text-muted">·</span>
      Dados 100% fictícios — ambiente de demonstração
    </div>
  );
}
