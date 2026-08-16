import { Badge } from "@/components/ui/badge";
import type { ClientBadge } from "@/lib/client-crm-view";

const BADGE_VARIANT: Record<
  ClientBadge["type"],
  "default" | "success" | "warning" | "error" | "info"
> = {
  vip: "warning",
  recorrente: "success",
  novo: "info",
  frequente: "info",
  inativo: "error",
};

interface ClientBadgeChipProps {
  badge: ClientBadge;
  compact?: boolean;
}

export function ClientBadgeChip({ badge, compact }: ClientBadgeChipProps) {
  return (
    <Badge variant={BADGE_VARIANT[badge.type]} className="gap-1">
      <span aria-hidden>{badge.emoji}</span>
      {compact ? badge.label.replace("Cliente ", "") : badge.label}
    </Badge>
  );
}
