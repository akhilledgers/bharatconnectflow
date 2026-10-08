// IFSC check for Add bank account, via Razorpay's open IFSC API (https://github.com/razorpay/ifsc/wiki/API):
// GET https://ifsc.razorpay.com/{IFSC} → branch details as JSON, or 404 when the code doesn't exist.
// When the API can't be reached (offline, blocked network, prototype preview) a few sample branches stand in.
import { IFSC_BANKS, bankKeyFromName, type BankKey } from "./data";

export interface IfscInfo {
  ifsc: string;
  bank: string;
  bankKey: BankKey | null;
  branch: string;
  address: string;
  city: string;
  state: string;
  /** Payment rails the branch supports. */
  neft: boolean;
  rtgs: boolean;
  imps: boolean;
  upi: boolean;
  /** Where the answer came from: Razorpay's directory, or the prototype's sample branches. */
  source: "razorpay" | "sample";
}

export type IfscResult = { status: "found"; info: IfscInfo } | { status: "not-found" } | { status: "unreachable" };

interface RazorpayIfsc {
  BANK: string;
  IFSC: string;
  BRANCH: string;
  ADDRESS: string;
  CITY: string;
  STATE: string;
  NEFT: boolean;
  RTGS: boolean;
  IMPS: boolean;
  UPI: boolean;
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

const SAMPLE: Record<string, Omit<IfscInfo, "ifsc" | "bankKey" | "source">> = {
  UTIB0000004: { bank: "Axis Bank", branch: "Mumbai Worli", address: "Ground Floor, Shiv Sagar Estate, Dr Annie Besant Road, Worli", city: "Mumbai", state: "Maharashtra", neft: true, rtgs: true, imps: true, upi: true },
  ICIC0000123: { bank: "ICICI Bank", branch: "Bandra Kurla Complex", address: "ICICI Bank Towers, Bandra Kurla Complex, Bandra East", city: "Mumbai", state: "Maharashtra", neft: true, rtgs: true, imps: true, upi: true },
  INDB0000007: { bank: "IndusInd Bank", branch: "Nariman Point", address: "Ground Floor, Dalamal House, Nariman Point", city: "Mumbai", state: "Maharashtra", neft: true, rtgs: true, imps: true, upi: true },
  HDFC0000060: { bank: "HDFC Bank", branch: "Lower Parel", address: "Kamala Mills Compound, Senapati Bapat Marg, Lower Parel", city: "Mumbai", state: "Maharashtra", neft: true, rtgs: true, imps: true, upi: true },
  SBIN0000300: { bank: "State Bank of India", branch: "Mumbai Main Branch", address: "Mumbai Samachar Marg, Fort", city: "Mumbai", state: "Maharashtra", neft: true, rtgs: true, imps: true, upi: true },
  CNRB0002456: { bank: "Canara Bank", branch: "Bengaluru MG Road", address: "No 7, MG Road", city: "Bengaluru", state: "Karnataka", neft: true, rtgs: true, imps: true, upi: true },
  APGB0000001: { bank: "Andhra Pragathi Grameena Bank", branch: "Kadapa Main", address: "Head Office, Kadapa", city: "Kadapa", state: "Andhra Pradesh", neft: true, rtgs: false, imps: true, upi: false },
};

const cache = new Map<string, IfscResult>();

/** Looks an IFSC up. Never throws. */
export async function lookupIfsc(code: string): Promise<IfscResult> {
  const hit = cache.get(code);
  if (hit) return hit;
  let result: IfscResult;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`https://ifsc.razorpay.com/${code}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.status === 404) result = { status: "not-found" };
    else if (!res.ok) throw new Error(String(res.status));
    else {
      const d = (await res.json()) as RazorpayIfsc;
      result = {
        status: "found",
        info: {
          ifsc: d.IFSC,
          bank: d.BANK,
          bankKey: bankKeyFromName(d.BANK),
          branch: titleCase(d.BRANCH),
          address: titleCase(d.ADDRESS),
          city: titleCase(d.CITY),
          state: titleCase(d.STATE),
          neft: d.NEFT,
          rtgs: d.RTGS,
          imps: d.IMPS,
          upi: d.UPI,
          source: "razorpay",
        },
      };
    }
  } catch {
    result = sampleLookup(code);
  }
  if (result.status !== "unreachable") cache.set(code, result);
  return result;
}

function sampleLookup(code: string): IfscResult {
  const s = SAMPLE[code];
  if (s) return { status: "found", info: { ...s, ifsc: code, bankKey: IFSC_BANKS[code.slice(0, 4)]?.bankKey ?? null, source: "sample" } };
  const bank = IFSC_BANKS[code.slice(0, 4)];
  if (bank)
    return {
      status: "found",
      info: { ifsc: code, bank: bank.bank, bankKey: bank.bankKey, branch: bank.branch, address: "", city: "", state: "", neft: true, rtgs: true, imps: true, upi: true, source: "sample" },
    };
  return { status: "unreachable" };
}
