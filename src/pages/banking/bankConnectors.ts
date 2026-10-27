// Connected Banking, one entry per bank. Everything bank-specific lives here — what its Register Connected
// Banking API asks the customer for, whether payments can need a checker, bulk support — so the Connect /
// Reconnect dialog and the rest of Banking stay generic. To add a bank: add its key to BankKey (data.ts),
// add an entry below, and drop its logo into BankLogo.
import type { BankKey } from "./data";

/** One thing the bank's API needs from the customer. Anything LEDGERS already knows is never asked for. */
export interface ConnectField {
  key: string;
  label: string;
  placeholder: string;
  /** Digits only (opens the number pad on phones). */
  numeric?: boolean;
  /** Shown behind a "Where do I find it?" link, for IDs people commonly can't locate. */
  where?: string;
}

export interface BankConnector {
  key: BankKey;
  name: string;
  short: string;
  /** Bulk transfers through the bank's API. */
  bulk: boolean;
  /** The customer picks how payments are approved (single user or maker & checker) and the fields follow. */
  approval: boolean;
  /** Asked from everyone, first. */
  ids: ConnectField[];
  /** Asked when payments are approved by a single user. */
  single: ConnectField[];
  /** Asked when payments need a maker and a checker. Maker and checker must differ. */
  makerChecker: ConnectField[];
  /** A line above the fields, when the bank's IDs need explaining. */
  intro?: string;
  /**
   * The bank activates the request on its side first (ICICI): the connection waits in "requested" until it does,
   * and only then can the customer approve LEDGERS (netBankingApproval).
   */
  bankActivation?: boolean;
  /**
   * Banks that make the customer approve LEDGERS inside their net banking before the connection goes live.
   * `place` is what the customer calls it ("net banking" when left out). Without this, a connection is live as
   * soon as the bank verifies the details.
   */
  netBankingApproval?: { url: string; place?: string; steps: string[] };
  /**
   * The bank only pays people on the customer's beneficiary list (per customer ID). LEDGERS fetches the list on
   * connect and adds payees through the API: a single user confirms with an OTP; under maker & checker the
   * checker approves in net banking. The customer gives each beneficiary a short code to find it by in net banking.
   */
  beneficiaryList?: { codeMax: number };
}

export const BANK_CONNECTORS: Record<BankKey, BankConnector> = {
  indusind: {
    key: "indusind",
    name: "IndusInd Bank",
    short: "IndusInd",
    bulk: true,
    approval: true,
    ids: [
      {
        key: "customerId",
        label: "Customer ID",
        placeholder: "e.g. 41238870",
        numeric: true,
        where: "It's on your account welcome letter, and under Profile in IndusInd net banking.",
      },
    ],
    single: [{ key: "userCode", label: "Net banking user code", placeholder: "User code" }],
    makerChecker: [
      { key: "makerCode", label: "Maker user code", placeholder: "Maker user code" },
      { key: "checkerCode", label: "Checker user code", placeholder: "Checker user code" },
    ],
    netBankingApproval: {
      url: "https://www.indusind.bank.in/",
      steps: ["Log in to IndusInd net banking", "Open Connected Banking requests", "Approve the request from LEDGERS"],
    },
    beneficiaryList: { codeMax: 20 },
  },
  icici: {
    key: "icici",
    name: "ICICI Bank",
    short: "ICICI",
    bulk: false,
    approval: false,
    intro: "Use your self-created Login ID. If you haven't created one, use your Corporate ID and User ID.",
    ids: [
      { key: "corporateId", label: "Corporate ID", placeholder: "Corporate ID" },
      { key: "userId", label: "User ID", placeholder: "User ID" },
      { key: "aliasId", label: "Alias ID", placeholder: "Alias ID" },
    ],
    single: [],
    makerChecker: [],
    // The request goes to ICICI, ICICI activates it, then the customer approves LEDGERS in corporate banking.
    bankActivation: true,
    netBankingApproval: {
      url: "https://www.icici.bank.in/",
      place: "corporate banking",
      steps: ["Log in to ICICI corporate banking", "Open Connected Banking", "Approve the request from LEDGERS"],
    },
  },
  // Placeholder until Axis's API fields are confirmed.
  axis: {
    key: "axis",
    name: "Axis Bank",
    short: "Axis",
    bulk: true,
    approval: true,
    ids: [{ key: "corporateId", label: "Corporate ID", placeholder: "Corporate ID" }],
    single: [{ key: "userId", label: "User ID", placeholder: "User ID" }],
    makerChecker: [
      { key: "makerCode", label: "Maker user ID", placeholder: "Maker user ID" },
      { key: "checkerCode", label: "Checker user ID", placeholder: "Checker user ID" },
    ],
  },
};

/** Where the customer approves LEDGERS, e.g. "IndusInd net banking" or "ICICI corporate banking". */
export function approvalPlace(key: BankKey) {
  const c = BANK_CONNECTORS[key];
  return `${c.short} ${c.netBankingApproval?.place ?? "net banking"}`;
}

/** How payments are approved, as the customer chooses it in the Connect dialog. */
export const APPROVAL_CHOICES = [
  { value: "single", title: "Single user", body: "You make and approve payments" },
  { value: "maker-checker", title: "Maker & checker", body: "One makes, another approves" },
] as const;
