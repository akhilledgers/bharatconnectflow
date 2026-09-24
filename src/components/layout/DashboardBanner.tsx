import type { ReactNode } from "react";
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
        title: "Claim your B2B ID on BharatConnect for Business",
        body: "Send and receive invoices instantly from your contacts.",
        actionLabel: "Get My ID",
        action: "connect",
      };
    case "existing_id_found":
      return {
        title: "We found your BharatConnect ID",
        body: "An active ID already exists for this PAN, just not linked to this business yet. One click links it.",
        actionLabel: "Link existing ID",
        action: "link",
      };
    case "needs_attention":
      return {
        title: "Something needs your attention on BharatConnect",
        body: business.lastRejection?.message ?? "A recent update was rejected or a sync failed.",
        actionLabel: "Fix now",
        action: "fix",
      };
    case "assisted_setup":
      return {
        title: "We couldn't verify your PAN automatically",
        body: "Your PAN isn't on the Income Tax portal yet, so automatic setup isn't possible. Our team can help.",
        actionLabel: "Contact us",
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
  const navigate = useNavigate();

  const meta = STATUS_META[business.connectionState];
  if (!meta.needsAction) return null;
  if (isBannerSnoozed(business.bannerSnoozedUntil)) return null;

  const copy = bannerCopy(business);
  if (!copy) return null;

  function handleAction() {
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
    <div className="mb-6 flex items-start gap-4 rounded-xl border border-primary/15 bg-primary-soft px-5 py-4">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
        <BharatConnectMark size={16} />
      </div>
      <div className="flex-1">
        <div className="font-medium text-ink">{copy.title}</div>
        <div className="mt-0.5 text-sm text-body">{copy.body}</div>
      </div>
      <div className="flex shrink-0 items-center gap-4 pt-0.5">
        <button
          onClick={handleAction}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {copy.actionLabel}
        </button>
        <button
          onClick={() => snoozeBanner(business.id)}
          className="text-sm font-medium text-primary hover:text-primary-hover"
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
