// Helpers for the printed invoice (LEDGERS "Formal" template): amount in words, state from GSTIN,
// bank name from IFSC.

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", r ? belowHundred(r) : ""].filter(Boolean).join(" ");
}

/** "Indian Rupee Eighty Thousand Only", using the Indian system (thousand, lakh, crore). */
export function amountInWords(amount: number): string {
  let n = Math.floor(amount);
  const paise = Math.round((amount - n) * 100);
  if (n === 0 && paise === 0) return "Indian Rupee Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1e3);
  n %= 1e3;
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  const rupees = parts.join(" ");
  return `Indian Rupee ${rupees}${paise ? ` and ${belowHundred(paise)} Paise` : ""} Only`;
}

const GST_STATES: Record<string, string> = {
  "01": "JAMMU AND KASHMIR", "02": "HIMACHAL PRADESH", "03": "PUNJAB", "04": "CHANDIGARH", "05": "UTTARAKHAND",
  "06": "HARYANA", "07": "DELHI", "08": "RAJASTHAN", "09": "UTTAR PRADESH", "10": "BIHAR", "18": "ASSAM",
  "19": "WEST BENGAL", "20": "JHARKHAND", "21": "ODISHA", "22": "CHHATTISGARH", "23": "MADHYA PRADESH",
  "24": "GUJARAT", "27": "MAHARASHTRA", "29": "KARNATAKA", "30": "GOA", "32": "KERALA", "33": "TAMIL NADU",
  "34": "PUDUCHERRY", "36": "TELANGANA", "37": "ANDHRA PRADESH",
};

export function stateFromGstin(gstin?: string): string | undefined {
  return gstin ? GST_STATES[gstin.slice(0, 2)] : undefined;
}

const BANKS: Record<string, string> = {
  ICIC: "ICICI BANK", HDFC: "HDFC BANK", SBIN: "STATE BANK OF INDIA", UTIB: "AXIS BANK", YESB: "YES BANK",
  KKBK: "KOTAK MAHINDRA BANK", PUNB: "PUNJAB NATIONAL BANK", BARB: "BANK OF BARODA", CNRB: "CANARA BANK",
};

export function bankFromIfsc(ifsc: string): string {
  return BANKS[ifsc.slice(0, 4)] ?? ifsc.slice(0, 4);
}

/** "29 September, 2026" from "29-09-2026" — the date style in LEDGERS' reconciliation table. */
export function longDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split("-").map(Number);
  const month = new Date(y, m - 1, 1).toLocaleString("en-GB", { month: "long" });
  return `${d} ${month}, ${y}`;
}
