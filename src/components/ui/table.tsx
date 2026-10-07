import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

// components.md → Data grid. Class constants so existing <table> markup converts in place.
export const tableCls = "w-full caption-bottom border-separate border-spacing-0 text-left align-middle text-sm font-normal text-foreground";
export const thCls = "relative h-10 border-b border-border px-4 text-left align-middle text-sm font-normal text-secondary-foreground/80 whitespace-nowrap";
export const trCls = "hover:bg-muted/40";
export const tdCls = "border-b border-border px-4 py-3 align-middle";
/** Line-item tables (invoice editor) use uppercase xs headers. */
export const lineThCls = "h-12 border-b border-border px-4 text-left align-middle text-xs font-medium uppercase text-muted-foreground";

export function TablePagination({ from, to, total, children }: { from: number; to: number; total: number; children?: ReactNode }) {
  return (
    <div className="flex grow flex-col items-center justify-between gap-2.5 py-2.5 sm:flex-row">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        Rows per page
        <span className="inline-flex h-7 items-center rounded-md border border-input px-2 text-xs text-foreground">10</span>
      </div>
      <div className="flex items-center gap-3">
        {/* LEDGERS footer format: "1 - 10 of 10641". */}
        <span className="text-sm text-muted-foreground tabular-nums">
          {total === 0 ? 0 : from} - {to} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button disabled className={cn(pageBtn, "text-muted-foreground")} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </button>
          <button className={cn(pageBtn, "bg-accent text-accent-foreground")}>1</button>
          <button disabled className={cn(pageBtn, "text-muted-foreground")} aria-label="Next page">
            <ChevronRight className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const pageBtn = "inline-flex size-7 items-center justify-center rounded-md p-0 text-sm disabled:opacity-50";
