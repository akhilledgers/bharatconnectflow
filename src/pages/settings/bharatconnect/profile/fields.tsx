import type { ReactNode } from "react";
import type { FieldMeta } from "./fieldConfig";
import { Badge } from "../../../../components/ui/badge";
import { Input, Select } from "../../../../components/ui/input";
import { cn } from "../../../../lib/cn";

// Every field — read-only or editable — is the same two-column row: label (with its source or
// "Edited" badge) on the left, value or control on the right. The only thing marking a field
// editable is its input box, not the layout.
const ROW = "grid grid-cols-[minmax(0,300px)_minmax(0,1fr)] items-center gap-6 border-b border-border py-2 min-h-[50px] last:border-b-0";

/** Source tags read as short badges ("GST portal"), not bracketed text. */
function sourceLabel(tag: string): string {
  return tag.replace(/^From /, "");
}

function RowLabel({ meta, changed }: { meta: FieldMeta; changed?: boolean }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-2sm text-muted-foreground">
      <span>{meta.label}</span>
      {meta.tag && (
        <Badge variant="secondary" className="h-5 text-[11px]">
          {sourceLabel(meta.tag)}
        </Badge>
      )}
      {changed && (
        <Badge variant="warning" className="h-5 text-[11px]">
          Edited
        </Badge>
      )}
    </div>
  );
}

/** Plain label/value row — same shape as the connected overview page's detail rows. */
export function ReadonlyRow({ meta, value }: { meta: FieldMeta; value: ReactNode }) {
  return (
    <div className={ROW}>
      <RowLabel meta={meta} />
      <div className="justify-self-end text-right text-2sm text-foreground">{value}</div>
    </div>
  );
}

interface FieldShellProps {
  meta: FieldMeta;
  changed: boolean;
  error?: string;
  hint?: string;
  /** "row": short control (360px). "block": wider content for lists and address groups. */
  layout?: "row" | "block";
  children: ReactNode;
}

export function FieldShell({ meta, changed, error, hint, layout = "row", children }: FieldShellProps) {
  return (
    <div className={cn(ROW, layout === "block" && "items-start py-3")}>
      <div className={layout === "block" ? "pt-2" : undefined}>
        <RowLabel meta={meta} changed={changed} />
      </div>
      <div className={cn("flex w-full flex-col gap-1.5 justify-self-end", layout === "row" ? "max-w-[360px]" : "max-w-[520px]")}>
        {children}
        {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

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
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-invalid={error ? true : undefined} />;
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
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined}>
      {children}
    </Select>
  );
}

/** Section wrapper inside the profile card: heading, optional description, rows. */
export function ProfileSection({
  id,
  title,
  description,
  aside,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    // scroll-mt clears the fixed top bar plus the sticky section tabs.
    <section id={id} className="scroll-mt-[120px] border-b border-border px-5 pb-2 pt-5 last:border-b-0">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </div>
      <div>{children}</div>
    </section>
  );
}
