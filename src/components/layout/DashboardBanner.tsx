import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/useStore";
import { STATUS_META, isBannerSnoozed } from "../../lib/status";
import { BharatConnectMark } from "./BharatConnectMark";
import type { Business, ConnectionState } from "../../types";

interface BannerCopy {
  title: ReactNode;
  body: string;
  actionLabel: string;
  action: "connect" | "link" | "fix" | "contact";
}

function bannerCopy(business: Business): BannerCopy | null {
  switch (business.connectionState) {
    case "not_connected":
      return {
        title: "Onboard on Bharat Connect for Business. Get your B2B ID in a few clicks.",
        body: "Exchange invoices digitally, collect faster, and reconcile automatically.",
        actionLabel: "Get My B2B ID",
        action: "connect",
      };
    case "existing_id_found":
      return {
        title: "Bharat Connect B2B ID already exists for your Business",
        body: "Connect B2B ID with LEDGERS.",
        actionLabel: "Connect B2B ID",
        action: "link",
      };
    case "needs_attention":
      return {
        title: "Onboarding on Bharat Connect for Business not completed",
        body: "Fix the issues.",
        actionLabel: "Fix Now",
        action: "fix",
      };
    case "assisted_setup":
      return {
        title: "We couldn't complete your onboarding automatically",
        body: "Our team will help you complete your onboarding.",
        actionLabel: "Contact Us",
        action: "contact",
      };
    default:
      return null;
  }
}

export function DashboardBanner() {
  const business = useStore((s) => s.currentBusiness());
  const snoozeBanner = useStore((s) => s.snoozeBanner);
  const pushToast = useStore((s) => s.pushToast);
  const linkExistingId = useStore((s) => s.linkExistingId);
  const navigate = useNavigate();
  const [linking, setLinking] = useState(false);

  const meta = STATUS_META[business.connectionState];
  if (!meta.needsAction) return null;
  if (isBannerSnoozed(business.bannerSnoozedUntil)) return null;

  const copy = bannerCopy(business);
  if (!copy) return null;

  async function handleAction() {
    if (copy!.action === "link") {
      // Links in place — same as the top-bar chip — so the banner's "one click" is true.
      setLinking(true);
      await linkExistingId(business.id);
      setLinking(false);
      return;
    }
    if (copy!.action === "contact") {
      pushToast("Our team will reach out to help with setup.");
      return;
    }
    if (copy!.action === "fix") {
      navigate("/settings/bharatconnect/profile/review_send");
      return;
    }
    navigate("/settings/bharatconnect");
  }

  return (
    <div className="mb-6 flex items-start gap-4 rounded-xl border border-primary/15 bg-primary/10 px-5 py-4">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card shadow-sm">
        <BharatConnectMark size={16} />
      </div>
      <div className="flex-1">
        <div className="font-medium text-foreground">{copy.title}</div>
        <div className="mt-0.5 text-sm text-foreground">{copy.body}</div>
      </div>
      {/* Primary action on top, "Remind me later" as a quieter link directly beneath it. */}
      <div className="flex shrink-0 flex-col items-stretch gap-2.5">
        <button
          onClick={handleAction}
          disabled={linking}
          className="cursor-pointer whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {linking ? "Linking…" : copy.actionLabel}
        </button>
        <button
          onClick={() => snoozeBanner(business.id)}
          className="cursor-pointer text-center text-xs font-medium text-primary hover:underline"
        >
          Remind me later
        </button>
      </div>
    </div>
  );
}

export function bannerAppliesTo(state: ConnectionState) {
  return STATUS_META[state].needsAction;
}
