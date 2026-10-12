import type { Invoice } from "../types";
import { PHASE2 } from "./phase";

/**
 * Who can edit what, from handbook Annexure H ("Edit Invoice" rows):
 *  - Supplier may edit only while Sent To Buyer (before the buyer acts) or Under Review (returned).
 *    Each edit raises the version and is re-sent to the buyer (reqEditInvoice). Never for e-invoices.
 *  - No edit from Accepted / Rejected / Cancelled / paid states.
 * Bills received over Bharat Connect are the supplier's document: amounts and items are locked, only
 * LEDGERS-only fields (expense category) can change; the buyer asks for changes by returning it.
 */
export type EditRule =
  | { mode: "free" }
  | { mode: "resend"; nextVersion: number }
  | { mode: "local-only"; reason: string }
  | { mode: "blocked"; reason: string };

export function editRule(invoice: Invoice, connected: boolean): EditRule {
  if (invoice.deletedAt) return { mode: "blocked", reason: "Deleted invoices can't be edited." };
  const s = invoice.bcConfirmationStatus;
  const viaBc = invoice.bcSendStatus === "sent" || invoice.bcSendStatus === "sending";

  if (invoice.kind === "purchase") {
    return viaBc
      ? {
          mode: "local-only",
          reason: PHASE2.buyerReturn
            ? `To correct the bill, return it to ${invoice.counterpartyName}.`
            : `To correct the bill, reject it and ask ${invoice.counterpartyName} for a new one.`,
        }
      : { mode: "free" };
  }

  // Sales: anything never delivered over Bharat Connect edits the normal LEDGERS way.
  if (!connected || !viaBc || s === null || s === "failure") return { mode: "free" };

  if (invoice.isEInvoice) return { mode: "blocked", reason: "E-invoices can't be edited." };
  if (s === "pending" || s === "returned") {
    return PHASE2.editAndResend
      ? { mode: "resend", nextVersion: (invoice.version ?? 1) + 1 }
      : { mode: "blocked", reason: "Sent on Bharat Connect. Cancel & delete it, then create a new one." };
  }
  if (s === "accepted") return { mode: "blocked", reason: "Accepted invoices can't be edited. Use a credit note." };
  if (s === "rejected") return { mode: "blocked", reason: "Rejected on Bharat Connect. Cancel & delete it, then create a new one." };
  return { mode: "blocked", reason: "Cancelled invoices can't be edited." };
}

/**
 * The header's Delete (trash) for a sales invoice:
 *  - not on Bharat Connect → a normal LEDGERS delete;
 *  - on Bharat Connect and still cancellable (Annexure H: Sent To Buyer, Returned, Rejected) → Cancel & Delete:
 *    reqStatusChangeInvoice (Cancelled, supplierRemarks) to the buyer, then deleted from LEDGERS;
 *  - Accepted → no cancel on Bharat Connect, so a credit note instead.
 * Either way GST comes first: nothing filed in GSTR-1, with an IRN, or with receipts is deleted.
 */
export type DeleteRule = { mode: "delete" } | { mode: "cancel-delete" } | { mode: "blocked"; reason: string };

export function deleteRule(invoice: Invoice, connected: boolean): DeleteRule {
  if (invoice.deletedAt) return { mode: "blocked", reason: `Deleted on ${invoice.deletedAt}.` };
  if (invoice.gstr1Filed) return { mode: "blocked", reason: "Filed in GSTR-1. Raise a credit note instead." };
  if (invoice.isEInvoice) return { mode: "blocked", reason: "Has an IRN. Cancel the e-invoice first." };
  if (invoice.receipts?.length || invoice.status !== "unpaid") return { mode: "blocked", reason: "Has receipts recorded. Remove them first." };
  const s = invoice.bcConfirmationStatus;
  const onBc = connected && invoice.kind === "sales" && invoice.bcSendStatus === "sent" && s !== "failure" && s !== null;
  if (!onBc) return { mode: "delete" };
  if (s === "accepted") return { mode: "blocked", reason: "Accepted on Bharat Connect. Raise a credit note instead." };
  if (s === "cancelled") return { mode: "delete" };
  return { mode: "cancel-delete" };
}

/** One-tap reasons for Cancel & Delete (sent to the buyer as supplierRemarks, 1–100). */
export const CANCEL_PICKS = ["Raised by mistake", "Wrong amount", "Wrong GST", "Duplicate"];
