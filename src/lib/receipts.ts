import type { Receipt } from "../types";

/** How much of the invoice a receipt settles: the money received plus TDS and anything else the customer held back. */
export const receiptValue = (r: Receipt) => r.amount + (r.tds ?? 0) + (r.deductions ?? []).reduce((s, d) => s + d.amount, 0);
