import type { Invoice } from "../types";

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
  const s = invoice.bcConfirmationStatus;
  const viaBc = invoice.bcSendStatus === "sent" || invoice.bcSendStatus === "sending";

  if (invoice.kind === "purchase") {
    return viaBc
      ? { mode: "local-only", reason: `This bill came from ${invoice.counterpartyName} on Bharat Connect. Return it to ask for changes.` }
      : { mode: "free" };
  }

  // Sales: anything never delivered over Bharat Connect edits the normal LEDGERS way.
  if (!connected || !viaBc || s === null || s === "failure") return { mode: "free" };

  if (invoice.isEInvoice) return { mode: "blocked", reason: "E-invoices can't be edited after sending. Cancel it and raise a new one." };
  if (s === "pending" || s === "returned") return { mode: "resend", nextVersion: (invoice.version ?? 1) + 1 };
  if (s === "accepted") return { mode: "blocked", reason: "Accepted on Bharat Connect. Raise a credit or debit note to change it." };
  if (s === "rejected") return { mode: "blocked", reason: "Rejected invoices can't be edited. Cancel it and create a new one." };
  return { mode: "blocked", reason: "Cancelled invoices can't be edited." };
}
