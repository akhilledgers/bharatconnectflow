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
  /** Which of the company's current accounts are connected (none = the Connect a Bank Account dialog). */
  connected: Record<BankKey, boolean>;
  /** Axis and IndusInd can run maker-checker; ICICI is always single-operator. */
  approval: Record<"axis" | "indusind", ApprovalMode>;
  balance: "normal" | "low";
  verify: "random" | "pass" | "fail";
}

export const DEFAULT_SCENARIO: BankingScenario = {
  connected: { axis: true, icici: true, indusind: true },
  approval: { axis: "maker-checker", indusind: "maker-checker" },
  balance: "normal",
  verify: "random",
};

/** The company's own current accounts LEDGERS can pay from. Balances are [normal, low]. */
export const PAY_FROM_BANKS: {
  key: BankKey;
  id: string;
  bank: string;
  short: string;
  masked: string;
  balances: [number, number];
  bulkSupported: boolean;
}[] = [
  { key: "axis", id: "p1", bank: "Axis Bank", short: "Axis", masked: "••9012", balances: [482300, 5000], bulkSupported: true },
  { key: "icici", id: "p2", bank: "ICICI Bank", short: "ICICI", masked: "••4456", balances: [115000, 2500], bulkSupported: false },
  { key: "indusind", id: "p3", bank: "IndusInd Bank", short: "IndusInd", masked: "••7731", balances: [268450, 3000], bulkSupported: true },
];

/** e.g. "Axis and IndusInd" — the banks that support bulk transfer. */
export const BULK_BANKS_LABEL = PAY_FROM_BANKS.filter((b) => b.bulkSupported)
  .map((b) => b.short)
  .join(" and ");

export const RTGS_MIN = 200000;

export const STATEMENTS = [
  ["UPI/110757199492/collect-pay-req/XX.ibz@icici/ICICI Bank/ICI9e12b082614d4f8393d25c3a1f", "2,360.00", "13,70,222.18", "XXXX4489"],
  ["NEFT-IDFB6268M2640071-WATERIA TECHNOVATION PRIVATE LIMITE--10116296130-IDFB0080151", "4,130.00", "13,74,352.18", "XXXX4489"],
  ["UPI/110757762892/collect-pay-req/XX7504@ybl/KARNATAKA BANK /ICIacbe63e3233e4a7b", "24,661.00", "13,99,013.18", "XXXX4489"],
  ["UPI/130193639244/UPI/XXnair@okhdfcb/HDFC BANK LTD/HDF9d12b347e28a42e4aa88311", "3,421.00", "14,02,434.18", "XXXX4489"],
  ["UPI/110757876936/collect-pay-req/XX4729@ybl/StateBank Of I/ICI7618d93db10940ff8640", "5,781.00", "14,08,215.18", "XXXX4489"],
  ["NEFT-INDBN26268991204-ZENITH FABRICS PRIVATE LIMITED--INDB0000412", "18,000.00", "6,84,250.00", "XXXX7731"],
  ["MMT/IMPS/626810705563/from bateaco fo/BATEACO BL/State Bank of I", "20,000.00", "14,31,636.18", "XXXX4489"],
  ["UPI/110758009194/collect-pay-req/XXmp-2@oksbi/State Bank Of I/ICI567bff1337a3421c92", "8,000.00", "14,39,636.18", "XXXX4489"],
  ["UPI/110758021692/est179031306238/XX18cd@ptsbi/State Bank Of I/ICIe8b7c789518040d11", "1,769.00", "14,41,405.18", "XXXX4489"],
  ["Razorpay Software Pvt Ltd Fu", "3,81,906.16", "1,92,53,671.25", "XXXX4826"],
].map(([details, amount, balance, acct], i) => ({ id: i, date: "25-09-2026", details, amount, balance, acct }));

export const ONBOARDING_BANKS = [
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

export function payFromAccounts(s: BankingScenario): PayFromAccount[] {
  return PAY_FROM_BANKS.filter((b) => s.connected[b.key]).map((b) => ({
    id: b.id,
    bank: b.bank,
    masked: b.masked,
    balance: b.balances[s.balance === "low" ? 1 : 0],
    approvalMode: b.key === "icici" ? "single" : s.approval[b.key],
    bulkSupported: b.bulkSupported,
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
