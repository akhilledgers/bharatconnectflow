// Sample bank lines, book entries, payouts and statement imports for Banking → Transactions, Payouts and
// Accounts. Bank lines carry what the AI recon engine decided; book entries are the Bank Book side.

export type LineStatus = "suggested" | "needs" | "auto" | "matched";
export type MatchKind = "Receipt" | "Payment voucher" | "Bill payment" | "Expense" | "Journal" | "Transfer";

export interface Match {
  kind: MatchKind;
  ref?: string;
  party: string;
  ledger?: string;
  /** 0–100, from the recon engine. Absent when a person matched it. */
  confidence?: number;
  reason?: string;
  /** Transfer between the company's own accounts: the bank line on the other side. */
  pairLineId?: string;
}

export interface BankLine {
  id: string;
  accountId: string;
  date: string;
  narration: string;
  /** Positive = money in, negative = money out. */
  amount: number;
  status: LineStatus;
  match?: Match;
  /** Who paid or was paid, in plain words, as read from the narration by the recon engine. */
  party?: string;
}

export interface BookEntry {
  id: string;
  accountId: string;
  date: string;
  ref: string;
  kind: "Receipt" | "Payment voucher" | "Journal";
  party: string;
  amount: number;
  /** The bank line this entry is linked to: matched, or proposed by the AI and waiting to be confirmed. */
  lineId?: string;
  /** Why an entry isn't in the bank yet (entries with no bank line). */
  daysOpen?: number;
  note?: string;
  /** Saved without a bank account, so LEDGERS assumed the primary one. */
  assumedAccount?: boolean;
}

const L = (id: string, accountId: string, date: string, narration: string, amount: number, status: LineStatus, match?: Match): BankLine => ({
  id,
  accountId,
  date,
  narration,
  amount,
  status,
  match,
});

// The engine names the party only when it's sure (a matched line takes its match's party). Unmatched lines here
// have narrations it couldn't tie to anyone, so they stay unnamed and show what kind of transaction they are.
export function initialBankLines(): BankLine[] {
  return sampleLines().map((l) => ({ ...l, party: l.match?.party }));
}

/** What a bank line is, in plain words, when nobody could be named from its narration. */
export function describeLine(l: BankLine): string {
  const n = l.narration.toUpperCase();
  const dir = l.amount > 0 ? "in" : "out";
  if (n.includes("CHARGES")) return "Bank charge";
  if (n.startsWith("INT.PD") || n.includes("INTEREST")) return "Interest credit";
  if (n.includes("GST CHALLAN") || n.includes("TDS")) return "Tax payment";
  if (n.startsWith("CHQ DEP")) return "Cheque deposit";
  if (n.startsWith("CHQ")) return "Cheque paid";
  if (n.startsWith("ACH")) return "Auto-debit";
  if (n.startsWith("UPI")) return `UPI payment ${dir}`;
  for (const mode of ["NEFT", "IMPS", "RTGS"]) if (n.startsWith(mode)) return `${mode} ${l.amount > 0 ? "credit" : "debit"}`;
  return `Money ${dir}`;
}

/** The bit of a narration that identifies the other side: a UPI ID, or the name the bank printed. */
export function narrationKey(l: BankLine): { label: string; value: string } | null {
  const parts = l.narration.split(/[/]/).map((p) => p.trim()).filter(Boolean);
  if (l.narration.toUpperCase().startsWith("UPI")) {
    const id = parts.find((p) => p.includes("@")) ?? parts.at(-1);
    return id && /[a-z]/i.test(id) ? { label: "UPI ID", value: id } : null;
  }
  const name = l.narration.split(/[/-]/).map((p) => p.trim()).filter((p) => /^[A-Z][A-Z .&]{3,}$/.test(p)).at(-1);
  return name ? { label: "Name in narration", value: name } : null;
}

// ---- Contacts, with what they owe or are owed: what a bank line can be matched against by hand ----

