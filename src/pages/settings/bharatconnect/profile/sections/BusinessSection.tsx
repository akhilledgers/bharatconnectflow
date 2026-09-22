import { useState } from "react";
import type { Business } from "../../../../../types";
import type { useProfileForm } from "../useProfileForm";
import { FIELD_CONFIG } from "../fieldConfig";
import { FieldShell, ReadonlyRow, SelectInput, TextInput } from "../fields";
import { MCC_CODES } from "../../../../../lib/profile";

export function BusinessSection({
  business,
  form,
}: {
  business: Business;
  form: ReturnType<typeof useProfileForm>;
}) {
  const { draft, changedFieldIds, setField } = form;
  const businessTypeLabel = business.businessType === "sole_proprietor" ? "Sole proprietor" : "Company";

  // MCC only matters once full verification (Level 3) is relevant — before that,
  // keep it out of the way instead of showing it as a loose optional dropdown.
  const mccRequired = business.verification.level >= 2;
  const [mccExpanded, setMccExpanded] = useState(false);

  return (
    <section id="business" className="scroll-mt-28">
      <h2 className="mb-1 text-base font-semibold text-ink">Business details</h2>

      <div className="divide-y divide-gray-100">
        <ReadonlyRow meta={FIELD_CONFIG.legalName} value={business.name} />
        <ReadonlyRow meta={FIELD_CONFIG.businessType} value={businessTypeLabel} />

        <FieldShell meta={FIELD_CONFIG.tradeName} changed={changedFieldIds.includes("tradeName")}>
          <TextInput value={draft.tradeName} onChange={(v) => setField("tradeName", v)} />
        </FieldShell>

        {mccRequired || mccExpanded ? (
          <FieldShell
            meta={{ ...FIELD_CONFIG.mcc, label: mccRequired ? "Business category (MCC)" : FIELD_CONFIG.mcc.label }}
            changed={changedFieldIds.includes("mcc")}
            hint={mccRequired ? "Needed for full verification." : "Needed before you enable payments, not for invoicing."}
          >
            <SelectInput value={draft.mcc ?? ""} onChange={(v) => setField("mcc", v || null)}>
              <option value="">Not set</option>
              {MCC_CODES.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code} · {m.label}
                </option>
              ))}
            </SelectInput>
          </FieldShell>
        ) : (
          <div className="flex items-center justify-between gap-6 py-3">
            <span className="text-sm text-faint">Business category (MCC) — needed once you enable payments</span>
            <button onClick={() => setMccExpanded(true)} className="shrink-0 text-sm font-medium text-primary hover:text-primary-hover">
              Add now
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
