import { Check } from "lucide-react";
import { CircularSpinner } from "../../../components/layout/CircularSpinner";
import type { Business } from "../../../types";

export function SettingUp({ business }: { business: Business }) {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-foreground">Setting up Bharat Connect</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Your registration for {business.name} is with Bharat Connect. You can leave this page — we'll email and
        notify you in-app the moment it's confirmed.
      </p>

      <div className="rounded-xl border border-border bg-card px-6 py-8">
        <div className="space-y-4">
          {["Details sent to Bharat Connect", "ID created", "Waiting for confirmation"].map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                  i < 2 ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary"
                }`}
              >
                {i < 2 ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : 3}
              </span>
              <span className="text-foreground">{label}</span>
              {i === 2 && <CircularSpinner size={14} className="ml-1" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