export interface OpenItem {
  id: string;
  ref: string;
  date: string;
  kind: "Invoice" | "Bill";
  /** Still to be paid. */
  due: number;
}

export interface Party {
  id: string;
  name: string;
  type: "Customer" | "Vendor" | "Employee";
  gstin?: string;
  phone?: string;
  /** UPI IDs / narration names the engine has learned belong to this contact. */
  keys: string[];
  items: OpenItem[];
}

const inv = (id: string, ref: string, date: string, due: number): OpenItem => ({ id, ref, date, kind: "Invoice", due });
const bill = (id: string, ref: string, date: string, due: number): OpenItem => ({ id, ref, date, kind: "Bill", due });

export function initialParties(): Party[] {
  return [
    { id: "k1", name: "Deepak Trading", type: "Vendor", gstin: "29AAGFD4417K1ZP", phone: "98450 21177", keys: [], items: [bill("o1", "BILL-0912", "28-09-2026", 2400), bill("o2", "BILL-0899", "12-09-2026", 5100)] },
    { id: "k2", name: "Deepak Enterprises", type: "Vendor", gstin: "29AAHCD9921L1Z2", phone: "99001 45522", keys: [], items: [bill("o3", "BILL-0907", "22-09-2026", 1800)] },
    { id: "k3", name: "Chander Stores", type: "Vendor", phone: "98860 77310", keys: [], items: [] },
    { id: "k4", name: "Bateaco BL", type: "Customer", gstin: "27AAJCB7781M1ZQ", phone: "97690 11820", keys: [], items: [inv("o4", "INV-2026-109", "15-09-2026", 20000), inv("o5", "INV-2026-114", "24-09-2026", 6500)] },
    { id: "k5", name: "Mehta Exports", type: "Customer", gstin: "24AABCM1123R1ZX", phone: "98250 33019", keys: [], items: [inv("o6", "INV-2026-126", "04-10-2026", 48000)] },
    { id: "k6", name: "Zenith Fabrics", type: "Customer", gstin: "33AACCZ5531H1Z9", keys: ["zenithfab@ybl"], items: [inv("o7", "INV-2026-125", "02-10-2026", 14000)] },
    { id: "k7", name: "Sharma Retail", type: "Customer", gstin: "07AAPFS8812Q1Z1", phone: "98110 64420", keys: [], items: [inv("o8", "INV-2026-127", "03-10-2026", 22000), inv("o9", "INV-2026-128", "05-10-2026", 8500)] },
    { id: "k8", name: "Kavya Textiles", type: "Vendor", gstin: "33AAKFK2210B1ZC", keys: [], items: [bill("o10", "BILL-0931", "01-10-2026", 12000)] },
    { id: "k9", name: "Sunrise Logistics", type: "Vendor", gstin: "27AAMCS6650E1ZD", keys: [], items: [bill("o11", "BILL-4480", "02-10-2026", 9600)] },
    { id: "k10", name: "Orbit Supplies", type: "Customer", gstin: "29AABCO4409N1ZS", keys: [], items: [inv("o12", "INV-2026-130", "06-10-2026", 31000)] },
    { id: "k11", name: "Blue Ocean Traders", type: "Customer", gstin: "32AAFCB3300D1ZK", keys: [], items: [inv("o13", "INV-2026-133", "06-10-2026", 4200)] },
    { id: "k12", name: "Kiran Enterprises", type: "Customer", gstin: "29AAQFK7012C1ZB", keys: [], items: [inv("o14", "INV-2026-131", "05-10-2026", 26500)] },
    { id: "k13", name: "Vertex Packaging", type: "Vendor", gstin: "29AAGCV1185P1ZT", keys: [], items: [bill("o15", "BILL-0944", "04-10-2026", 6750)] },
    { id: "k14", name: "Shivam Trading", type: "Vendor", phone: "90080 55214", keys: [], items: [bill("o16", "BILL-0950", "05-10-2026", 2000)] },
    { id: "k15", name: "Priya Sharma", type: "Employee", phone: "98450 66012", keys: [], items: [] },
    { id: "k16", name: "Ananya Rao", type: "Employee", phone: "99860 21934", keys: [], items: [] },
    { id: "k17", name: "Rohit Sharma", type: "Customer", phone: "98440 18263", keys: [], items: [] },
  ];
}

