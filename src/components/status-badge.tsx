import type { TournamentStatus } from "@/data/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS: Record<TournamentStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  draft: { label: "Draft", variant: "secondary" },
  registration_open: { label: "Registration open", variant: "outline", className: "text-success" },
  registration_closed: { label: "Registration closed", variant: "outline", className: "text-warning" },
  in_progress: { label: "Live", variant: "default" },
  completed: { label: "Completed", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export function StatusBadge({ status }: { status: TournamentStatus }) {
  const { label, variant, className } = STATUS[status];
  return (
    <Badge variant={variant} className={cn(className)}>
      {label}
    </Badge>
  );
}
