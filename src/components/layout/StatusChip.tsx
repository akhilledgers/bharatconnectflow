import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/useStore";
import { STATUS_META } from "../../lib/status";
import { BharatConnectMark } from "./BharatConnectMark";
import type { Business } from "../../types";
import { Button } from "../ui/button";
import { popoverCls } from "../ui/popover";
import { cn } from "../../lib/cn";

// Scenario-specific heading, text and action for each connection state — short on purpose;
// the Dashboard banner (DashboardBanner.tsx) carries the longer version of the same message.
function popoverContent(business: Business): { title: string; body: string; actionLabel: string; action: string } {
  const idCount = business.bharatConnectIds.filter((i) => i.status === "active").length;
  switch (business.connectionState) {
    case "connected":
      return {
        title: "You're connected",
        // idCount is 0 only when the dev panel forces "connected" without an ID.
        body: idCount > 0 ? `${idCount} active B2B ID${idCount === 1 ? "" : "s"} · Ready to send and receive invoices.` : "Ready to send and receive invoices.",
        actionLabel: "Manage",
        action: "open",
      };
    case "not_connected":
      return {
        title: "Onboard on Bharat Connect for Business",
        body: "Exchange invoices, get paid faster, and reconcile automatically.",
        actionLabel: "Get My B2B ID",
        action: "connect",
      };
    case "existing_id_found":
      return {
        title: "We found your B2B ID",
        body: "Your PAN already has one. Link it to this business in one click.",
        actionLabel: "Link Existing ID",
        action: "link",
      };
    case "setting_up":
      return {
        title: "Almost there",
        body: "We're waiting for Bharat Connect to activate your ID.",
        actionLabel: "View Progress",
        action: "open",
      };
    case "needs_attention":
      return {
        title: "Needs your attention",
        body: business.lastRejection?.message ?? "A recent update didn't go through.",
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
  }
}

export function StatusChip() {
  const business = useStore((s) => s.currentBusiness());
  const invoices = useStore((s) => s.invoices);
  const linkExistingId = useStore((s) => s.linkExistingId);
  const pushToast = useStore((s) => s.pushToast);
  const [open, setOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const meta = STATUS_META[business.connectionState];
  const content = popoverContent(business);
  const pendingSendCount = invoices.filter((i) => i.kind === "sales" && i.bcSendStatus === "not_sent").length;
  // No quotes or purchase orders in the prototype yet — those tiles show 0 and aren't clickable.
  const pendingQuotesCount = 0;
  const pendingPoCount = 0;
  const pendingAcceptCount = invoices.filter((i) => i.kind === "purchase" && i.bcConfirmationStatus === "pending").length;
  const totalPending = pendingSendCount + pendingAcceptCount;
  const connected = business.connectionState === "connected";

  function goTo(path: string) {
    navigate(path);
    setOpen(false);
  }

  async function handleAction() {
    switch (content.action) {
      case "connect":
      case "open":
        navigate("/settings/bharatconnect");
        setOpen(false);
        break;
      case "fix":
        navigate("/settings/bharatconnect/profile/review_send");
        setOpen(false);
        break;
      case "link":
        setLinking(true);
        await linkExistingId(business.id);
        setLinking(false);
        setOpen(false);
        break;
      case "contact":
        pushToast("Our team will reach out to help with setup.");
        setOpen(false);
        break;
    }
  }

  return (
    <div
      className="relative"
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Bharat Connect: ${meta.label}`}
        className="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-md hover:bg-accent"
      >
        <BharatConnectMark size={18} />
        <span className={`absolute bottom-1 right-1 size-2.5 rounded-full ring-2 ring-background ${meta.dotClass}`} />
        {connected && totalPending > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none tabular-nums text-white ring-2 ring-background">
            {totalPending}
          </span>
        )}
      </button>

      {open && (
        // pt-2 instead of mt-2 keeps the hover area continuous between the chip and the popover.
        <div className="absolute right-0 top-full z-30 pt-2">
          <div className={cn(popoverCls, "w-80 p-4")}>
            {/* Status line, then the scenario's own heading and text. */}
            <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`size-1.5 rounded-full ${meta.dotClass}`} />
              {meta.label}
            </div>
            <div className="mb-1 text-sm font-semibold tracking-tight text-foreground">{content.title}</div>
            <p className="mb-3 text-xs text-muted-foreground">{content.body}</p>

            {connected && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                {[
                  { value: pendingQuotesCount, label: "Pending Quotes to Send", to: null },
                  { value: pendingSendCount, label: "Pending Invoices to Send", to: "/sales/invoices" },
                  { value: pendingPoCount, label: "Pending POs to Send", to: null },
                  { value: pendingAcceptCount, label: "Pending Purchase Invoices to Accept", to: "/expenses/bills" },
                ].map((stat) =>
                  stat.to ? (
                    <button
                      key={stat.label}
                      onClick={() => goTo(stat.to!)}
                      className="cursor-pointer rounded-lg border border-border px-3 py-2 text-left hover:bg-accent"
                    >
                      <div className={`text-lg font-semibold tabular-nums tracking-tight ${stat.value > 0 ? "text-red-600" : "text-foreground"}`}>{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </button>
                  ) : (
                    <div key={stat.label} className="rounded-lg border border-border px-3 py-2">
                      <div className={`text-lg font-semibold tabular-nums tracking-tight ${stat.value > 0 ? "text-red-600" : "text-foreground"}`}>{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  ),
                )}
              </div>
            )}

            {/* Connected needs no call to action here — the stats are the way in. */}
            {!connected && (
              <Button variant="primary" size="sm" className="w-full" onClick={handleAction} disabled={linking}>
                {linking ? "Linking…" : content.actionLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
