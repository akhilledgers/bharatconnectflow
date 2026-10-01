import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { useStore } from "../../../store/useStore";
import type { Business } from "../../../types";
import { existingIdFor } from "../../../lib/id-standard";

export function LinkExistingId({ business }: { business: Business }) {
  const linkExistingId = useStore((s) => s.linkExistingId);
  const [linking, setLinking] = useState(false);

  async function handleLink() {
    setLinking(true);
    await linkExistingId(business.id);
    setLinking(false);
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-foreground">We found your Bharat Connect B2B ID</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        An active ID already exists for this PAN. Link it to {business.name.toLowerCase().includes("limited") ? "this company" : "this business"} in one click — nothing else to fill in.
      </p>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3.5">
          <div>
            <div className="text-xs text-muted-foreground">Existing Bharat Connect B2B ID</div>
            <div className="mt-0.5 tabular-nums text-lg font-semibold text-foreground">{existingIdFor(business)}</div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Active</span>
        </div>
        <p className="mt-4 text-sm text-foreground">
          This ID was registered under PAN {business.pan}. Linking it here lets you send and receive invoices from
          this business in LEDGERS — the ID itself doesn't change.
        </p>
        <button
          onClick={handleLink}
          disabled={linking}
          className="mt-5 flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {linking ? "Linking…" : "Link existing ID"}
        </button>
      </div>
    </div>
  );
}
