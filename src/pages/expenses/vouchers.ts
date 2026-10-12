import type { PayableDoc } from "../banking/PayDocs";

/** An expense voucher as LEDGERS lists it: who was paid, how much, and whether it's been paid. */
export interface ExpenseVoucher {
  number: string;
  date: string;
  party: string;
  /** Expense ledger it's booked to. */
  category: string;
  items: { name: string; amount: number }[];
  /** How it was paid, once it has been. */
  paidBy?: "Cash" | "Bank" | "UPI";
}

export const voucherTotal = (v: ExpenseVoucher) => v.items.reduce((s, i) => s + i.amount, 0);

export function voucherDoc(v: ExpenseVoucher): PayableDoc {
  return { number: v.number, party: v.party, date: v.date, due: v.paidBy ? 0 : voucherTotal(v) };
}

export const EXPENSE_VOUCHERS: ExpenseVoucher[] = [
  { number: "2026-31", date: "08-10-2026", party: "Swift Cabs", category: "Travel", items: [{ name: "Airport transfers, client visit", amount: 2450 }] },
  { number: "2026-30", date: "06-10-2026", party: "Hotel Residency", category: "Travel", items: [{ name: "Stay, 2 nights (Pune)", amount: 7600 }, { name: "Meals", amount: 1360 }] },
  { number: "2026-29", date: "03-10-2026", party: "Sri Lakshmi Enterprises", category: "Office Expenses", items: [{ name: "Pantry supplies", amount: 640 }] },
  { number: "2026-28", date: "01-10-2026", party: "Deepak Trading", category: "Packing Material", items: [{ name: "Packing material", amount: 3100 }] },
  { number: "2026-27", date: "28-09-2026", party: "Manoj Kumar Yadav", category: "Freight & Cartage", items: [{ name: "Loading charges", amount: 1200 }], paidBy: "Cash" },
  { number: "2026-26", date: "24-09-2026", party: "Swift Cabs", category: "Travel", items: [{ name: "Local travel, September", amount: 1180 }], paidBy: "Bank" },
  { number: "2026-25", date: "20-09-2026", party: "Hotel Residency", category: "Staff Welfare", items: [{ name: "Team lunch", amount: 4250 }], paidBy: "UPI" },
];
