"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Cloud, Eye, EyeOff, Loader2, Lock, Mail, Shield, User, Zap } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { HUB_COPY } from "@/constants/hub-brand";
import { LhHoldingLogo } from "@/components/hub/lh-hub-logo";
import { markHubSession } from "@/lib/hub-session";
import { useBusinessContextStore } from "@/stores/business-context-store";
import { useQueryClient } from "@tanstack/react-query";

type AuthTab = "login" | "register" | "forgot" | "reset";

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Portfolio demo — always on in this repo (env is a fallback override only). */
const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
const DEMO_EMAIL = "demo@portfolio.com";
const DEMO_PASSWORD = "Demo123!";

export function HubAuthForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const resetBusinessContext = useBusinessContextStore((s) => s.resetBusinessContext);
  const [tab, setTab] = useState<AuthTab>("login");
  const [resetToken, setResetToken] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(IS_DEMO_MODE ? DEMO_EMAIL : "");
  const [password, setPassword] = useState(IS_DEMO_MODE ? DEMO_PASSWORD : "");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(IS_DEMO_MODE);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const isDemoMode = IS_DEMO_MODE;

  useEffect(() => {
    const token = searchParams.get("reset");
    if (token) {
      setResetToken(token);
      setTab("reset");
    }
  }, [searchParams]);

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (tab === "register" && !name.trim()) {
      next.name = "Informe seu nome";
    }
    if (tab === "forgot" || tab === "login" || tab === "register") {
      if (!email.trim()) {
        next.email = "Informe seu e-mail";
      } else if (!validateEmail(email)) {
        next.email = "E-mail inválido";
      }
    }
    if (tab === "login" || tab === "register" || tab === "reset") {
      if (!password) {
        next.password = "Informe sua senha";
      } else if (password.length < 8) {
        next.password = "Mínimo de 8 caracteres";
      } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        next.password = "Use letras e números na senha";
      }
    }
    if (tab === "register" || tab === "reset") {
      if (password !== confirmPassword) {
        next.confirmPassword = "As senhas não coincidem";
      }
    }
    if (tab === "reset" && !resetToken.trim()) {
      next.form = "Link de recuperação inválido. Solicite um novo.";
    }
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tab === "forgot") {
      await handleForgotSubmit();
      return;
    }
    if (tab === "reset") {
      await handleResetSubmit();
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    setErrors({});
    setInfoMessage(null);
    setDevResetUrl(null);

    try {
      const endpoint = tab === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        tab === "register"
          ? { email: email.trim(), name: name.trim(), password }
          : { email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        error?: string;
        user?: { id?: string; email: string; name: string };
      };

      if (!res.ok) {
        setErrors({ form: data.error ?? "Não foi possível continuar. Tente novamente." });
        return;
      }

      // Drop previous account's selected operation + cached KPIs from another session.
      resetBusinessContext(data.user?.id ?? null);
      queryClient.clear();

      markHubSession({
        email: data.user?.email ?? email.trim(),
        name: data.user?.name ?? (tab === "register" ? name.trim() : "Lucas"),
      });

      setSuccess(true);
      // Full navigation so the auth cookie is applied before middleware runs.
      window.location.assign("/");
      return;
    } catch {
      setErrors({ form: "Erro de conexão. Verifique sua rede e tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSubmit() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    setErrors({});
    setInfoMessage(null);
    setDevResetUrl(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = (await res.json()) as { message?: string; resetUrl?: string; error?: string };

      if (!res.ok) {
        setErrors({ form: data.error ?? "Não foi possível enviar a recuperação." });
        return;
      }

      setInfoMessage(
        data.message ??
          "Se este e-mail estiver cadastrado, você receberá instruções para redefinir a senha.",
      );
      if (data.resetUrl) setDevResetUrl(data.resetUrl);
    } catch {
      setErrors({ form: "Erro de conexão. Verifique sua rede e tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    setErrors({});
    setInfoMessage(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken.trim(), password }),
      });

      const data = (await res.json()) as { error?: string; message?: string };

      if (!res.ok) {
        setErrors({ form: data.error ?? "Não foi possível redefinir a senha." });
        return;
      }

      setSuccess(true);
      setInfoMessage(data.message ?? "Senha redefinida. Entre com a nova senha.");
      await new Promise((r) => setTimeout(r, 900));
      switchTab("login");
      router.replace("/login");
    } catch {
      setErrors({ form: "Erro de conexão. Verifique sua rede e tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  function switchTab(next: AuthTab) {
    setTab(next);
    setErrors({});
    setSuccess(false);
    setInfoMessage(null);
    setDevResetUrl(null);
    if (next !== "reset") {
      setResetToken("");
      setConfirmPassword("");
    }
    if (next === "login" && isDemoMode) {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
    } else if (next !== "reset") {
      setPassword("");
    }
  }

  return (
    <div className={cn("relative w-full max-w-[420px]", compact && "lg:max-w-[400px] xl:max-w-[420px]")}>
      {/* Borda gradiente animada */}
      <div className="relative rounded-3xl p-[1px] lg:rounded-2xl">
        <div className="hub-auth-glow absolute inset-0 rounded-3xl lg:rounded-2xl" />
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "hub-glass relative overflow-hidden rounded-3xl border border-[#00D4A8]/10 shadow-[0_0_40px_rgba(0, 212, 168,0.04),0_24px_64px_rgba(0,0,0,0.45)] lg:rounded-2xl",
            compact ? "p-6 lg:p-6" : "p-6 sm:p-8",
          )}
        >
          <motion.div
            className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-[#00D4A8]/6 blur-3xl"
            animate={{ opacity: [0.12, 0.22, 0.12], scale: [1, 1.04, 1] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-[#14B8A6]/5 blur-3xl"
            animate={{ opacity: [0.08, 0.16, 0.08] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />

          <div className={cn("relative", compact ? "space-y-4" : "space-y-6")}>
            <div className={cn("space-y-1 text-center sm:text-left", !compact && "space-y-2")}>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-xs text-[#A3A3A3] lg:text-sm"
              >
                {tab === "register"
                  ? HUB_COPY.holdingTagline
                  : tab === "forgot"
                    ? "Recuperação de acesso"
                    : tab === "reset"
                      ? "Nova senha"
                      : HUB_COPY.authWelcome}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.45 }}
                className="flex justify-center sm:justify-start"
              >
                {tab === "register" ? (
                  <LhHoldingLogo height={compact ? 112 : 120} className="max-w-[340px]" />
                ) : (
                  <h2
                    className={cn(
                      "font-extrabold tracking-tight",
                      compact ? "text-2xl lg:text-[1.75rem]" : "text-2xl sm:text-3xl",
                    )}
                  >
                    <span className="text-white">Ops </span>
                    <span className="hub-gradient-text">Hub</span>
                  </h2>
                )}
              </motion.div>
              <p className="text-xs text-[#737373] lg:line-clamp-2">
                {tab === "register"
                  ? "Crie sua conta no Ops Hub"
                  : tab === "forgot"
                    ? "Informe seu e-mail para receber o link de redefinição"
                    : tab === "reset"
                      ? "Escolha uma nova senha para sua conta"
                      : HUB_COPY.authSubtitle}
              </p>
            </div>

            {(tab === "forgot" || tab === "reset") && (
              <button
                type="button"
                onClick={() => switchTab("login")}
                className="-ml-1 flex min-h-[40px] items-center gap-1.5 px-1 text-xs text-[#A3A3A3] transition-colors hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao login
              </button>
            )}

            {(tab === "login" || tab === "register") && (
            <div className="relative flex rounded-xl border border-[#00D4A8]/15 bg-[#0B0B0B]/80 p-1 backdrop-blur-sm">
              {(["login", "register"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchTab(t)}
                  className={cn(
                    "relative z-10 flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-300",
                    tab === t ? "text-[#0B0B0B]" : "text-[#737373] hover:text-white",
                  )}
                >
                  {tab === t && (
                    <motion.div
                      layoutId="hub-auth-tab"
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#00D4A8] via-[#5EEAD4] to-[#14B8A6] shadow-[0_0_20px_rgba(0, 212, 168,0.35)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative">{t === "login" ? "Entrar" : "Criar conta"}</span>
                </button>
              ))}
            </div>
            )}

            {isDemoMode && tab === "login" ? (
              <div className="rounded-xl border border-[#00D4A8]/25 bg-[#00D4A8]/8 px-3.5 py-3 text-left text-[11px] leading-relaxed sm:text-xs">
                <p className="font-semibold text-[#5EEAD4]">Acesso rápido — conta limpa</p>
                <p className="mt-1.5 text-[#E5E5E5]">
                  E-mail: <span className="font-mono text-[#5EEAD4]">{DEMO_EMAIL}</span>
                </p>
                <p className="mt-0.5 text-[#E5E5E5]">
                  Senha: <span className="font-mono text-[#5EEAD4]">{DEMO_PASSWORD}</span>
                </p>
                <p className="mt-1.5 text-[#737373]">
                  Sem operações pré-carregadas. No produto real cada usuário cria as suas.
                </p>
              </div>
            ) : null}

          <form onSubmit={handleSubmit} className={cn(compact ? "space-y-3" : "space-y-4")} noValidate>
            <AnimatePresence mode="wait">
              {tab === "register" && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <HubField
                    id="name"
                    label="Nome"
                    type="text"
                    placeholder="Seu nome completo"
                    icon={User}
                    value={name}
                    onChange={setName}
                    error={errors.name}
                    autoComplete="name"
                    compact={compact}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {tab !== "reset" && (
            <HubField
              id="email"
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              icon={Mail}
              value={email}
              onChange={setEmail}
              error={errors.email}
              autoComplete="email"
              compact={compact}
            />
            )}

            {tab !== "forgot" && (
            <>
            <HubField
              id="password"
              label={tab === "reset" ? "Nova senha" : "Senha"}
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              icon={Lock}
              value={password}
              onChange={setPassword}
              error={errors.password}
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              compact={compact}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-[#737373] transition-colors duration-[250ms] hover:text-white"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <AnimatePresence mode="wait">
              {(tab === "register" || tab === "reset") && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <HubField
                    id="confirmPassword"
                    label="Confirmar senha"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    icon={Lock}
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    error={errors.confirmPassword}
                    autoComplete="new-password"
                    compact={compact}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="text-[#737373] transition-colors duration-[250ms] hover:text-white"
                        aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
            </>
            )}

            {tab === "login" && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-[#A3A3A3]">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-5 w-5 rounded border-[#333333] bg-[#0B0B0B] accent-[#00D4A8] sm:h-4 sm:w-4"
                  />
                  Lembrar de mim
                </label>
                <button
                  type="button"
                  className="min-h-[40px] px-1 text-[#00D4A8] transition-opacity duration-[250ms] hover:opacity-80"
                  onClick={() => switchTab("forgot")}
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            {infoMessage && (
              <p className="rounded-lg border border-[#00D4A8]/20 bg-[#00D4A8]/5 px-3 py-2 text-xs text-[#E5E5E5]">
                {infoMessage}
                {devResetUrl && (
                  <>
                    {" "}
                    <a href={devResetUrl} className="font-medium text-[#00D4A8] underline underline-offset-2">
                      Abrir link de redefinição (dev)
                    </a>
                  </>
                )}
              </p>
            )}

            {errors.form && (
              <p className="rounded-lg border border-[#00D4A8]/30 bg-[#00D4A8]/5 px-3 py-2 text-xs text-[#00D4A8]">
                {errors.form}
              </p>
            )}

            {success && (
              <motion.p
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400"
              >
                Acesso liberado — redirecionando ao painel...
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading || success}
              className={cn(
                "hub-shimmer-btn flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00D4A8] via-[#5EEAD4] to-[#14B8A6] text-sm font-bold text-[#0B0B0B] shadow-[0_4px_24px_rgba(0, 212, 168,0.35)] transition-all duration-300 hover:shadow-[0_6px_32px_rgba(0, 212, 168,0.5)] hover:brightness-105 disabled:opacity-60",
                compact ? "h-11" : "h-12",
              )}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {tab === "login"
                    ? "Entrar"
                    : tab === "register"
                      ? "Criar conta"
                      : tab === "forgot"
                        ? "Enviar link"
                        : "Redefinir senha"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#00D4A8]/10" />
              </div>
              <p className="relative mx-auto w-fit bg-[#0a0a0a]/90 px-3 text-[11px] text-[#525252]">ou continuar com</p>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => setErrors({ form: "Login com Google em breve." })}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl border border-[#00D4A8]/15 bg-[#0B0B0B]/50 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:border-[#00D4A8]/35 hover:bg-[#00D4A8]/5 disabled:opacity-50",
                compact ? "h-10 text-xs" : "h-11",
              )}
            >
              <GoogleIcon />
              Entrar com Google
            </button>
          </form>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { icon: Shield, label: "Conexão segura" },
              { icon: Cloud, label: "Backup automático" },
              { icon: Zap, label: "Alta performance" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="hub-trust-badge flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-center"
              >
                <Icon className="h-3.5 w-3.5 text-[#00D4A8]/80" strokeWidth={1.75} />
                <span className="text-[9px] leading-tight text-[#737373]">{label}</span>
              </div>
            ))}
          </div>
        </div>
        </motion.div>
      </div>
    </div>
  );
}

function HubField({
  id,
  label,
  type,
  placeholder,
  icon: Icon,
  value,
  onChange,
  error,
  autoComplete,
  trailing,
  compact = false,
}: {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete?: string;
  trailing?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-1", !compact && "space-y-1.5")}>
      <label htmlFor={id} className="text-xs font-medium text-[#A3A3A3]">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#525252]" />
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={cn(
            // text-base no celular evita o zoom automático do iOS ao focar.
            "h-12 w-full rounded-xl border bg-[#0B0B0B]/70 pl-10 pr-10 text-base text-white backdrop-blur-sm transition-all duration-300 placeholder:text-[#525252] focus:outline-none focus:ring-2 sm:h-11 sm:text-sm",
            compact && "sm:h-10 sm:text-[13px]",
            error
              ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
              : "border-[#333333]/80 focus:border-[#00D4A8]/60 focus:ring-[#00D4A8]/20 focus:shadow-[0_0_16px_rgba(0, 212, 168,0.08)]",
          )}
        />
        {trailing && <div className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-400"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
