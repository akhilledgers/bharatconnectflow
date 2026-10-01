import type { Invoice } from "../types";
import type { BadgeVariant } from "../components/ui/badge";

// Status → Badge variant follows the LEDGERS design system's status map:
// Paid / Accepted → success · Partly Paid / Pending → warning · Not Paid / Failed → destructive.

export function statusLabel(status: Invoice["status"]): string {
  if (status === "unpaid") return "Not Paid";
  if (status === "partly_paid") return "Partly Paid";
  return "Paid";
}

export function statusVariant(status: Invoice["status"]): BadgeVariant {
  if (status === "unpaid") return "destructive";
  if (status === "partly_paid") return "warning";
  return "success";
}

export function confirmationMeta(status: Invoice["bcConfirmationStatus"]): { label: string; variant: BadgeVariant } | null {
  if (status === "accepted") return { label: "Accepted", variant: "success" };
  if (status === "failure") return { label: "Failed", variant: "destructive" };
  if (status === "pending") return { label: "Pending", variant: "warning" };
  return null;
}
