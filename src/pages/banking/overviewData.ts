// Sample figures for Banking → Overview that the prototype doesn't model elsewhere yet: the books side of
// each account (from the Bank Book), what the AI recon engine has found, payouts in flight, and the month's
// money in / out. Bank-side balances come from the accounts in the store.
import type { CompanyAccount } from "./data";

/** Latest date each account was fully reconciled (before the open items now in Transactions). */
export const RECONCILED_TO: Record<string, string> = {
  p1: "30-09-2026",
  p2: "05-10-2026",
  p4: "31-08-2026",
  p5: "25-09-2026",
  p6: "17-09-2026",
};

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
