import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/** A row of filter chips with counts; the selected one is tinted blue. Used across the Banking tabs. */
export function FilterChips<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: ReactNode; count?: number; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1">
      {items.map((f) => (
        <button
          key={f.value}
          type="button"
          role="tab"
          aria-selected={value === f.value}
          onClick={() => onChange(f.value)}
          className={cn(
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-2sm text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-3.5",
            value === f.value && "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary",
          )}
        >
          {f.icon}
          {f.label}
          {f.count !== undefined && <span className="tabular-nums opacity-70">{f.count}</span>}
        </button>
      ))}
    </div>
  );
}
