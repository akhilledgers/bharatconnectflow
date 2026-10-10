import { useState } from "react";
import { Check, Funnel } from "lucide-react";
import { popoverCls } from "./ui/popover";

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
        className={`relative inline-flex h-8 items-center justify-center rounded-md border bg-background px-2.5 shadow-xs shadow-black/5 hover:bg-accent ${
          active ? "border-primary text-primary" : "border-input text-foreground [&_svg]:opacity-60"
        }`}
        title="Filter by Bharat Connect status"
      >
        <Funnel className="size-4" />
        {active && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 z-20 mt-1 w-56 space-y-0.5 p-1 ${popoverCls}`}>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Bharat Connect status
            </div>
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
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
