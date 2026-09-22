import { useState } from "react";
import { useStore } from "../../../store/useStore";
import type { Business } from "../../../types";

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
      <h1 className="mb-1 text-2xl font-semibold text-ink">We found your BharatConnect ID</h1>
      <p className="mb-6 text-sm text-faint">
        An active ID already exists for this PAN. Link it to {business.name.toLowerCase().includes("limited") ? "this company" : "this business"} in one click — nothing else to fill in.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3.5">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-faint">Existing BharatConnect ID</div>
            <div className="mt-0.5 font-mono text-lg font-semibold text-ink">{business.pan}@BCB</div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Active</span>
        </div>
        <p className="mt-4 text-sm text-body">
          This ID was registered under PAN {business.pan}. Linking it here lets you send and receive invoices from
          this business in LEDGERS — the ID itself doesn't change.
        </p>
        <button
          onClick={handleLink}
          disabled={linking}
          className="mt-5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {linking ? "Linking…" : "Link existing ID"}
        </button>
      </div>
    </div>
  );
}
