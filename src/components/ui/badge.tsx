import { cn } from "./utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
}

const variants = {
  default: "bg-surface-elevated text-text-secondary border-surface-border",
  success: "bg-brand-green/10 text-brand-green border-brand-green/20",
  warning: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  error: "bg-brand-red/10 text-brand-red border-brand-red/20",
  info: "bg-brand-orange/10 text-brand-orange border-brand-orange/20",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
