import type { Invoice } from "../types";

/** LEDGERS' next bill number ("2026-33"): one past the highest given so far, from 2026-31 when there are none. */
export function nextBillNo(invoices: Invoice[]): string {
  const last = Math.max(30, ...invoices.map((i) => Number(i.billNo?.split("-")[1] ?? 0)));
  return `2026-${last + 1}`;
}

const NAME_NOISE = new Set(["PRIVATE", "PVT", "LIMITED", "LTD", "CO", "AND", "&", "-", "THE"]);

/**
 * The supplier's own invoice number (LEDGERS' "Purchase Invoice Number"; `supplierInvoiceNumber` on Bharat Connect).
 * Our internal id ("BILL-2031") is never shown as one, since it reads like a bill number. Without a stored number,
 * one is derived in the supplier's style: their initials, the year and the sequence ("VFS/26-27/2031").
 */
export function supplierInvoiceNo(invoice: Invoice): string {
  if (invoice.supplierInvoiceNo) return invoice.supplierInvoiceNo;
  const initials = invoice.counterpartyName
    .toUpperCase()
    .split(/\s+/)
    .filter((w) => w && !NAME_NOISE.has(w))
    .slice(0, 3)
    .map((w) => w[0])
    .join("");
  return `${initials || "INV"}/26-27/${invoice.id.match(/\d+$/)?.[0] ?? invoice.id}`;
}
