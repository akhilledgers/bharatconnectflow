import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

// components.md → Dropdown menu. Surface + item classes; positioning stays with each caller.
export const popoverCls = "rounded-md border border-border bg-popover text-popover-foreground shadow-md shadow-black/5";
export const menuItemCls =
  "relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal text-foreground hover:bg-accent [&_svg]:size-4 [&_svg]:opacity-60";

/** Callout / banner used for in-page nudges (connect, pending actions, needs attention). */
export function Callout({
  tone = "neutral",
  icon,
  title,
  children,
  actions,
  className,
}: {
  tone?: "neutral" | "primary" | "destructive" | "success";
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const toneCls = {
    neutral: "border-border bg-card",
    primary: "border-blue-500/25 bg-blue-50/70",
    destructive: "border-red-600/25 bg-red-50/80",
    success: "border-emerald-600/35 bg-emerald-50/90",
  }[tone];
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xs shadow-black/5", toneCls, className)}>
      {icon && <div className="shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">
        {title && <div className="text-sm font-medium text-foreground">{title}</div>}
        {children && <div className="text-xs text-muted-foreground">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
