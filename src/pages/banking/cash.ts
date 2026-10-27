// Cash: "Cash in hand" is the parent and shows the total of the cash accounts under it. One sub-account
// ("Main cash") is created with the business; users add more (branch petty cash…). Balances come from the
// books: there is no bank feed, statement or reconciliation for cash. Cash meets the bank through transfers
// (an ATM withdrawal or a cash deposit matched in Transactions), which post a contra entry on both sides.

/** Transactions: the cash book for every cash account at once (Cash in hand). */
export const CASH_ALL = "cash-all";
export const CASH_PARENT = "Cash in hand";

export interface CashAccount {
  id: string;
  name: string;
  branch?: string;
  /** Created with the business; can be renamed, not made inactive. */
  isDefault?: boolean;
  active: boolean;
  /** Opening balance in the books, as on the financial year start (DD-MM-YYYY). */
  opening: { amount: number; date: string };
}

export interface CashEntry {
  id: string;
  accountId: string;
  /** DD-MM-YYYY */
  date: string;
  ref: string;
  kind: "Receipt" | "Payment" | "Expense" | "Transfer";
  /** Who paid / was paid, the expense head, or the account on the other side of a transfer. */
  party: string;
  /** Positive = cash in, negative = cash out. */
  amount: number;
  /** A transfer that came from matching a bank line (ATM withdrawal, cash deposit). */
  lineId?: string;
}

export const isCashId = (id: string) => id === CASH_ALL || id.startsWith("cash:");

/** Book balance of one cash account (opening + its entries). */
export function cashBalance(account: CashAccount, entries: CashEntry[]) {
  return entries.filter((e) => e.accountId === account.id).reduce((s, e) => s + e.amount, account.opening.amount);
}

/** Cash in hand: the total of the active cash accounts under it. */
export function cashTotal(accounts: CashAccount[], entries: CashEntry[]) {
  return accounts.filter((a) => a.active).reduce((s, a) => s + cashBalance(a, entries), 0);
}

const OPENING_DATE = "01-04-2026";
const E = (id: string, accountId: string, date: string, ref: string, kind: CashEntry["kind"], party: string, amount: number): CashEntry => ({ id, accountId, date, ref, kind, party, amount });

/**
 * Sample cash. "full" (Several banks): Main cash and two branch petty-cash accounts, Chennai overdrawn so
 * Overview flags it. Otherwise just Main cash; a business with no bank yet starts it at zero.
 */
export function initialCash(level: "empty" | "basic" | "full"): { cashAccounts: CashAccount[]; cashEntries: CashEntry[] } {
  const main: CashAccount = { id: "cash:main", name: "Main cash", isDefault: true, active: true, opening: { amount: level === "empty" ? 0 : level === "basic" ? 10000 : 25000, date: OPENING_DATE } };
  if (level === "empty") return { cashAccounts: [main], cashEntries: [] };
  if (level === "basic")
    return {
      cashAccounts: [main],
      cashEntries: [
        E("ce1", "cash:main", "08-10-2026", "REC 2026-71", "Receipt", "Sharma Retail", 6500),
        E("ce2", "cash:main", "10-10-2026", "EXP 2026-88", "Expense", "Office supplies", -1200),
      ],
    };
  return {
    cashAccounts: [
      main,
      { id: "cash:mumbai", name: "Petty cash – Mumbai", branch: "Mumbai", active: true, opening: { amount: 5000, date: OPENING_DATE } },
      { id: "cash:chennai", name: "Petty cash – Chennai", branch: "Chennai", active: true, opening: { amount: 2000, date: OPENING_DATE } },
    ],
    cashEntries: [
      E("ce1", "cash:main", "06-10-2026", "CON 2026-12", "Transfer", "Petty cash – Mumbai", -5000),
      E("ce2", "cash:mumbai", "06-10-2026", "CON 2026-12", "Transfer", "Main cash", 5000),
      E("ce3", "cash:chennai", "07-10-2026", "EXP 2026-81", "Expense", "Local travel", -1800),
      E("ce4", "cash:main", "08-10-2026", "REC 2026-71", "Receipt", "Sharma Retail", 18500),
      E("ce5", "cash:mumbai", "09-10-2026", "EXP 2026-84", "Expense", "Courier", -1450),
      E("ce6", "cash:main", "10-10-2026", "EXP 2026-88", "Expense", "Office supplies", -2340),
      E("ce7", "cash:main", "12-10-2026", "CON 2026-13", "Transfer", "Axis ••9012", 20000),
      E("ce8", "cash:chennai", "13-10-2026", "EXP 2026-90", "Expense", "Repairs", -1450),
      E("ce9", "cash:main", "14-10-2026", "VOU 2026-52", "Payment", "Kavya Textiles", -15000),
      E("ce10", "cash:mumbai", "15-10-2026", "EXP 2026-93", "Expense", "Stationery", -1350),
      E("ce11", "cash:main", "16-10-2026", "EXP 2026-95", "Expense", "Tea and snacks", -860),
    ],
  };
}
