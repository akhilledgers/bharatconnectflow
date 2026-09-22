import type { Business } from "../../../../../types";
import type { useProfileForm } from "../useProfileForm";
import { FIELD_CONFIG } from "../fieldConfig";
import { FieldShell, ReadonlyRow, SelectInput } from "../fields";
import { generatePaymentAddress } from "../../../../../lib/profile";

export function SettlementSection({
  business,
  form,
}: {
  business: Business;
  form: ReturnType<typeof useProfileForm>;
}) {
  const { draft, changedFieldIds, rejectedFieldId, rejectedMessage, setField } = form;
  const verifiedAccounts = business.bankAccounts.filter((a) => a.verified);
  const selected = verifiedAccounts.find((a) => a.id === draft.settlementAccountId);
  const rejected = rejectedFieldId === "settlementAccountId";

  return (
    <section id="settlement" className="scroll-mt-28">
      <h2 className="mb-1 text-base font-semibold text-ink">Settlement account</h2>

      <div className="divide-y divide-gray-100">
        <FieldShell
          meta={FIELD_CONFIG.settlementAccount}
          changed={changedFieldIds.includes("settlementAccountId")}
          error={rejected ? rejectedMessage ?? undefined : undefined}
          hint="Only accounts already verified in LEDGERS Banking can be selected."
        >
          <SelectInput
            value={draft.settlementAccountId ?? ""}
            onChange={(v) => setField("settlementAccountId", v || null)}
            error={rejected ? rejectedMessage ?? undefined : undefined}
          >
            <option value="">None selected</option>
            {verifiedAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.beneficiaryName} · {a.ifsc} ending {a.accountEnding}
              </option>
            ))}
          </SelectInput>
        </FieldShell>

        <FieldShell meta={FIELD_CONFIG.useAsDefault} changed={changedFieldIds.includes("useAsDefault")}>
          <div className="flex justify-end">
            <input
              type="checkbox"
              checked={draft.useAsDefault}
              onChange={(e) => setField("useAsDefault", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </div>
        </FieldShell>

        <ReadonlyRow
          meta={FIELD_CONFIG.paymentAddress}
          value={
            selected ? (
              <span className="font-mono">{generatePaymentAddress(business, selected.accountEnding)}</span>
            ) : (
              <span className="text-faint">Select an account to generate one</span>
            )
          }
        />
      </div>
    </section>
  );
}
