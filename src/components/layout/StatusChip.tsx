import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/useStore";
import { STATUS_META } from "../../lib/status";
import { BharatConnectMark } from "./BharatConnectMark";
import type { Business } from "../../types";

function popoverContent(business: Business): { body: string; actionLabel: string; action: string } {
  const idCount = business.bharatConnectIds.filter((i) => i.status === "active").length;
  switch (business.connectionState) {
    case "connected":
      return {
        body: `${idCount} active B2B ID${idCount === 1 ? "" : "s"}. Verified for invoicing.${
          business.verification.payments ? " Payments are enabled." : " Payments are not enabled yet."
        }`,
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
        className="relative flex items-center justify-center rounded-full border border-gray-200 bg-white p-1.5 hover:border-gray-300"
      >
        <BharatConnectMark size={16} />
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${meta.dotClass}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
            <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
            {business.connectionState === "connected" ? "Connected to BharatConnect" : meta.label}
          </div>
          <p className="mb-3 text-sm text-body">{content.body}</p>
          <button
            onClick={handleAction}
            disabled={linking}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
          >
            {linking ? "Linking…" : content.actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
