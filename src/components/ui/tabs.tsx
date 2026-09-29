import type { ComponentType, ReactNode } from "react";
import { cn } from "../../lib/cn";

// components.md → Tabs (segmented / pill / line) and Toggle group. Controlled; no panels —
// callers render the active panel themselves.
export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
}

const LIST = {
  segmented: "inline-flex shrink-0 items-center gap-2 rounded-lg border border-border/80 bg-muted/80 p-1",
  pill: "flex items-center gap-1 rounded-lg bg-transparent p-0",
  line: "flex w-full justify-start gap-6 rounded-none border-b border-border bg-transparent p-0 px-5 pt-2",
} as const;

const TRIGGER = {
  segmented:
    "cursor-pointer rounded-md px-3 py-1.5 text-sm font-normal text-foreground data-[state=active]:bg-background data-[state=active]:shadow-lg data-[state=active]:shadow-black/5",
  pill: "cursor-pointer inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary [&_svg]:size-4",
  line: "cursor-pointer relative rounded-none px-0 pb-3 pt-2 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:text-primary data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:h-[2px] data-[state=active]:after:w-full data-[state=active]:after:bg-primary",
} as const;

export function Tabs<T extends string>({
  variant = "segmented",
  items,
  value,
  onChange,
  className,
}: {
  variant?: keyof typeof LIST;
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn(LIST[variant], className)}>
      {items.map(({ value: v, label, icon: Icon, disabled }) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={v === value}
          data-state={v === value ? "active" : "inactive"}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={cn(TRIGGER[variant], "disabled:cursor-not-allowed disabled:opacity-50")}
        >
          {Icon && <Icon />}
          {label}
        </button>
      ))}
    </div>
  );
}

export function ToggleGroup<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" className={cn("flex w-fit items-center rounded-md shadow-xs shadow-black/5", className)}>
      {items.map(({ value: v, label }) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          data-state={v === value ? "on" : "off"}
          onClick={() => onChange(v)}
          className="h-8.5 min-w-8.5 cursor-pointer border border-s-0 border-input bg-transparent px-2.5 text-2sm font-medium text-foreground first:rounded-s-md first:border-s last:rounded-e-md hover:bg-accent data-[state=on]:bg-accent"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
