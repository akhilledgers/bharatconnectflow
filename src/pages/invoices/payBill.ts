import type { Invoice } from "../../types";
import type { PayableDoc } from "../banking/PayDocs";

/** The bill's number as LEDGERS shows it (given on create); payments made from Banking are recorded against it. */
export const billNumber = (i: Invoice) => i.billNo ?? i.id;

/** What's still owed on a bill, as a document the Banking payment drawers can pay. */
export function billDoc(i: Invoice): PayableDoc {
  const received = (i.receipts ?? []).reduce((s, r) => s + r.amount + (r.tds ?? 0), 0);
  return { number: billNumber(i), party: i.counterpartyName, date: i.date, dueDate: i.dueDate, due: i.status === "paid" ? 0 : Math.max(0, i.amount - received) };
}

/** Bills that can be paid: purchase, not fully paid, and not rejected on Bharat Connect. */
export const isPayableBill = (i: Invoice) => i.kind === "purchase" && i.status !== "paid" && i.bcConfirmationStatus !== "rejected";
