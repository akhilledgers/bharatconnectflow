// Mock data + helpers for the Banking → Fund Transfer prototype (from the "Fund Transfer" Claude Design handoff).

export interface BankAccount {
  id: string;
  bank: string;
  ifsc: string;
  masked: string;
  verified: boolean;
}

export interface Bill {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  amount: number;
}

export interface PastTransfer {
  date: string;
  amount: number;
  mode: TransferMode;
}

export interface PayeeContact {
  id: string;
  name: string;
  category: "vendor" | "other";
  accounts: BankAccount[];
  bills?: Bill[];
  pastTransfers?: PastTransfer[];
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  account: Omit<BankAccount, "id"> | null;
}

export interface PayFromAccount {
  id: string;
  bank: string;
  masked: string;
  balance: number;
  approvalMode: ApprovalMode;
  bulkSupported: boolean;
}

/** A beneficiary picked for a bulk batch row (or the single-transfer carry-over). */
export interface PickedPayee {
  key: string;
  name: string;
  bank: string;
  maskedIfsc: string;
  verified: boolean;
}

export interface BulkRow extends PickedPayee {
  id: string;
  amount: string;
  ifscValid: boolean;
}

export type TransferMode = "IMPS" | "NEFT" | "RTGS";
export type ApprovalMode = "maker-checker" | "single";

export type BankKey = "axis" | "icici" | "indusind";

export interface BankingScenario {
  balance: "normal" | "low";
  /** Outcome of the penny-less verification API (beneficiaries and the company's own accounts). */
  verify: "random" | "pass" | "fail";
  /** How the bank's API answers a Register Connected Banking request. */
  register: "success" | "fail";
  /** Overview: Needs attention and Accounts side by side, or stacked (the earlier layout). */
  overviewLayout: "split" | "stacked";
}

export const DEFAULT_SCENARIO: BankingScenario = { balance: "normal", verify: "random", register: "success", overviewLayout: "split" };

/** Banks LEDGERS has a Connected Banking integration with. */
export const CONNECTED_BANKING: Record<BankKey, { short: string; bulk: boolean; approvalChoice: boolean }> = {
  axis: { short: "Axis", bulk: true, approvalChoice: true },
  icici: { short: "ICICI", bulk: false, approvalChoice: false },
  indusind: { short: "IndusInd", bulk: true, approvalChoice: true },
};

/** e.g. "Axis and IndusInd" — the banks that support bulk transfer. */
export const BULK_BANKS_LABEL = Object.values(CONNECTED_BANKING)
  .filter((b) => b.bulk)
  .map((b) => b.short)
  .join(" and ");

export type BankConnection = "none" | "connected" | "expired";

/** One of the company's own bank accounts (Banking → Accounts). */
export interface CompanyAccount {
  id: string;
  bank: string;
  /** Set when LEDGERS has a Connected Banking integration with this bank. */
  bankKey: BankKey | null;
  number: string;
  ifsc: string;
  nickname: string;
  type: "Current" | "Savings";
  primary: boolean;
  active: boolean;
  /** Ownership confirmed by the penny-less verification API (or by connecting). */
  verified: boolean;
  connection: BankConnection;
  approval: ApprovalMode;
  /** Live balance from the bank API, [normal, low] for the dev panel's balance switch. */
  liveBalance?: [number, number];
  /** Minutes since the last sync (connected) or since the connection lapsed (expired). */
  syncedMinutesAgo?: number;
  /** Balance from the last uploaded statement, for accounts without Connected Banking. */
  statement?: { date: string; balance: number };
  /** Bank Book balance, for accounts with no bank data yet (otherwise it's worked out from the bank side). */
  booksBalance?: number;
  /** Opening balance in the books: as on the FY start, or the day the account was opened if later. Negative = overdrawn. */
  opening?: { amount: number; date: string };
}

/** Start of the business's financial year (Settings → Financial year). Opening balances are taken as on this date. */
export const FY_START = "2026-04-01";

