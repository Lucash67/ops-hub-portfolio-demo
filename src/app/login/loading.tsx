export default function LoginLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-[#050505] lg:grid lg:h-screen lg:grid-cols-2">
      <div className="flex min-h-[55vh] flex-col items-center justify-center px-5 py-8 lg:min-h-0 lg:order-2">
        <div className="w-full max-w-[420px] animate-pulse space-y-4 rounded-3xl border border-[#00D4A8]/10 bg-[#0a0a0a]/80 p-8">
          <div className="mx-auto h-8 w-32 rounded-lg bg-[#00D4A8]/10" />
          <div className="h-4 w-48 rounded bg-white/5" />
          <div className="h-11 rounded-xl bg-white/5" />
          <div className="h-11 rounded-xl bg-white/5" />
          <div className="h-12 rounded-xl bg-[#00D4A8]/20" />
        </div>
        <p className="mt-6 text-sm text-[#737373]">Carregando Ops Hub…</p>
      </div>
      <div className="hidden min-h-0 flex-col justify-center px-8 lg:order-1 lg:flex">
        <div className="max-w-md animate-pulse space-y-4">
          <div className="h-10 w-10 rounded-xl bg-[#00D4A8]/10" />
          <div className="h-12 w-full rounded-lg bg-white/5" />
          <div className="h-20 w-full rounded-lg bg-white/5" />
        </div>
      </div>
    </div>
  );
}
