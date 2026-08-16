"use client";

import { motion } from "framer-motion";
import { Radio, Shield, Zap } from "lucide-react";
import { LhHoldingIcon, LhHoldingLogo } from "@/components/hub/lh-hub-logo";
import { HUB_COPY } from "@/constants/hub-brand";

const LIVE_UNITS = [{ index: "01" }, { index: "02" }] as const;

function StatusStrip({ index, delay }: { index: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ x: 4 }}
      className="hub-glass-card flex items-center gap-3 rounded-xl border border-[#00D4A8]/12 px-3.5 py-3"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#00D4A8]/10 ring-1 ring-[#00D4A8]/15">
        <LhHoldingIcon height={22} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-white">
          {index} · Canal operacional
        </p>
        <p className="text-[10px] text-[#737373]">Sincronizado agora</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Online
        </span>
        <span className="inline-flex items-center gap-1 text-[9px] text-[#737373]">
          <Zap className="h-2.5 w-2.5 text-[#00D4A8]/80" />
          Tempo real
        </span>
      </div>
    </motion.div>
  );
}

export function HubLeftPanel() {
  return (
    <div className="relative flex h-full min-h-[50vh] flex-col lg:min-h-0">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 lg:mb-10"
          >
            <LhHoldingLogo height={110} className="max-w-[320px]" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-lg"
          >
            <h1 className="text-[1.85rem] font-extrabold leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
              {HUB_COPY.heroTitle}
              <span className="mt-1 block hub-gradient-text">{HUB_COPY.heroHighlight}</span>
            </h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mt-5 max-w-md text-sm leading-relaxed text-[#A3A3A3] lg:text-[15px]"
            >
              {HUB_COPY.heroDescription}
            </motion.p>
          </motion.div>
        </div>

        <div className="mt-10 space-y-4 lg:mt-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28 }}
            className="flex items-center gap-2"
          >
            <Radio className="h-3 w-3 text-[#00D4A8]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#00D4A8]/85">
              {HUB_COPY.enterprisesHeading}
            </p>
          </motion.div>

          <div className="max-w-md space-y-2.5">
            {LIVE_UNITS.map((unit, i) => (
              <StatusStrip key={unit.index} index={unit.index} delay={0.32 + i * 0.08} />
            ))}
          </div>

          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="flex max-w-md items-start gap-2.5 pt-4 text-[11px] leading-relaxed text-[#525252]"
          >
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00D4A8]/60" />
            <p>{HUB_COPY.footerLegacy}</p>
          </motion.footer>
        </div>
      </div>
    </div>
  );
}
