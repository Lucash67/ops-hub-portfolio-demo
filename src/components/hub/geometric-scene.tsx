"use client";

import { motion } from "framer-motion";

/** Fundo animado — versão minimal para hero limpo. */
export function GeometricScene({ minimal = false }: { minimal?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_30%_20%,rgba(0, 212, 168,0.14),transparent_60%)]" />

      {!minimal && (
        <>
          <motion.div
            className="absolute -left-16 top-[2%] h-72 w-72 rounded-full bg-[#00D4A8]/20 blur-[90px]"
            animate={{ opacity: [0.25, 0.5, 0.25], scale: [1, 1.12, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            animate={{ y: [0, 48] }}
            transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 opacity-[0.06]"
          >
            <svg className="h-[calc(100%+48px)] w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="hub-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                  <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#00D4A8" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#hub-grid)" />
            </svg>
          </motion.div>
        </>
      )}

      {minimal && (
        <motion.div
          className="absolute right-[8%] top-[18%] h-64 w-64 rounded-full bg-[#00D4A8]/8 blur-[100px]"
          animate={{ opacity: [0.3, 0.55, 0.3], x: [0, 12, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#00D4A8]/6 to-transparent" />
    </div>
  );
}
