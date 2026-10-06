// Sample figures for Banking → Overview that the prototype doesn't model elsewhere yet: the books side of
// each account (from the Bank Book), what the AI recon engine has found, payouts in flight, and the month's
// money in / out. Bank-side balances come from the accounts in the store.
import type { CompanyAccount } from "./data";

export interface ReconSnapshot {
  /** In bank − In your books. Books balance is derived from the bank balance minus this. */
  difference: number;
  /** Bank lines with no matching book entry (e.g. charges, UPI receipts nobody recorded). */
  bankOnly: { count: number; amount: number };
  /** Book entries the bank hasn't shown yet (e.g. uncleared cheques, payments still processing). */
  booksOnly: { count: number; amount: number };
  /** Matches the AI recon engine proposes, waiting for review. */
  suggestions: number;
  /** Latest date up to which bank and books fully agree. */
  reconciledTo?: string;
}

/** Keyed by account id. Accounts not listed have no books activity yet. */
export const RECON: Record<string, ReconSnapshot> = {
  p1: { difference: 12400, bankOnly: { count: 8, amount: 18200 }, booksOnly: { count: 3, amount: 5800 }, suggestions: 12, reconciledTo: "30-09-2026" },
  p2: { difference: 0, bankOnly: { count: 0, amount: 0 }, booksOnly: { count: 0, amount: 0 }, suggestions: 0, reconciledTo: "05-10-2026" },
  p3: { difference: 0, bankOnly: { count: 0, amount: 0 }, booksOnly: { count: 2, amount: 62000 }, suggestions: 0 },
  p4: { difference: -4750, bankOnly: { count: 2, amount: 1250 }, booksOnly: { count: 1, amount: 3500 }, suggestions: 2, reconciledTo: "31-08-2026" },
  p5: { difference: 0, bankOnly: { count: 0, amount: 0 }, booksOnly: { count: 0, amount: 0 }, suggestions: 0, reconciledTo: "25-09-2026" },
  p6: { difference: -2700, bankOnly: { count: 0, amount: 0 }, booksOnly: { count: 1, amount: 2700 }, suggestions: 1, reconciledTo: "20-09-2026" },
};

export type PayoutStatus = "awaiting" | "processing" | "failed";

export interface InFlightPayout {
  id: string;
  name: string;
  detail: string;
  amount: number;
  from: string;
  status: PayoutStatus;
  note: string;
}

export const IN_FLIGHT: InFlightPayout[] = [
  { id: "po1", name: "September salaries", detail: "Batch · 14 payments", amount: 386400, from: "Axis ••9012", status: "awaiting", note: "Waiting for checker in Axis net banking" },
  { id: "po2", name: "Kavya Textiles", detail: "INV-1042 · NEFT", amount: 18500, from: "Axis ••9012", status: "awaiting", note: "Waiting for checker · 2 h" },
  { id: "po3", name: "Sunrise Logistics", detail: "Vendor payment · NEFT", amount: 42000, from: "ICICI ••4456", status: "processing", note: "With the bank · next NEFT batch" },
  { id: "po4", name: "Blue Ocean Traders", detail: "INV-778 · IMPS", amount: 32000, from: "ICICI ••4456", status: "failed", note: "Beneficiary account closed" },
];

/** This month vs last month, across all accounts. */
export const MONEY_FLOW = {
  in: { now: 842300, prev: 710500 },
  out: { now: 695800, prev: 732100 },
};

/** Balance shown for an account on the bank side: live if connected (or last known if expired), else last statement. */
export function bankBalanceOf(a: CompanyAccount, mode: "normal" | "low"): { amount: number; source: "live" | "stale" | "statement" } | null {
  if (a.connection !== "none" && a.liveBalance) return { amount: a.liveBalance[mode === "low" ? 1 : 0], source: a.connection === "connected" ? "live" : "stale" };
  if (a.statement) return { amount: a.statement.balance, source: "statement" };
  return null;
}

export function daysSince(dmy: string) {
  const [d, m, y] = dmy.split("-").map(Number);
  const then = new Date(y, m - 1, d).getTime();
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** ₹4.82L / ₹1.2Cr / ₹48,210 — for headline figures where paise don't matter. */
export function compactINR(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}
