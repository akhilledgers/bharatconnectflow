import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/** Value colours used by the stat cards elsewhere in LEDGERS (Invoices, Contacts). */
const STAT_TONE = {
  primary: "text-primary",
  good: "text-emerald-600",
  warn: "text-amber-600",
  bad: "text-red-600",
  purple: "text-purple-600",
  muted: "text-muted-foreground",
} as const;

/** Same card as the Invoices / Bills stat row: label, coloured figure, one muted line under it. */
export function StatCard({ label, value, tone = "primary", sub }: { label: string; value: ReactNode; tone?: keyof typeof STAT_TONE; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-5">
      <div className="text-sm text-foreground">{label}</div>
      <div className={cn("mt-2 truncate text-xl font-semibold tabular-nums", STAT_TONE[tone])}>{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** A small text link that sits in a stat card's sub-line. */
export function StatLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer font-medium text-primary hover:underline">
      {children}
    </button>
  );
}