function sampleLines(): BankLine[] {
  return [
    // Axis ••9012 — Main operating
    L("l01", "p1", "05-10-2026", "NEFT-HDFCN52026100512-MEHTA EXPORTS PVT LTD-INV-2026-118", 123000, "suggested", { kind: "Receipt", ref: "REC 2026-66", party: "Mehta Exports", confidence: 98, reason: "Same amount · INV-2026-118 in the narration" }),
    L("l02", "p1", "05-10-2026", "UPIAR/431900571242/DR/DEEPAK T/ICIC/deepaktradingc", -2400, "needs"),
    L("l03", "p1", "04-10-2026", "UPI/432011873310/CR/ZENITH FABRIC/YESB/zenithfab@ybl", 29500, "suggested", { kind: "Receipt", ref: "REC 2026-65", party: "Zenith Fabrics", confidence: 95, reason: "Same amount and payer name" }),
    L("l04", "p1", "04-10-2026", "UPIAR/431901241767/DR/CHANDER/YESB/paytmqr58jeao", -160, "needs"),
    L("l05", "p1", "03-10-2026", "IMPS/P2A/627712004521/SHARMA RETAIL", 9628.35, "suggested", { kind: "Receipt", ref: "REC 2026-67", party: "Sharma Retail", confidence: 92, reason: "Equals the balance due on INV-2026-121" }),
    L("l06", "p1", "03-10-2026", "NEFT-AXOMB27616-KAVYA TEXTILES", -18500, "suggested", { kind: "Bill payment", ref: "VOU 2026-38", party: "Kavya Textiles", confidence: 99, reason: "Paid from LEDGERS · UTR matches" }),
    L("l07", "p1", "03-10-2026", "SMS ALERT CHARGES JUL-SEP 2026", -59, "needs"),
    L("l08", "p1", "02-10-2026", "ACH/BESCOM ELECTRICITY/88231", -14236, "suggested", { kind: "Expense", party: "BESCOM", ledger: "Electricity", confidence: 88, reason: "Same payee every month" }),
    L("l09", "p1", "01-10-2026", "UPI/431737559875/DR/WEWORK INDIA", -45000, "suggested", { kind: "Expense", party: "WeWork India", ledger: "Rent", confidence: 90, reason: "Same payee and amount as the last 3 months" }),
    L("l10", "p1", "01-10-2026", "IMPS/P2A/626810705563/BATEACO BL", 20000, "needs"),
    L("l11", "p1", "30-09-2026", "NEFT-ICICN52026093044-ORBIT SUPPLIES", 56200, "suggested", { kind: "Receipt", ref: "REC 2026-63", party: "Orbit Supplies", confidence: 94, reason: "Same amount and payer name" }),
    L("l12", "p1", "30-09-2026", "CHQ DEP 000406 CTS CLG", 17510, "suggested", { kind: "Receipt", ref: "REC 2026-62", party: "Rohit Sharma", confidence: 86, reason: "Cheque no. 000406 recorded on the receipt" }),
    L("l13", "p1", "29-09-2026", "UPI/431565923968/DR/AMAZON PAY", -2360, "suggested", { kind: "Expense", party: "Amazon", ledger: "Office supplies", confidence: 81, reason: "Like 4 earlier Amazon expenses" }),
    L("l14", "p1", "28-09-2026", "NEFT-SUNRISE LOGISTICS-BILL 4471", -42000, "suggested", { kind: "Bill payment", ref: "BILL-4471", party: "Sunrise Logistics", confidence: 97, reason: "Bill number in the narration" }),
    L("l15", "p1", "27-09-2026", "INT.PD:01-07-2026 TO 30-09-2026", 1158, "suggested", { kind: "Journal", party: "Axis Bank", ledger: "Interest income", confidence: 93, reason: "Quarterly interest credit" }),
    L("l16", "p1", "26-09-2026", "UPI/431519366403/CR/PRIYA SHARMA", 7899, "suggested", { kind: "Receipt", ref: "REC 2026-61", party: "Priya Sharma", confidence: 84, reason: "Same amount, received 2 days after the invoice" }),
    L("l17", "p1", "25-09-2026", "NEFT-AXOMB27601-ANANYA RAO", -12000, "auto", { kind: "Payment voucher", ref: "VOU 2026-35", party: "Ananya Rao", confidence: 99, reason: "Paid from LEDGERS · UTR matches" }),
    L("l18", "p1", "24-09-2026", "IMPS-AXOMB27577-PRIYA SHARMA", -8000, "auto", { kind: "Payment voucher", ref: "VOU 2026-34", party: "Priya Sharma", confidence: 99, reason: "Paid from LEDGERS · UTR matches" }),
    L("l19", "p1", "23-09-2026", "UPI/CR/MEHTA EXPORTS/HDFC", 40000, "auto", { kind: "Receipt", ref: "REC 2026-60", party: "Mehta Exports", confidence: 97, reason: "Same amount and payer name" }),
    L("l20", "p1", "22-09-2026", "GST CHALLAN CPIN 26090012", -18240, "auto", { kind: "Journal", party: "GST", ledger: "GST payable", confidence: 98, reason: "CPIN matches the challan" }),
    L("l21", "p1", "21-09-2026", "NEFT-RAZORPAY SOFTWARE-SETTLEMENT", 81906.16, "auto", { kind: "Receipt", ref: "REC 2026-59", party: "Razorpay", confidence: 96, reason: "Settlement report total" }),
    L("l22", "p1", "20-09-2026", "ACH/LIC OF INDIA/PREMIUM", -5400, "matched", { kind: "Expense", party: "LIC of India", ledger: "Insurance" }),
    // One bank line, many entries: a bulk payout made from LEDGERS.
    L("l23", "p1", "30-09-2026", "NEFT BULK UPLOAD AXOMB BATCH 27590 - 6 TXNS", -184300, "suggested", { kind: "Bill payment", ref: "6 vouchers", party: "Vendor batch · Sept 2", confidence: 97, reason: "Bulk payout PO-1034 from LEDGERS · same total" }),
    // Transfer between own accounts: both sides are bank lines.
    L("l24", "p1", "03-10-2026", "IMPS-OWN A/C TRANSFER-ICICI 4456", -50000, "suggested", { kind: "Transfer", party: "ICICI ••4456", confidence: 96, reason: "₹50,000 credited to ICICI ••4456 the same day", pairLineId: "l42" }),

    // Axis ••5068 — Payroll
    L("l30", "p4", "02-10-2026", "NEFT-AXOMB27588-ARJUN NAIR-SALARY", -38500, "suggested", { kind: "Payment voucher", ref: "VOU 2026-31", party: "Arjun Nair", ledger: "Salaries", confidence: 93, reason: "Salary run · same amount" }),
    L("l31", "p4", "02-10-2026", "NEFT CHARGES INCL GST", -1250, "suggested", { kind: "Expense", party: "Axis Bank", ledger: "Bank charges", confidence: 89, reason: "Bank charge narration" }),
    L("l32", "p4", "01-10-2026", "NEFT-AXOMB27587-MEERA IYER-SALARY", -42000, "auto", { kind: "Payment voucher", ref: "VOU 2026-30", party: "Meera Iyer", ledger: "Salaries", confidence: 99, reason: "Paid from LEDGERS · UTR matches" }),

    // ICICI ••4456 — Collections
    L("l40", "p2", "04-10-2026", "NEFT-INDBN26268991204-ZENITH FABRICS PRIVATE LIMITED", 18000, "auto", { kind: "Receipt", ref: "REC 2026-64", party: "Zenith Fabrics", confidence: 97, reason: "Same amount and payer name" }),
    L("l41", "p2", "30-09-2026", "UPI/CR/BLUE OCEAN TRADERS", 32000, "auto", { kind: "Receipt", ref: "REC 2026-58", party: "Blue Ocean Traders", confidence: 95, reason: "Same amount and payer name" }),
    L("l42", "p2", "03-10-2026", "IMPS-AXIS 9012-OWN TRANSFER", 50000, "suggested", { kind: "Transfer", party: "Axis ••9012", confidence: 96, reason: "₹50,000 debited from Axis ••9012 the same day", pairLineId: "l24" }),

    // Federal ••6942
    L("l50", "p6", "19-09-2026", "CHQ PAID 000318 VERTEX PACKAGING", -2700, "suggested", { kind: "Bill payment", ref: "VOU 2026-33", party: "Vertex Packaging", confidence: 91, reason: "Cheque no. 000318 on the voucher" }),

    // Canara ••8484
    L("l60", "p5", "24-09-2026", "NEFT-SBIN-ANANYA RAO", 24000, "auto", { kind: "Receipt", ref: "REC 2026-56", party: "Ananya Rao", confidence: 96, reason: "Same amount and payer name" }),
  ];
}