export function initialAccounts(): CompanyAccount[] {
  const base = { active: true, primary: false, verified: false, connection: "none" as BankConnection, approval: "single" as ApprovalMode, type: "Current" as const, nickname: "" };
  return [
    { ...base, id: "p1", bank: "Axis Bank", bankKey: "axis", number: "921020023599012", ifsc: "UTIB0000004", nickname: "Main operating", primary: true, verified: true, connection: "connected", approval: "maker-checker", liveBalance: [482300, 5000], syncedMinutesAgo: 8 },
    { ...base, id: "p2", bank: "ICICI Bank", bankKey: "icici", number: "123405004456", ifsc: "ICIC0000123", nickname: "Collections", verified: true, connection: "connected", liveBalance: [115000, 2500], syncedMinutesAgo: 22 },
    { ...base, id: "p3", bank: "IndusInd Bank", bankKey: "indusind", number: "201000628251", ifsc: "INDB0000007", nickname: "Vendor payments", liveBalance: [268450, 3000], booksBalance: 62000 },
    { ...base, id: "p4", bank: "Axis Bank", bankKey: "axis", number: "921020045675068", ifsc: "UTIB0000004", nickname: "Payroll", verified: true, connection: "expired", approval: "maker-checker", liveBalance: [96300, 1200], syncedMinutesAgo: 2 * 24 * 60 },
    { ...base, id: "p5", bank: "Canara Bank", bankKey: null, number: "9938438484938484", ifsc: "CNRB0002456", statement: { date: "25-09-2026", balance: 124560 } },
    { ...base, id: "p6", bank: "Federal Bank", bankKey: null, number: "12340100006942", ifsc: "FDRL0001234", type: "Savings", verified: true, statement: { date: "20-09-2026", balance: 48210.55 } },
    { ...base, id: "p7", bank: "Ahmedabad Mercantile Co-operative Bank", bankKey: null, number: "7376726387623", ifsc: "AMCB0000003", booksBalance: 18250 },
    { ...base, id: "p8", bank: "Citibank", bankKey: null, number: "78783983894894", ifsc: "CITI0000003", active: false, verified: true },
  ];
}

/** Banking → Transactions: every account at once. */
export const ALL_ACCOUNTS = "all";

export function last4(number: string) {
  return "••" + number.slice(-4);
}

/** Banks recognised from the IFSC prefix when adding an account (prototype subset). */
export const IFSC_BANKS: Record<string, { bank: string; bankKey: BankKey | null; branch: string }> = {
  UTIB: { bank: "Axis Bank", bankKey: "axis", branch: "Mumbai, Worli" },
  ICIC: { bank: "ICICI Bank", bankKey: "icici", branch: "Mumbai, Bandra Kurla Complex" },
  INDB: { bank: "IndusInd Bank", bankKey: "indusind", branch: "Mumbai, Nariman Point" },
  HDFC: { bank: "HDFC Bank", bankKey: null, branch: "Mumbai, Lower Parel" },
  SBIN: { bank: "State Bank of India", bankKey: null, branch: "Mumbai Main Branch" },
  CNRB: { bank: "Canara Bank", bankKey: null, branch: "Bengaluru, MG Road" },
  FDRL: { bank: "Federal Bank", bankKey: null, branch: "Kochi, Marine Drive" },
  KKBK: { bank: "Kotak Mahindra Bank", bankKey: null, branch: "Mumbai, Fort" },
};

export function syncedLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  const d = Math.round(minutes / (24 * 60));
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

export const RTGS_MIN = 200000;

export const ONBOARDING_BANKS: { key: BankKey; name: string; initials: string }[] = [
  { key: "axis", name: "Axis Bank", initials: "AX" },
  { key: "icici", name: "ICICI Bank", initials: "IC" },
  { key: "indusind", name: "IndusInd Bank", initials: "IB" },
];

export const PURPOSES = [
  { value: "vendor", label: "Vendor Payment" },
  { value: "salary", label: "Salary" },
  { value: "reimbursement", label: "Reimbursement" },
  { value: "loan", label: "Loan / Advance" },
  { value: "other", label: "Other" },
] as const;
export type Purpose = (typeof PURPOSES)[number]["value"];

