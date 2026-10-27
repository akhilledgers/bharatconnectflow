// Mock data + helpers for the Banking → Fund Transfer prototype (from the "Fund Transfer" Claude Design handoff).
import { BANK_CONNECTORS } from "./bankConnectors";

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
  /** Payees must be on this account's beneficiary list in net banking (IndusInd). */
  needsBeneficiary: boolean;
  short: string;
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
  /** Bills / expense vouchers this row pays, when it came from them. */
  docs?: string[];
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
  /** Whether the bank has activated a Connected Banking request when the app checks (banks that activate first, e.g. ICICI). */
  bankActivation: "activated" | "pending";
  /** Whether the customer has approved LEDGERS in their net banking when the app checks (banks that ask for it). */
  bankApproval: "approved" | "pending";
  /** Whether the checker has approved newly added beneficiaries in net banking when the app checks. */
  beneficiaryApproval: "approved" | "pending";
  /** What the next uploaded statement turns out to be when LEDGERS reads it. */
  statementFile: "readable" | "locked" | "other-account";
  /** Overview: Needs attention and Accounts side by side, or stacked (the earlier layout). */
  overviewLayout: "split" | "stacked";
}

export const DEFAULT_SCENARIO: BankingScenario = { balance: "normal", verify: "random", register: "success", bankActivation: "activated", bankApproval: "approved", beneficiaryApproval: "approved", statementFile: "readable", overviewLayout: "split" };

/** Banks LEDGERS has a Connected Banking integration with. */
export const CONNECTED_BANKING = Object.fromEntries(
  Object.values(BANK_CONNECTORS).map((c) => [c.key, { short: c.short, bulk: c.bulk, approvalChoice: c.approval }]),
) as Record<BankKey, { short: string; bulk: boolean; approvalChoice: boolean }>;

/** e.g. "Axis and IndusInd" — the banks that support bulk transfer. */
export const BULK_BANKS_LABEL = Object.values(CONNECTED_BANKING)
  .filter((b) => b.bulk)
  .map((b) => b.short)
  .join(" and ");

/**
 * none → (request sent) requested, while the bank activates it (banks with bankActivation, e.g. ICICI)
 * → pending, waiting for the customer's approval in net / corporate banking → connected; connected can expire.
 */
export type BankConnection = "none" | "requested" | "pending" | "connected" | "expired";

/** One of the company's own bank accounts (Banking → Accounts). */
export interface CompanyAccount {
  id: string;
  bank: string;
  /** Set when LEDGERS has a Connected Banking integration with this bank. */
  bankKey: BankKey | null;
  number: string;
  ifsc: string;
  nickname: string;
  /**
   * Bank types (Current, Savings, OD, CC) plus the other places money sits: a credit card, a payment gateway's
   * settlement balance, a wallet. All of them use statements and Transactions the same way; see groupOf().
   */
  type: "Current" | "Savings" | "Cash credit (CC)" | "Overdraft (OD)" | "Credit card" | "Payment gateway" | "Wallet";
  /** OD, CC and credit cards: the sanctioned / credit limit, when the user gave one. Without it there are no limit alerts. */
  limit?: number;
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
    // Borrowing: an OD with a limit (two-thirds used), a CC with no limit given.
    { ...base, id: "p9", bank: "Kotak Mahindra Bank", bankKey: null, number: "510020007781", ifsc: "KKBK0000958", type: "Overdraft (OD)", nickname: "Working capital", verified: true, limit: 500000, statement: { date: "15-10-2026", balance: -340000 } },
    { ...base, id: "p10", bank: "State Bank of India", bankKey: null, number: "39011005520", ifsc: "SBIN0001234", type: "Cash credit (CC)", verified: true, statement: { date: "14-10-2026", balance: -120000 } },
    // A credit card past 90% of its limit, a payment gateway with a payout pending, a wallet.
    { ...base, id: "p11", bank: "HDFC Bank", bankKey: null, number: "4421", ifsc: "", type: "Credit card", nickname: "Corporate card", verified: true, limit: 200000, statement: { date: "12-10-2026", balance: -182500 } },
    { ...base, id: "p12", bank: "Razorpay", bankKey: null, number: "", ifsc: "", type: "Payment gateway", verified: true, statement: { date: "19-10-2026", balance: 18600 } },
    { ...base, id: "p13", bank: "Amazon Pay", bankKey: null, number: "", ifsc: "", type: "Wallet", verified: true, nickname: "Office purchases", statement: { date: "10-10-2026", balance: 3200 } },
  ];
}

