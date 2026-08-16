import { cn } from "@/components/ui/utils";

interface LhMonogramProps {
  className?: string;
  size?: number;
}

/** Monograma LH — barras arquitetônicas da identidade LH Empreendimentos. */
export function LhMonogram({ className, size = 48 }: LhMonogramProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="lh-mint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5EEAD4" />
          <stop offset="100%" stopColor="#00D4A8" />
        </linearGradient>
      </defs>
      {/* L — barra esquerda + base */}
      <rect x="4" y="8" width="10" height="32" rx="1" fill="url(#lh-mint)" />
      <rect x="4" y="34" width="22" height="6" rx="1" fill="url(#lh-mint)" />
      {/* H — duas colunas + travessa */}
      <rect x="22" y="8" width="8" height="32" rx="1" fill="url(#lh-mint)" />
      <rect x="36" y="8" width="8" height="32" rx="1" fill="url(#lh-mint)" />
      <rect x="22" y="20" width="22" height="6" rx="1" fill="url(#lh-mint)" />
    </svg>
  );
}

interface LhMonogramOutlineProps {
  className?: string;
}

/**
 * Outline geométrico do monograma oficial LH Empreendimentos (skyline).
 * Quatro pilares em stroke fino + filetes internos (wireframe).
 */
export function LhMonogramOutline({ className }: LhMonogramOutlineProps) {
  return (
    <svg
      viewBox="0 0 220 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)}
      aria-hidden
    >
      <g stroke="#00D4A8" strokeLinejoin="miter" vectorEffect="non-scaling-stroke">
        {/* Contornos principais */}
        <path d="M18 122V68L62 46V122H18Z" strokeWidth="1.25" />
        <path d="M74 122V32H80V122H74Z" strokeWidth="1.25" />
        <path d="M92 122V36L138 14V122H92Z" strokeWidth="1.25" />
        <path d="M138 122V14L192 42V122H138Z" strokeWidth="1.25" />
        {/* Filetes internos — profundidade wireframe */}
        <path d="M30 118V72L54 58" strokeWidth="0.7" opacity="0.45" />
        <path d="M104 118V40L130 26" strokeWidth="0.7" opacity="0.4" />
        <path d="M150 118V28L178 48" strokeWidth="0.7" opacity="0.4" />
        <path d="M18 122H192" strokeWidth="0.8" opacity="0.35" />
      </g>
    </svg>
  );
}