export const MODES: { value: TransferMode; label: string; note: string }[] = [
  { value: "IMPS", label: "Instant", note: "Instant" },
  { value: "NEFT", label: "Few hours", note: "Few hours" },
  { value: "RTGS", label: "Same day", note: "Same day, large amounts" },
];

export const BULK_TEMPLATE_HREF =
  "data:text/csv;charset=utf-8," + encodeURIComponent("name,account_number,ifsc,amount\nAcme Traders,1234567890,ICIC0000123,25000\n");

export function initialContacts(): PayeeContact[] {
  return [
    {
      id: "c1",
      name: "Kavya Textiles",
      category: "vendor",
      bills: [
        { id: "b1", number: "INV-1042", date: "12-08-2026", amount: 18500, dueDate: "26-08-2026" },
        { id: "b2", number: "INV-1055", date: "02-09-2026", amount: 9200, dueDate: "16-09-2026" },
      ],
      pastTransfers: [
        { date: "15-07-2026", amount: 12000, mode: "NEFT" },
        { date: "02-06-2026", amount: 8000, mode: "IMPS" },
      ],
      accounts: [{ id: "a1", bank: "Axis Bank", ifsc: "UTIB0001234", masked: "••••4821", verified: true }],
    },
    { id: "c2", name: "Rohan Mehta", category: "other", accounts: [{ id: "a2", bank: "ICICI Bank", ifsc: "ICIC0000567", masked: "••••2210", verified: false }] },
    {
      id: "c3",
      name: "Sunrise Logistics",
      category: "other",
      accounts: [
        { id: "a3", bank: "Axis Bank", ifsc: "UTIB0002211", masked: "••••7734", verified: true },
        { id: "a4", bank: "ICICI Bank", ifsc: "ICIC0004432", masked: "••••1190", verified: false },
      ],
    },
    { id: "c4", name: "Ananya Rao", category: "other", accounts: [{ id: "a5", bank: "HDFC Bank", ifsc: "HDFC0001122", masked: "••••5567", verified: true }] },
    {
      id: "c5",
      name: "Blue Ocean Traders",
      category: "vendor",
      bills: [{ id: "b3", number: "INV-778", date: "20-08-2026", amount: 32000, dueDate: "03-09-2026" }],
      pastTransfers: [{ date: "10-07-2026", amount: 20000, mode: "NEFT" }],
      accounts: [{ id: "a6", bank: "ICICI Bank", ifsc: "ICIC0009981", masked: "••••3345", verified: false }],
    },
    { id: "c6", name: "Priya Sharma", category: "other", accounts: [{ id: "a7", bank: "State Bank of India", ifsc: "SBIN0003344", masked: "••••8802", verified: true }] },
    {
      id: "c7",
      name: "Vertex Packaging",
      category: "vendor",
      bills: [{ id: "b4", number: "INV-2207", date: "05-09-2026", amount: 14750, dueDate: "19-09-2026" }],
      accounts: [{ id: "a8", bank: "IndusInd Bank", ifsc: "INDB0000412", masked: "••••6603", verified: true }],
    },
  ];
}

export function initialEmployees(): Employee[] {
  return [
    { id: "e1", name: "Meera Iyer", role: "Design", account: { bank: "HDFC Bank", ifsc: "HDFC0002233", masked: "••••7712", verified: true } },
    { id: "e2", name: "Arjun Nair", role: "Sales", account: null },
    { id: "e3", name: "Divya Menon", role: "Operations", account: { bank: "Axis Bank", ifsc: "UTIB0005566", masked: "••••3390", verified: false } },
    { id: "e4", name: "Karthik Subramaniam", role: "Engineering", account: { bank: "ICICI Bank", ifsc: "ICIC0007744", masked: "••••1128", verified: true } },
    { id: "e5", name: "Neha Kapoor", role: "Finance", account: { bank: "IndusInd Bank", ifsc: "INDB0001187", masked: "••••4419", verified: false } },
  ];
}

