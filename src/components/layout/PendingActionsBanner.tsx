import { X } from "lucide-react";
import { useStore } from "../../store/useStore";
import { isBannerSnoozed } from "../../lib/status";
import { BharatConnectMark } from "./BharatConnectMark";

export function PendingActionsBanner({ kind, onReview }: { kind: "sales" | "purchase"; onReview: () => void }) {
  const business = useStore((s) => s.currentBusiness());
  const invoices = useStore((s) => s.invoices);
  const snoozeInvoiceBanner = useStore((s) => s.snoozeInvoiceBanner);

  const snoozedUntil = kind === "sales" ? business.invoiceBannerSnoozedUntil : business.billsBannerSnoozedUntil;

  if (business.connectionState !== "connected") return null;
  if (isBannerSnoozed(snoozedUntil)) return null;

  const count =
    kind === "sales"
      ? invoices.filter((i) => i.kind === "sales" && i.bcSendStatus === "not_sent").length
      : invoices.filter((i) => i.kind === "purchase" && i.bcConfirmationStatus === "pending").length;

  if (count === 0) return null;

  const noun = kind === "sales" ? `invoice${count === 1 ? "" : "s"}` : `bill${count === 1 ? "" : "s"}`;
  const verb = kind === "sales" ? "pending to send" : "pending to accept";

  return (
    <div className="mb-6 flex items-start gap-4 rounded-xl border border-primary/15 bg-primary-soft px-5 py-4">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
        <BharatConnectMark size={16} />
      </div>
      <div className="flex-1">
        <div className="font-medium text-ink">
          {count} {noun} {verb} via BharatConnect.
        </div>
        <div className="mt-0.5 text-sm text-body">
          {kind === "sales"
            ? "Your buyers can't confirm what hasn't been sent yet."
            : "Your suppliers are waiting on you to confirm these."}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4 pt-0.5">
        <button
          onClick={onReview}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Show {noun}
        </button>
        <button
          onClick={() => snoozeInvoiceBanner(business.id, kind)}
          title="Remind me in 3 days"
          className="text-faint hover:text-body"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
