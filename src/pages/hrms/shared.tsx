import type { ReactNode } from "react";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/cn";
import type { Employee } from "./types";

// Small pieces shared by the HRMS screens.

export const toolbarBtn =
  "inline-flex h-8.5 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-xs shadow-black/5 hover:bg-accent [&_svg]:size-4 [&_svg]:opacity-60 cursor-pointer";

export const panelCls = "overflow-hidden rounded-xl border border-border bg-card shadow-xs shadow-black/5";

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h1 className="text-xl font-medium text-foreground">{children}</h1>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: Employee["status"] }) {
  return <Badge variant={status === "active" ? "success" : "secondary"}>{status === "active" ? "Active" : "Inactive"}</Badge>;
}

export function StatCard({ label, value, hint, tone, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-xs shadow-black/5", className)}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold text-foreground", tone)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-blue-500/10 font-medium text-blue-600"
      style={{ width: size, height: size, fontSize: size / 2.8 }}
    >
      {initials}
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}