/** Rows the "Upload File" demo adds: one clean, one unverified, a duplicate, a bad IFSC and a missing amount. */
export function demoUploadRows(): BulkRow[] {
  const t = Date.now();
  return [
    { id: `f${t}1`, key: "file-nimbus", name: "Nimbus Traders", bank: "Axis Bank", maskedIfsc: "UTIB•••901", verified: true, amount: "25000", ifscValid: true },
    { id: `f${t}2`, key: "file-orbit", name: "Orbit Supplies", bank: "HDFC Bank", maskedIfsc: "HDFC•••220", verified: false, amount: "15000", ifscValid: true },
    { id: `f${t}3`, key: "file-orbit", name: "Orbit Supplies", bank: "HDFC Bank", maskedIfsc: "HDFC•••220", verified: false, amount: "15000", ifscValid: true },
    { id: `f${t}4`, key: "file-kiran", name: "Kiran Enterprises", bank: "Partner Bank", maskedIfsc: "XXXX•••000", verified: false, amount: "12000", ifscValid: false },
    { id: `f${t}6`, key: "file-zenith", name: "Zenith Fabrics", bank: "IndusInd Bank", maskedIfsc: "INDB•••412", verified: true, amount: "18000", ifscValid: true },
    { id: `f${t}5`, key: "file-vikram", name: "Vikram Rao", bank: "Axis Bank", maskedIfsc: "UTIB•••220", verified: true, amount: "", ifscValid: true },
  ];
}

/** Accounts Fund Transfer can pay from: active and connected through a Connected Banking integration. */
export function payFromAccounts(accounts: CompanyAccount[], s: BankingScenario): PayFromAccount[] {
  return accounts
    .filter((a) => a.active && a.bankKey && a.connection === "connected")
    .map((a) => ({
      id: a.id,
      bank: a.bank,
      masked: last4(a.number),
      balance: a.liveBalance?.[s.balance === "low" ? 1 : 0] ?? 0,
      approvalMode: a.bankKey === "icici" ? "single" : a.approval,
      bulkSupported: CONNECTED_BANKING[a.bankKey!].bulk,
    }));
}

export function approvalNote(mode: ApprovalMode) {
  return mode === "maker-checker"
    ? "Requires a checker's approval in netbanking after you initiate here."
    : "Approved by a single operator — no separate checker step.";
}

export function maskIfsc(ifsc: string) {
  return ifsc.slice(0, 4) + "•••" + ifsc.slice(-3);
}

export function maskAccount(accountNumber: string) {
  return "••••" + accountNumber.slice(-4);
}

export function fmtINR(n: number) {
  return "₹" + (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function bankKeyFromName(name: string): BankKey | null {
  const n = name.toLowerCase();
  if (n.startsWith("axis")) return "axis";
  if (n.startsWith("icici")) return "icici";
  if (n.startsWith("indusind")) return "indusind";
  return null;
}

export function bankFromIfsc(ifsc: string) {
  const map: Record<string, string> = { ICIC: "ICICI Bank", UTIB: "Axis Bank", INDB: "IndusInd Bank", HDFC: "HDFC Bank", SBIN: "State Bank of India" };
  return map[ifsc.slice(0, 4).toUpperCase()] ?? "Partner Bank";
}

/** Below ₹2,00,000 defaults to IMPS; at or above it NEFT (RTGS only by choice). */
export function autoMode(amount: number): TransferMode {
  return amount > 0 && amount < RTGS_MIN ? "IMPS" : "NEFT";
}

export const digitsOnly = (v: string) => v.replace(/[^0-9]/g, "");
export const amountOnly = (v: string) => v.replace(/[^0-9.]/g, "");

function parseDmy(d: string) {
  const [dd, mm, yy] = d.split("-").map(Number);
  return new Date(yy, mm - 1, dd).getTime();
}

export function oldestBill(bills: Bill[]) {
  return bills.reduce((a, b) => (parseDmy(a.date) <= parseDmy(b.date) ? a : b));
}
