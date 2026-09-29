import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/useStore";
import { STATUS_META } from "../../lib/status";
import { BharatConnectMark } from "./BharatConnectMark";
import type { Business } from "../../types";
import { Button } from "../ui/button";
import { popoverCls } from "../ui/popover";
import { cn } from "../../lib/cn";

function popoverContent(business: Business): { body: string; actionLabel: string; action: string } {
  const idCount = business.bharatConnectIds.filter((i) => i.status === "active").length;
  switch (business.connectionState) {
    case "connected":
      return {
        body: `${idCount} active B2B ID${idCount === 1 ? "" : "s"}. Verified for invoicing.`,
        actionLabel: "Manage",
        action: "open",
      };
    case "not_connected":
      return {
        body: "Send invoices to your buyers on BharatConnect. Your GST details are ready, setup takes about 2 minutes.",
        actionLabel: "Connect now",
        action: "connect",
      };
    case "existing_id_found":
      return {
        body: "An active BharatConnect ID already exists for this PAN. Link it to this business in one click.",
        actionLabel: "Link existing ID",
        action: "link",
      };
    case "setting_up":
      return {
        body: "Registration sent. We're waiting for BharatConnect to confirm and activate your ID.",
        actionLabel: "View progress",
        action: "open",
      };
    case "needs_attention":
      return {
        body: business.lastRejection?.message ?? "Something needs your attention before this can sync.",
        actionLabel: "Fix now",
        action: "fix",
      };
    case "assisted_setup":
      return {
        body: "Your PAN isn't on the Income Tax portal yet, so this needs manual setup. Our team can help.",
        actionLabel: "Contact us",
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
  const acceptedCount = invoices.filter((i) => i.kind === "sales" && i.bcConfirmationStatus === "accepted").length;
  const receivedCount = invoices.filter((i) => i.kind === "purchase" && i.bcConfirmationStatus !== null).length;
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
        aria-label={`BharatConnect: ${meta.label}`}
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
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
              <span className={`size-2 rounded-full ${meta.dotClass}`} />
              {business.connectionState === "connected" ? "Connected to BharatConnect" : meta.label}
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{content.body}</p>

            {connected && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                {[
                  { value: pendingSendCount, label: "Pending to send", to: "/sales/invoices", cls: "text-red-600" },
                  { value: pendingAcceptCount, label: "Pending to accept", to: "/expenses/bills", cls: "text-red-600" },
                  { value: acceptedCount, label: "Invoices accepted", to: "/sales/invoices", cls: "text-green-600" },
                  { value: receivedCount, label: "Bills received", to: "/expenses/bills", cls: "text-foreground" },
                ].map((stat) => (
                  <button
                    key={stat.label}
                    onClick={() => goTo(stat.to)}
                    className="cursor-pointer rounded-lg border border-border px-3 py-2 text-left hover:bg-accent"
                  >
                    <div className={`text-lg font-semibold tabular-nums tracking-tight ${stat.cls}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </button>
                ))}
              </div>
            )}

            <Button variant="primary" size="sm" className="w-full" onClick={handleAction} disabled={linking}>
              {linking ? "Linking…" : content.actionLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
