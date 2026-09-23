import type { Invoice } from "../../types";

export interface KindConfig {
  kind: "sales" | "purchase";
  pageTitle: string;
  singular: string;
  createLabel: string;
  basePath: string; // e.g. /sales/invoices
  counterpartyLabel: string; // "Customer Name" | "Supplier Name"
  statCardLabels: [string, string, string, string]; // total, receivable/payable, overdue, tds
  bcSendActionLabel: string; // only meaningful for sales
}

export const SALES_CONFIG: KindConfig = {
  kind: "sales",
  pageTitle: "Invoices",
  singular: "Invoice",
  createLabel: "Create Invoice",
  basePath: "/sales/invoices",
  counterpartyLabel: "Customer Name",
  statCardLabels: ["Total Invoice", "Receivables", "Overdue", "TDS"],
  bcSendActionLabel: "Send via BharatConnect",
};

export const PURCHASE_CONFIG: KindConfig = {
  kind: "purchase",
  pageTitle: "Bills",
  singular: "Bill",
  createLabel: "Create Bill",
  basePath: "/expenses/bills",
  counterpartyLabel: "Supplier Name",
  statCardLabels: ["Total Bills", "Payables", "Overdue", "TDS"],
  bcSendActionLabel: "Send via BharatConnect",
};

export function configFor(kind: "sales" | "purchase"): KindConfig {
  return kind === "sales" ? SALES_CONFIG : PURCHASE_CONFIG;
}

export function sumAmount(invoices: Invoice[]): number {
  return invoices.reduce((s, i) => s + i.amount, 0);
}

export function sumUnpaid(invoices: Invoice[]): number {
  return invoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount, 0);
}

/** Rupee amount, rounded to at most 2 decimal places — JS's default toLocaleString
 * allows up to 3, which produces artifacts like "1,000.003" on float math. */
export function money(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function inr(n: number): string {
  return `INR ${money(n)}`;
}
