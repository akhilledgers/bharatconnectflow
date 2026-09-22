import type { Business } from "../../../../../types";
import { FIELD_CONFIG } from "../fieldConfig";
import { ReadonlyRow } from "../fields";

export function TaxSection({ business }: { business: Business }) {
  const defaultId = business.bharatConnectIds.find((i) => i.status === "active");

  return (
    <section id="tax" className="scroll-mt-28">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Tax &amp; legal IDs</h2>
        {business.bharatConnectIds.length > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-body">
            {business.bharatConnectIds.filter((i) => i.status === "active").length} active ID
            {business.bharatConnectIds.filter((i) => i.status === "active").length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        <ReadonlyRow meta={FIELD_CONFIG.pan} value={business.pan} />
        <ReadonlyRow meta={FIELD_CONFIG.gstin} value={business.gstin ?? "Not on file"} />
        <ReadonlyRow
          meta={FIELD_CONFIG.defaultBcId}
          value={
            defaultId ? (
              <span className="font-mono">{defaultId.id}</span>
            ) : (
              <span className="text-faint">Not connected yet</span>
            )
          }
        />
      </div>
    </section>
  );
}
