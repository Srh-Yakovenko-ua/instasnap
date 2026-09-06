import type { LoanHistoryResult } from "@app/shared";

import type { UiIconName } from "@/components/icons";

export const LOAN_HISTORY_RESULT_LOOK = {
  late: {
    hoverSurfaceClass: "hover:border-warning/50 hover:bg-warning-soft",
    icon: "clock",
    surfaceClass: "border-warning/25 bg-warning-soft/60",
    toneClass: "text-warning",
  },
  no_due_date: {
    hoverSurfaceClass: "hover:border-accent-border hover:bg-secondary",
    icon: "circle-slash",
    surfaceClass: "border-border bg-secondary/60",
    toneClass: "text-muted-foreground",
  },
  on_time: {
    hoverSurfaceClass: "hover:border-success/50 hover:bg-success-soft",
    icon: "check-circle",
    surfaceClass: "border-success/25 bg-success-soft/60",
    toneClass: "text-success",
  },
} as const satisfies Record<
  LoanHistoryResult,
  { hoverSurfaceClass: string; icon: UiIconName; surfaceClass: string; toneClass: string }
>;
