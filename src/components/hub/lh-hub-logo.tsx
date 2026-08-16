import { cn } from "@/components/ui/utils";
import { LhMonogram } from "@/components/hub/lh-monogram";
import { HUB_COPY } from "@/constants/hub-brand";

type HubLogoVariant = "horizontal" | "horizontal-compact" | "stacked" | "icon";

interface BrandLogoProps {
  className?: string;
  /** Altura renderizada em px */
  height?: number;
  /** @deprecated use height */
  iconSize?: number;
}

function resolveHeight(height?: number, iconSize?: number, fallback = 40): number {
  return height ?? iconSize ?? fallback;
}

/**
 * Placeholders tipográficos + monograma SVG (mint).
 * PNGs de marca foram removidos — aguardando assets novos na paleta teal.
 */
export function LhHubLogo({
  variant = "horizontal",
  className,
  height,
  iconSize,
}: BrandLogoProps & { variant?: HubLogoVariant }) {
  const h = resolveHeight(height, iconSize, variant === "icon" ? 28 : 40);

  if (variant === "icon") {
    return <LhMonogram size={h} className={className} />;
  }

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)} style={{ height: h }}>
      <LhMonogram size={Math.round(h * 0.85)} />
      <span className="text-[1.05em] font-bold tracking-tight text-white" style={{ fontSize: h * 0.42 }}>
        LH <span className="text-brand-yellow">Hub</span>
      </span>
    </div>
  );
}

export function LhHoldingLogo({ className, height, iconSize }: BrandLogoProps) {
  const h = resolveHeight(height, iconSize, 44);

  return (
    <div
      className={cn("inline-flex flex-col items-start justify-center gap-1", className)}
      style={{ minHeight: h }}
    >
      <div className="inline-flex items-center gap-3">
        <LhMonogram size={Math.min(56, Math.round(h * 0.55))} />
        <div className="leading-tight">
          <p className="text-lg font-bold tracking-tight text-white sm:text-xl">
            LH <span className="text-brand-yellow">Empreendimentos</span>
          </p>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
            {HUB_COPY.holdingTagline}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LhHoldingIcon({ className, height, iconSize }: BrandLogoProps) {
  const h = resolveHeight(height, iconSize, 36);
  return <LhMonogram size={h} className={className} />;
}
