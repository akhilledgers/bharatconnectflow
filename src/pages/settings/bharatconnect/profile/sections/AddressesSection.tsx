import type { Business } from "../../../../../types";
import type { useProfileForm } from "../useProfileForm";
import type { DraftAddress } from "../useProfileForm";
import { FIELD_CONFIG } from "../fieldConfig";
import { FieldShell, ReadonlyRow } from "../fields";

let addrCounter = 0;

export function AddressesSection({
  business,
  form,
}: {
  business: Business;
  form: ReturnType<typeof useProfileForm>;
}) {
  const { draft, changedFieldIds, errors, setField } = form;
  const changed = changedFieldIds.includes("additionalAddresses");

  function updateAddress(id: string, patch: Partial<DraftAddress>) {
    setField(
      "additionalAddresses",
      draft.additionalAddresses.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  }

  function removeAddress(id: string) {
    setField(
      "additionalAddresses",
      draft.additionalAddresses.filter((a) => a.id !== id),
    );
  }

  function addAddress() {
    addrCounter += 1;
    setField("additionalAddresses", [
      ...draft.additionalAddresses,
      { id: `addr-new-${addrCounter}`, line1: "", city: "", state: "", pincode: "" },
    ]);
  }

  const ra = business.registeredAddress;

  return (
    <section id="addresses" className="scroll-mt-28">
      <h2 className="mb-1 text-base font-semibold text-ink">Addresses</h2>

      <div className="divide-y divide-gray-100">
        <ReadonlyRow
          meta={FIELD_CONFIG.registeredAddress}
          value={`${ra.line1}, ${ra.city}, ${ra.state} ${ra.pincode}`}
        />

        <FieldShell meta={FIELD_CONFIG.additionalAddresses} changed={changed} layout="block">
          <div className="space-y-3">
            {draft.additionalAddresses.map((a) => (
              <div
                key={a.id}
                className={`rounded-lg border p-3.5 ${errors[a.id] ? "border-red-300 bg-red-50/40" : "border-gray-200"}`}
              >
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={a.line1}
                    onChange={(e) => updateAddress(a.id, { line1: e.target.value })}
                    placeholder="Address line"
                    className="col-span-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    value={a.city}
                    onChange={(e) => updateAddress(a.id, { city: e.target.value })}
                    placeholder="City"
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    value={a.state}
                    onChange={(e) => updateAddress(a.id, { state: e.target.value.toUpperCase() })}
                    placeholder="State"
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    value={a.pincode}
                    onChange={(e) => updateAddress(a.id, { pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                    placeholder="Pincode"
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => removeAddress(a.id)}
                    className="text-left text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
                {errors[a.id] && <p className="mt-2 text-[13px] text-red-800">{errors[a.id]}</p>}
              </div>
            ))}
            <button
              onClick={addAddress}
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              + Add address
            </button>
          </div>
        </FieldShell>
      </div>
    </section>
  );
}
