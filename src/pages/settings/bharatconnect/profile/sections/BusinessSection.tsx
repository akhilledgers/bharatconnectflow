import { useState } from "react";
import type { Business } from "../../../../../types";
import type { useProfileForm } from "../useProfileForm";
import { FIELD_CONFIG } from "../fieldConfig";
import { FieldShell, ProfileSection, ReadonlyRow, SelectInput, TextInput } from "../fields";
import { Button } from "../../../../../components/ui/button";
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
    <ProfileSection id="business" title="Business Details" description="Shared with businesses you trade with on Bharat Connect.">
        <ReadonlyRow meta={FIELD_CONFIG.legalName} value={business.name} />
        <ReadonlyRow meta={FIELD_CONFIG.businessType} value={businessTypeLabel} />

        <FieldShell meta={FIELD_CONFIG.tradeName} changed={changedFieldIds.includes("tradeName")}>
          <TextInput value={draft.tradeName} onChange={(v) => setField("tradeName", v)} />
        </FieldShell>

        {mccRequired || mccExpanded ? (
          <FieldShell
            meta={{ ...FIELD_CONFIG.mcc, label: mccRequired ? "Business Category (MCC)" : FIELD_CONFIG.mcc.label }}
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
          <div className="flex min-h-[50px] items-center justify-between gap-6 py-2">
            <span className="text-2sm text-muted-foreground">Business Category (MCC) — needed once you enable payments</span>
            <Button variant="outline" size="sm" onClick={() => setMccExpanded(true)}>
              Add Now
            </Button>
          </div>
        )}
    </ProfileSection>
  );
}