export function initialBookEntries(): BookEntry[] {
  return [...openBookEntries(), ...linkedEntries(initialBankLines())];
}

/** Entries in the books with no bank line yet. */
export function openBookEntries(): BookEntry[] {
  return [
    { id: "b1", accountId: "p1", date: "15-09-2026", ref: "VOU 2026-36", kind: "Payment voucher", party: "Shivam Trading", amount: -2000, daysOpen: 21, note: "Cheque 000412 not presented yet" },
    { id: "b2", accountId: "p1", date: "30-09-2026", ref: "VOU 2026-39", kind: "Payment voucher", party: "Ananya Rao", amount: -3377, daysOpen: 6, note: "Recorded as paid, not seen at the bank" },
    { id: "b3", accountId: "p1", date: "28-09-2026", ref: "REC 2026-57", kind: "Receipt", party: "Blue Ocean Traders", amount: 423, daysOpen: 8, note: "No bank account given", assumedAccount: true },
    { id: "b4", accountId: "p4", date: "29-09-2026", ref: "VOU 2026-29", kind: "Payment voucher", party: "Divya Menon", amount: -3500, daysOpen: 7, note: "Salary advance, not seen at the bank" },
    { id: "b6", accountId: "p3", date: "01-10-2026", ref: "REC 2026-55", kind: "Receipt", party: "Kiran Enterprises", amount: 40000, daysOpen: 5, note: "IndusInd isn't connected yet" },
    { id: "b7", accountId: "p3", date: "02-10-2026", ref: "REC 2026-68", kind: "Receipt", party: "Sharma Retail", amount: 22000, daysOpen: 4, note: "IndusInd isn't connected yet" },
  ];
}

