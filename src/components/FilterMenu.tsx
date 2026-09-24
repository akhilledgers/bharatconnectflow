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
        className={`relative rounded-lg border p-2 hover:bg-gray-50 ${
          active ? "border-primary text-primary" : "border-gray-200 text-faint"
        }`}
        title="Filter by BharatConnect status"
      >
        <Filter className="h-4 w-4" />
        {active && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg">
            <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-faint">
              BharatConnect status
            </div>
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  value === o.value ? "font-medium text-ink" : "text-body"
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
