import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

// ReUI light badges (components.md → Badge). Status → variant mapping lives with each status helper.
const VARIANTS = {
  success: "text-[var(--color-success-accent)] bg-[var(--color-success-soft)]",
  warning: "text-[var(--color-warning-accent)] bg-[var(--color-warning-soft)]",
  destructive: "text-[var(--color-destructive-accent)] bg-[var(--color-destructive-soft)]",
  primary: "text-[var(--color-primary-accent)] bg-[var(--color-primary-soft)]",
  info: "text-[var(--color-info-accent)] bg-[var(--color-info-soft)]",
  secondary: "bg-secondary text-secondary-foreground",
} as const;

export type BadgeVariant = keyof typeof VARIANTS;

export function Badge({ variant = "secondary", className, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex h-6 min-w-6 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-[0.45rem] text-xs font-normal [&_svg]:size-3.5",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