// The vouchers behind the bulk payout line.
const BATCHES: Record<string, [ref: string, party: string, amount: number][]> = {
  l23: [
    ["VOU 2026-41", "Kavya Textiles", 42000],
    ["VOU 2026-42", "Sunrise Logistics", 38500],
    ["VOU 2026-43", "Orbit Supplies", 31200],
    ["VOU 2026-44", "Vertex Packaging", 27600],
    ["VOU 2026-45", "Shivam Trading", 25000],
    ["VOU 2026-46", "Deepak Trading", 20000],
  ],
};

/** The book entry a matched (or proposed) bank line points to. A bank charge or transfer the AI proposes has none until accepted. */
export function entryForLine(l: BankLine): BookEntry {
  const m = l.match!;
  const kind: BookEntry["kind"] = m.kind === "Receipt" ? "Receipt" : m.kind === "Journal" || m.kind === "Transfer" ? "Journal" : "Payment voucher";
  const prefix = m.kind === "Transfer" ? "CON" : m.kind === "Expense" ? "EXP" : "JV";
  return { id: `e-${l.id}`, accountId: l.accountId, date: l.date, ref: m.ref ?? `${prefix} ${l.id.toUpperCase()}`, kind, party: m.party, amount: l.amount, lineId: l.id };
}

