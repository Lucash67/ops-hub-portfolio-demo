"use client";

export function LoadingScreen() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-surface-border" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand-orange" />
        </div>
        <p className="text-sm text-text-secondary animate-pulse">Carregando dados...</p>
      </div>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-2xl bg-surface-elevated"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}
