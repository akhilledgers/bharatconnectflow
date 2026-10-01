import { useState } from "react";
import { Check, Filter } from "lucide-react";

export function FilterMenu<T extends string>({
  value,
  defaultValue,
  options,
  onChange,
}: {
  value: T;
  defaultValue: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value !== defaultValue;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative rounded-lg border p-2 hover:bg-accent ${
          active ? "border-primary text-primary" : "border-border text-muted-foreground"
        }`}
        title="Filter by Bharat Connect status"
      >
        <Filter className="h-4 w-4" />
        {active && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg">
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Bharat Connect status
            </div>
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${
                  value === o.value ? "font-medium text-foreground" : "text-foreground"
                }`}
              >
                {o.label}
                {value === o.value && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
