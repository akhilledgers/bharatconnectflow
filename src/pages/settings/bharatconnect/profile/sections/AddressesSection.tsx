import { Plus } from "lucide-react";
import type { Business } from "../../../../../types";
import type { useProfileForm } from "../useProfileForm";
import type { DraftAddress } from "../useProfileForm";
import { FIELD_CONFIG } from "../fieldConfig";
import { FieldShell, ProfileSection, ReadonlyRow } from "../fields";
import { Input } from "../../../../../components/ui/input";
import { Button } from "../../../../../components/ui/button";

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
    <ProfileSection id="addresses" title="Addresses" description="Your registered address comes from the GST portal. Add any others you trade from.">
      <ReadonlyRow
        meta={FIELD_CONFIG.registeredAddress}
        value={`${ra.line1}, ${ra.city}, ${ra.state} ${ra.pincode}`}
      />

      <FieldShell meta={FIELD_CONFIG.additionalAddresses} changed={changed} layout="block">
        <div className="space-y-4">
          {draft.additionalAddresses.map((a) => (
            // Neutral group; the invalid pincode field itself carries the error state.
            <div key={a.id} className="grid grid-cols-2 gap-2.5">
              <Input
                value={a.line1}
                onChange={(e) => updateAddress(a.id, { line1: e.target.value })}
                placeholder="Address line"
                className="col-span-2"
              />
              <Input value={a.city} onChange={(e) => updateAddress(a.id, { city: e.target.value })} placeholder="City" />
              <Input
                value={a.state}
                onChange={(e) => updateAddress(a.id, { state: e.target.value.toUpperCase() })}
                placeholder="State"
              />
              <Input
                value={a.pincode}
                onChange={(e) => updateAddress(a.id, { pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                placeholder="Pincode"
                aria-invalid={errors[a.id] ? true : undefined}
              />
              <div className="flex items-center justify-end">
                <Button variant="ghost" size="sm" className="!text-destructive hover:!bg-red-50" onClick={() => removeAddress(a.id)}>
                  Remove
                </Button>
              </div>
              {errors[a.id] && <p className="col-span-2 text-xs text-destructive">{errors[a.id]}</p>}
            </div>
          ))}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={addAddress}>
              <Plus />
              Add Address
            </Button>
          </div>
        </div>
      </FieldShell>
    </ProfileSection>
  );
}
