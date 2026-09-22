import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "../../../../store/useStore";
import type { Business } from "../../../../types";
import { useProfileForm } from "./useProfileForm";
import { SECTIONS } from "./fieldConfig";
import { SaveBar } from "./SaveBar";
import { BusinessSection } from "./sections/BusinessSection";
import { TaxSection } from "./sections/TaxSection";
import { AddressesSection } from "./sections/AddressesSection";
import { SettlementSection } from "./sections/SettlementSection";
import { ContactsSection } from "./sections/ContactsSection";
import { LevelStatus } from "./LevelStatus";
import { FullVerificationNudge } from "./FullVerificationNudge";

const OLD_TAB_TO_SECTION: Record<string, string> = {
  business_details: "business",
  tax_legal_ids: "tax",
  addresses: "addresses",
  settlement_accounts: "settlement",
  contacts: "contacts",
  review_send: "settlement",
};

export function ProfilePage() {
  const business = useStore((s) => s.currentBusiness());
  // Keyed by business id so switching businesses fully remounts the form —
  // useReducer only runs its initializer once, so without this the draft/saved
  // state from the previous business would otherwise leak into the new one.
  return <ProfilePageInner key={business.id} business={business} />;
}

function ProfilePageInner({ business }: { business: Business }) {
  const params = useParams<{ "*": string }>();
  const form = useProfileForm(business);

  useEffect(() => {
    const raw = params["*"];
    const target = raw ? OLD_TAB_TO_SECTION[raw] : null;
    if (target) {
      // Wait a tick for layout to settle before scrolling.
      requestAnimationFrame(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params["*"], business.id]);

  return (
    <div>
      <div className="max-w-[760px] pb-24 pt-2">
        <h1 className="text-2xl font-semibold text-ink">BharatConnect profile</h1>
        <div className="mt-1.5">
          <LevelStatus business={business} />
          <FullVerificationNudge business={business} />
        </div>

        <div className="mt-5 flex items-center justify-between border-b border-gray-100">
          <nav className="flex h-11 items-center gap-6">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#section-${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="text-[13px] font-medium text-body hover:text-primary"
              >
                {s.navLabel}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <button
              onClick={form.toggleArmReject}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                form.armReject ? "border-red-300 bg-red-50 text-red-700" : "border-gray-200 text-faint hover:bg-gray-50"
              }`}
              title="Dev: make the next send come back rejected"
            >
              {form.armReject ? "Reject armed" : "Simulate reject"}
            </button>
            <button
              onClick={form.toggleArmConflict}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                form.armConflict ? "border-amber-300 bg-amber-50 text-amber-700" : "border-gray-200 text-faint hover:bg-gray-50"
              }`}
              title="Dev: make the next send come back as a version conflict"
            >
              {form.armConflict ? "Conflict armed" : "Simulate conflict"}
            </button>
          </div>
        </div>

        <div className="space-y-10 pt-8">
          <BusinessSection business={business} form={form} />
          <TaxSection business={business} />
          <AddressesSection business={business} form={form} />
          <SettlementSection business={business} form={form} />
          <ContactsSection business={business} form={form} />
        </div>
      </div>

      <SaveBar business={business} form={form} />
    </div>
  );
}
