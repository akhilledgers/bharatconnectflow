import type { ReactNode } from "react";
import type { FieldMeta } from "./fieldConfig";

/** Plain label/value row — same shape as the connected overview page's detail rows. */
export function ReadonlyRow({ meta, value }: { meta: FieldMeta; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <span className="shrink-0 text-sm text-faint">
        {meta.label}
        {meta.tag && <span className="ml-1.5 text-xs text-faint">({meta.tag})</span>}
      </span>
      <span className="text-right text-sm text-ink">{value}</span>
    </div>
  );
}

interface FieldShellProps {
  meta: FieldMeta;
  changed: boolean;
  error?: string;
  hint?: string;
  /** "row": label left, boxed control right (short values). "block": label above, full-width content below (lists). */
  layout?: "row" | "block";
  children: ReactNode;
}

// Every field — read-only or editable — lives in the same divided-row list, so the
// only thing that visually marks a field as editable is its input box, not the layout.
export function FieldShell({ meta, changed, error, hint, layout = "row", children }: FieldShellProps) {
  return (
    <div className="relative">
      {changed && (
        <span className="absolute -left-3 top-0 h-full w-[3px] rounded-full bg-primary" aria-hidden />
      )}
      {layout === "row" ? (
        <div className="flex items-center justify-between gap-6 py-3">
          <span className="shrink-0 text-sm text-faint">{meta.label}</span>
          <div className="w-64 shrink-0">{children}</div>
        </div>
      ) : (
        <div className="py-3">
          <label className="mb-2 block text-sm text-faint">{meta.label}</label>
          {children}
        </div>
      )}
      {hint && <p className={`pb-2 text-xs text-faint ${layout === "row" ? "text-right" : ""}`}>{hint}</p>}
      {error && <p className="pb-2 text-[13px] text-red-800">{error}</p>}
    </div>
  );
}

const boxClass = "w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2";
const boxOk = "border-[#d1d5db] focus:border-primary focus:ring-primary/30";
const boxErr = "border-red-300 focus:border-red-400 focus:ring-red-300/40";

export function TextInput({
  value,
  onChange,
  error,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${boxClass} ${error ? boxErr : boxOk}`}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  error,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${boxClass} ${error ? boxErr : boxOk}`}>
      {children}
    </select>
  );
}