/** Book entries already linked to bank lines: matched ones, and the ones the AI proposed that exist in the books. */
export function linkedEntries(lines: BankLine[]): BookEntry[] {
  return lines.flatMap((l): BookEntry[] => {
    if (!l.match) return [];
    const batch = BATCHES[l.id];
    if (batch)
      return batch.map(([ref, party, amount], i) => ({ id: `e-${l.id}-${i}`, accountId: l.accountId, date: l.date, ref, kind: "Payment voucher", party, amount: -amount, lineId: l.id }));
    if (!l.match.ref && l.status === "suggested") return [];
    return [entryForLine(l)];
  });
}

export const LEDGERS = [
  "Sales",
  "Purchases",
  "Rent",
  "Salaries",
  "Electricity",
  "Office supplies",
  "Bank charges",
  "Interest income",
  "Insurance",
  "Transfer between accounts",
  "Owner drawings",
  "GST payable",
];

export const PARTIES = ["Deepak Trading", "Chander Stores", "Bateaco BL", "Axis Bank", "Mehta Exports", "Sharma Retail", "Kavya Textiles", "Sunrise Logistics"];

// ---- payouts ----

export type PayoutStatus = "awaiting" | "processing" | "paid" | "failed" | "rejected" | "returned" | "cancelled";

export interface Payout {
  id: string;
  ref: string;
  name: string;
  detail: string;
  amount: number;
  fromAccountId: string;
  mode: "IMPS" | "NEFT" | "RTGS";
  status: PayoutStatus;
  initiatedAt: string;
  initiatedBy: string;
  utr?: string;
  reason?: string;
  voucher?: string;
  batch?: { count: number; paid: number; failed: number };
  /** For a retry, the payout it replaces. */
  retryOf?: string;
}

export function initialPayouts(): Payout[] {
  const base = { initiatedBy: "Ravi Kumar" };
  return [
    { ...base, id: "po41", ref: "PO-1041", name: "September salaries", detail: "Salary run", amount: 386400, fromAccountId: "p1", mode: "NEFT", status: "awaiting", initiatedAt: "06 Oct 2026, 9:12 am", batch: { count: 14, paid: 0, failed: 0 } },
    { ...base, id: "po40", ref: "PO-1040", name: "Kavya Textiles", detail: "INV-1042", amount: 18500, fromAccountId: "p1", mode: "NEFT", status: "awaiting", initiatedAt: "06 Oct 2026, 8:40 am" },
    { ...base, id: "po39", ref: "PO-1039", name: "Sunrise Logistics", detail: "Vendor payment", amount: 42000, fromAccountId: "p2", mode: "NEFT", status: "processing", initiatedAt: "06 Oct 2026, 8:05 am" },
    { ...base, id: "po38", ref: "PO-1038", name: "Blue Ocean Traders", detail: "INV-778", amount: 32000, fromAccountId: "p2", mode: "IMPS", status: "failed", initiatedAt: "05 Oct 2026, 6:20 pm", reason: "Beneficiary account closed" },
    { ...base, id: "po37", ref: "PO-1037", name: "Mehta Exports", detail: "Refund · CN-0042", amount: 12000, fromAccountId: "p1", mode: "IMPS", status: "paid", initiatedAt: "05 Oct 2026, 11:02 am", utr: "AXISP26100412873", voucher: "VOU 2026-40" },
    { ...base, id: "po36", ref: "PO-1036", name: "Ananya Rao", detail: "Reimbursement", amount: 8000, fromAccountId: "p1", mode: "IMPS", status: "paid", initiatedAt: "04 Oct 2026, 4:45 pm", utr: "AXISP26100498120", voucher: "VOU 2026-37" },
    { ...base, id: "po35", ref: "PO-1035", name: "Rohan Mehta", detail: "Advance", amount: 5500, fromAccountId: "p2", mode: "IMPS", status: "returned", initiatedAt: "01 Oct 2026, 2:10 pm", utr: "ICICP26100155431", reason: "Returned on 03 Oct · beneficiary account frozen" },
    { ...base, id: "po34", ref: "PO-1034", name: "Vendor batch · Sept 2", detail: "6 bills", amount: 184300, fromAccountId: "p1", mode: "NEFT", status: "paid", initiatedAt: "30 Sep 2026, 10:30 am", batch: { count: 6, paid: 6, failed: 0 }, voucher: "6 vouchers" },
    { ...base, id: "po33", ref: "PO-1033", name: "Priya Sharma", detail: "Commission", amount: 7899, fromAccountId: "p1", mode: "IMPS", status: "rejected", initiatedAt: "29 Sep 2026, 5:55 pm", reason: "Checker rejected it in Axis net banking" },
    { ...base, id: "po32", ref: "PO-1032", name: "WeWork India", detail: "Rent · October", amount: 45000, fromAccountId: "p1", mode: "NEFT", status: "paid", initiatedAt: "29 Sep 2026, 11:15 am", utr: "AXISN26092977110", voucher: "VOU 2026-32" },
  ];
}

