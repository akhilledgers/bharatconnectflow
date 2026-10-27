import type { BusinessType } from "../../types";

/**
 * Accounts money can be received in or paid from that Banking doesn't reconcile: chart-of-accounts heads
 * (from LEDGERS' default Schedule III list) and people's own accounts (a director, partner or proprietor).
 * Ids start with "oa:" so they never clash with bank or cash ids.
 */
export interface OtherAccount {
  id: string;
  name: string;
  /** The chart-of-accounts head it sits under. */
  head: string;
  /** A person's account: money held with them is flagged until it reaches the bank. */
  person?: boolean;
}

export interface OtherEntry {
  id: string;
  accountId: string;
  date: string;
  ref: string;
  party: string;
  /** Positive = the company is owed this by the account (money received in it); negative = paid from it. */
  amount: number;
  lineId?: string;
}

export const isOtherId = (id: string) => id.startsWith("oa:");

/** The heads that make sense for money in or out, as named in LEDGERS' chart of accounts. */
export const OTHER_HEADS: OtherAccount[] = [
  { id: "oa:chq", name: "Cheques and demand drafts on hand", head: "Cash and cash equivalents" },
  { id: "oa:emp-adv", name: "Employee advance", head: "Other current assets" },
  { id: "oa:rp-to", name: "Loans and advances to related parties", head: "Short-term loans and advances" },
  { id: "oa:rp-from", name: "Loans and advances from related parties", head: "Short-term borrowings" },
  { id: "oa:deposit", name: "Security deposits", head: "Short-term loans and advances" },
  { id: "oa:capital", name: "Capital account", head: "Capital" },
];

/**
 * Where a person's account goes, from the business type LEDGERS already has (Basic settings → Constitution):
 * a company's director is a related party; a proprietor's money is capital. The user only types the name.
 */
export function personLedger(name: string, businessType: BusinessType): Omit<OtherAccount, "id"> {
  return businessType === "company"
    ? { name: `Director – ${name}`, head: "Loans and advances from related parties", person: true }
    : { name: `${name} capital account`, head: "Capital", person: true };
}

/** How the money moved, asked only for bank accounts. Cash, cards, gateways and wallets need no mode. */
export const MODES = ["NEFT / RTGS / IMPS", "UPI", "Cheque", "Demand draft", "Direct deposit"] as const;
export type Mode = (typeof MODES)[number];

export const referenceLabel = (mode: Mode) => (mode === "Cheque" ? "Cheque no." : mode === "Demand draft" ? "DD no." : mode === "UPI" ? "UPI ref" : "UTR / reference");

/** What a customer may hold back from a payment, each settling part of the invoice. */
export const DEDUCTIONS = ["TDS", "Discount", "Charges they deducted"] as const;
export type DeductionKind = (typeof DEDUCTIONS)[number];
/** Expense heads for charges a customer deducts (packing, freight…), from LEDGERS' chart of accounts. */
export const CHARGE_HEADS = ["Packing charges", "Freight and forwarding", "Commission", "Bank charges", "Other expenses"];
