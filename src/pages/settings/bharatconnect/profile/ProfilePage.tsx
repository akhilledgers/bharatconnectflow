import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "../../../../store/useStore";
import type { Business } from "../../../../types";
import { useProfileForm } from "./useProfileForm";
import { SECTIONS, type SectionId } from "./fieldConfig";
import { SaveBar } from "./SaveBar";
import { BusinessSection } from "./sections/BusinessSection";
import { TaxSection } from "./sections/TaxSection";
import { AddressesSection } from "./sections/AddressesSection";
import { SettlementSection } from "./sections/SettlementSection";
import { ContactsSection } from "./sections/ContactsSection";
import { LevelStatus } from "./LevelStatus";
import { FullVerificationNudge } from "./FullVerificationNudge";
import { Card } from "../../../../components/ui/card";
import { Tabs } from "../../../../components/ui/tabs";

const OLD_TAB_TO_SECTION: Record<string, string> = {
  business_details: "business",
  tax_legal_ids: "tax",
  addresses: "addresses",
  settlement_accounts: "settlement",
  contacts: "contacts",
  review_send: "settlement",
};

// Top bar (54px) + sticky tabs (~50px) + a little air: a section counts as "current" once its
// heading has scrolled up to here.
const SPY_OFFSET = 130;

export function ProfilePage() {
  const business = useStore((s) => s.currentBusiness());
  // Keyed by business id so switching businesses fully remounts the form —
  // useReducer only runs its initializer once, so without this the draft/saved
  // state from the previous business would otherwise leak into the new one.
  return <ProfilePageInner key={business.id} business={business} />;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ProfilePageInner({ business }: { business: Business }) {
  const params = useParams<{ "*": string }>();
  const form = useProfileForm(business);
  const [active, setActive] = useState<SectionId>("business");

  useEffect(() => {
    const raw = params["*"];
    const target = raw ? OLD_TAB_TO_SECTION[raw] : null;
    if (target) {
      // Wait a tick for layout to settle before scrolling.
      requestAnimationFrame(() => scrollToSection(target));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params["*"], business.id]);

  // Scroll-spy: highlight the tab for the section currently under the sticky tabs.
  useEffect(() => {
    function onScroll() {
      let current: SectionId = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= SPY_OFFSET) current = s.id;
      }
      // At the very bottom the last section may never reach the offset; treat it as current.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = SECTIONS[SECTIONS.length - 1].id;
      }
      setActive(current);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Bharat Connect profile</h1>
          <LevelStatus business={business} />
        </div>
        <FullVerificationNudge business={business} />
      </div>

      <Card>
        <div className="sticky top-(--header-height) z-10 rounded-t-xl bg-card">
          <Tabs
            variant="line"
            items={SECTIONS.map((s) => ({ value: s.id, label: s.label }))}
            value={active}
            onChange={(id) => {
              setActive(id);
              scrollToSection(id);
            }}
          />
        </div>

        <BusinessSection business={business} form={form} />
        <TaxSection business={business} />
        <AddressesSection business={business} form={form} />
        <SettlementSection business={business} form={form} />
        <ContactsSection business={business} form={form} />

        <SaveBar business={business} form={form} />
      </Card>
    </div>
  );
}