// ---- statement imports (was "Upload Logs") ----

export interface StatementImport {
  id: string;
  accountId: string;
  source: "api" | "upload";
  file?: string;
  period: string;
  status: "processing" | "imported" | "failed";
  lines?: number;
  reason?: string;
  at: string;
}

export function initialImports(): StatementImport[] {
  return [
    { id: "i1", accountId: "p1", source: "api", period: "05 Oct 2026", status: "imported", lines: 9, at: "Today, 7:16 am" },
    { id: "i2", accountId: "p2", source: "api", period: "05 Oct 2026", status: "imported", lines: 2, at: "Today, 7:02 am" },
    { id: "i3", accountId: "p5", source: "upload", file: "Canara_Sep2026.pdf", period: "1–25 Sep 2026", status: "imported", lines: 142, at: "25 Sep 2026" },
    { id: "i4", accountId: "p6", source: "upload", file: "Federal_statement_Sep.xlsx", period: "1–20 Sep 2026", status: "imported", lines: 38, at: "20 Sep 2026" },
    { id: "i5", accountId: "p7", source: "upload", file: "AMCB_Q2.pdf", period: "Jul–Sep 2026", status: "failed", reason: "The PDF is password-protected", at: "18 Sep 2026" },
    { id: "i6", accountId: "p4", source: "api", period: "02 Oct 2026", status: "imported", lines: 3, at: "4 Oct 2026" },
  ];
}

export interface ReconSummary {
  /** Bank lines with an AI match waiting to be confirmed. */
  suggested: number;
  /** Bank lines with no match. */
  needs: number;
  auto: number;
  /** Book entries with no bank line ("Not in bank"). */
  booksOnly: BookEntry[];
  /** In bank − In your books: bank lines with nothing in the books, minus book entries the bank hasn't shown. */
  difference: number;
  reconciled: boolean;
}

export function reconFor(accountId: string, lines: BankLine[], entries: BookEntry[]): ReconSummary {
  const mine = lines.filter((l) => l.accountId === accountId);
  const linked = new Set(entries.map((e) => e.lineId).filter(Boolean));
  const bankOnly = mine.filter((l) => !linked.has(l.id));
  const booksOnly = entries.filter((e) => e.accountId === accountId && !e.lineId);
  const difference = Math.round((bankOnly.reduce((s, l) => s + l.amount, 0) - booksOnly.reduce((s, e) => s + e.amount, 0)) * 100) / 100;
  const suggested = mine.filter((l) => l.status === "suggested").length;
  const needs = mine.filter((l) => l.status === "needs").length;
  return {
    suggested,
    needs,
    auto: mine.filter((l) => l.status === "auto").length,
    booksOnly,
    difference,
    reconciled: suggested === 0 && needs === 0 && booksOnly.length === 0,
  };
}
