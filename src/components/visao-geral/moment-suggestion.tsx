"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { resolveMomentSuggestion } from "@/lib/visao-geral";
import { resolveUserTimeZone } from "@/lib/time-greeting";

export function MomentSuggestion() {
  const [suggestion, setSuggestion] = useState(() =>
    resolveMomentSuggestion(resolveUserTimeZone()),
  );

  useEffect(() => {
    setSuggestion(resolveMomentSuggestion(resolveUserTimeZone()));
  }, []);

  const Icon = suggestion.icon;

  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12, duration: 0.4 }}
      className="rounded-2xl border border-brand-orange/25 bg-gradient-to-br from-brand-orange/[0.08] via-surface-card to-surface-card p-4 sm:p-5"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-orange">
        {suggestion.eyebrow}
      </p>
      <div className="mt-3 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-text-primary sm:text-lg">{suggestion.title}</h3>
          <p className="mt-1 text-sm text-text-secondary">{suggestion.description}</p>
        </div>
      </div>
      <Link
        href={suggestion.href}
        className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-brand-orange/15 px-4 text-sm font-bold text-brand-orange transition-colors hover:bg-brand-orange/25 sm:w-auto"
      >
        {suggestion.cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.aside>
  );
}
