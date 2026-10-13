import type { Invoice } from "../types";

/** LEDGERS' next bill number ("2026-33"): one past the highest given so far, from 2026-31 when there are none. */
export function nextBillNo(invoices: Invoice[]): string {
  const last = Math.max(30, ...invoices.map((i) => Number(i.billNo?.split("-")[1] ?? 0)));
  return `2026-${last + 1}`;
}