/** Banking → Transactions: every account at once. */
export const ALL_ACCOUNTS = "all";

/** Where an account sits in lists: bank accounts (incl. OD/CC), credit cards, payment gateways, wallets. */
export type AccountGroup = "bank" | "card" | "gateway" | "wallet";
export const groupOf = (a: Pick<CompanyAccount, "type">): AccountGroup =>
  a.type === "Credit card" ? "card" : a.type === "Payment gateway" ? "gateway" : a.type === "Wallet" ? "wallet" : "bank";
export const GROUP_LABEL: Record<AccountGroup, string> = { bank: "Bank accounts", card: "Credit cards", gateway: "Payment gateways", wallet: "Wallets" };
export const GROUP_ORDER: AccountGroup[] = ["bank", "card", "gateway", "wallet"];
/** Money the business has: what "Cash in bank" totals. */
export const isDeposit = (a: Pick<CompanyAccount, "type">) => a.type === "Current" || a.type === "Savings";
/** Money borrowed: OD, CC and credit cards, where the balance is what's used and a limit may apply. */
export const isCredit = (a: Pick<CompanyAccount, "type">) => a.type === "Overdraft (OD)" || a.type === "Cash credit (CC)" || a.type === "Credit card";

/** How an account is named everywhere: "Axis ••9012", "HDFC Bank card ••4421", "Razorpay". */
export function accountName(a: Pick<CompanyAccount, "type" | "bank" | "bankKey" | "number">) {
  const g = groupOf(a);
  if (g === "gateway" || g === "wallet") return a.bank;
  const name = a.bankKey ? CONNECTED_BANKING[a.bankKey].short : a.bank;
  return g === "card" ? `${name} card ${last4(a.number)}` : `${name} ${last4(a.number)}`;
}

/** OD / CC / card: what's used (a negative balance) and, with a limit, what's left and whether it's near or over. */
export function creditUse(a: Pick<CompanyAccount, "limit">, balance: number) {
  const used = Math.max(0, -balance);
  if (!a.limit) return { used };
  const available = a.limit - used;
  return { used, limit: a.limit, available, share: used / a.limit, over: available < 0, near: available >= 0 && used / a.limit >= 0.9 };
}

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
  { value: "vendor", label: "Vendor payment" },
  { value: "salary", label: "Salary" },
  { value: "reimbursement", label: "Reimbursement" },
  { value: "loan", label: "Loan / advance" },
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
    { id: "c8", name: "Deepak Trading", category: "vendor", accounts: [] },
    // Suppliers on the seeded bills and expense vouchers (Om Traders has no bank account yet).
    { id: "c9", name: "Verve Financial Services Private Limited", category: "vendor", accounts: [{ id: "a9", bank: "HDFC Bank", ifsc: "HDFC0000240", masked: "••••3984", verified: true }] },
    { id: "c10", name: "Manoj Kumar Yadav", category: "vendor", accounts: [{ id: "a10", bank: "State Bank of India", ifsc: "SBIN0001707", masked: "••••7710", verified: true }] },
    { id: "c11", name: "Pugal - Einvoice Sandbox GSTIN", category: "vendor", accounts: [{ id: "a11", bank: "ICICI Bank", ifsc: "ICIC0000552", masked: "••••5520", verified: false }] },
    { id: "c12", name: "Sri Lakshmi Enterprises", category: "vendor", accounts: [{ id: "a12", bank: "Canara Bank", ifsc: "CNRB0000412", masked: "••••0412", verified: true }] },
    { id: "c13", name: "Swift Cabs", category: "vendor", accounts: [{ id: "a13", bank: "Axis Bank", ifsc: "UTIB0000881", masked: "••••6620", verified: true }] },
    { id: "c14", name: "Hotel Residency", category: "vendor", accounts: [{ id: "a14", bank: "HDFC Bank", ifsc: "HDFC0000615", masked: "••••1405", verified: true }] },
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
      needsBeneficiary: !!BANK_CONNECTORS[a.bankKey!].beneficiaryList,
      short: CONNECTED_BANKING[a.bankKey!].short,
    }));
}


export function maskIfsc(ifsc: string) {
  return ifsc.slice(0, 4) + "•••" + ifsc.slice(-3);
}

export function maskAccount(accountNumber: string) {
  return "••••" + accountNumber.slice(-4);
}

export function fmtINR(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  // The sign goes before the rupee symbol: −₹1,250.00, not ₹-1,250.00.
  return (v < 0 ? "−₹" : "₹") + Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
