import type { Invoice } from "../types";
import type { BadgeVariant } from "../components/ui/badge";

// Status → Badge variant follows the LEDGERS design system's status map:
// Paid / Accepted → success · Partly Paid / Pending → warning · Not Paid / Failed → destructive.

export function statusLabel(status: Invoice["status"]): string {
  if (status === "unpaid") return "Not Paid";
  if (status === "partly_paid") return "Partly Paid";
  return "Fully Paid";
}

export function statusVariant(status: Invoice["status"]): BadgeVariant {
  if (status === "unpaid") return "destructive";
  if (status === "partly_paid") return "warning";
  return "success";
}

// Bharat Connect labels follow handbook Annexure H status names. "pending" (Sent To Buyer) reads from
// each side's point of view; "returned" is Annexure H's Under Review.
export function confirmationMeta(
  status: Invoice["bcConfirmationStatus"],
  kind: Invoice["kind"] = "sales",
): { label: string; variant: BadgeVariant } | null {
  if (status === "pending") return { label: kind === "sales" ? "Sent To Buyer" : "Awaiting Response", variant: "warning" };
  if (status === "accepted") return { label: "Accepted", variant: "success" };
  if (status === "returned") return { label: "Returned", variant: "warning" };
  if (status === "rejected") return { label: "Rejected", variant: "destructive" };
  if (status === "cancelled") return { label: "Cancelled", variant: "secondary" };
  if (status === "failure") return { label: "Failed", variant: "destructive" };
  return null;
}

/** Latest Bharat Connect comment on an invoice (e.g. the buyer's reason for a return). */
export function latestBcComment(invoice: Invoice): string | undefined {
  const bc = (invoice.notes ?? []).filter((n) => n.kind === "bc" && n.text);
  return bc[bc.length - 1]?.text;
}
