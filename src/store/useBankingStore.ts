import { BANK_CONNECTORS } from "../pages/banking/bankConnectors";
import { create } from "zustand";
import {
  DEFAULT_SCENARIO,
  bankFromIfsc,
  bankKeyFromName,
  IFSC_BANKS,
  initialContacts,
  initialEmployees,
  maskAccount,
  payFromAccounts,
  type ApprovalMode,
  type BankAccount,
  type Bill,
  type BankingScenario,
  type CompanyAccount,
  type Employee,
  type PayeeContact,
} from "../pages/banking/data";
import { setupData, type BankingSetup, type MoneyFlow } from "../pages/banking/setups";
import {
  entryForLine,
  initialParties,
  type BankLine,
  type Party,
  type BookEntry,
  type Match,
  type Payout,
  type StatementImport,
} from "../pages/banking/ledgerData";

/** What the account forms hand back once an account is entered (and optionally verified). */
export interface NewAccountInput {
  accountNumber: string;
  ifsc: string;
  verified: boolean;
}

function toAccount({ accountNumber, ifsc, verified }: NewAccountInput): BankAccount {
  return { id: `a${Date.now()}`, bank: bankFromIfsc(ifsc), ifsc, masked: maskAccount(accountNumber), verified };
}

// Payees, employees and the dev-panel scenario for Banking → Fund Transfer. Kept apart from the main
// store: this is the Fund Transfer prototype's own mock world, not the Bharat Connect business data.
/** What Add bank account collects. */
export interface NewCompanyAccountInput {
  ifsc: string;
  number: string;
  nickname: string;
  type: CompanyAccount["type"];
  primary: boolean;
  /** Bank name from the IFSC directory, when the lookup found it. */
  bank?: string;
  opening?: CompanyAccount["opening"];
}

interface BankingState {
  scenario: BankingScenario;
  /** The company's own bank accounts. */
  accounts: CompanyAccount[];
  contacts: PayeeContact[];
  employees: Employee[];
  bankLines: BankLine[];
  bookEntries: BookEntry[];
  payouts: Payout[];
  imports: StatementImport[];
  /**
   * Beneficiary lists for banks that need one (IndusInd), per connected account (= customer ID): payee key →
   * status. Payee keys: contact:<contactId>:<accountId>, employee:<employeeId>, other:<ifsc>:<name>.
   */
  beneficiaries: Record<string, Record<string, Beneficiary>>;
  /** Contacts with their open invoices and bills, for matching bank lines by hand. */
  parties: Party[];
  moneyFlow: MoneyFlow;
  /** Which stage of the business's banking journey the sample data shows (dev panel). */
  setup: BankingSetup;

  setScenario: (patch: Partial<BankingScenario>) => void;
  resetData: () => void;
  applySetup: (setup: BankingSetup) => void;
  /** Resolves after the simulated penny-drop; outcome follows the dev panel's verification setting. */
  verifyAccount: () => Promise<boolean>;
  markContactAccountVerified: (contactId: string, accountId: string) => void;
  markEmployeeAccountVerified: (employeeId: string) => void;
  addContact: (name: string, input: NewAccountInput) => { contact: PayeeContact; account: BankAccount };
  addContactAccount: (contactId: string, input: NewAccountInput) => BankAccount;
  /**
   * Paying bills / expense vouchers from where they live: the supplier as a payee (found by name, added as a
   * vendor without a bank account if new), with those documents among its open bills. Returns the contact's id.
   */
  vendorForDocs: (name: string, docs: Bill[]) => string;
  /** Bills / expense vouchers marked paid by hand (cash, UPI, cheque, or a transfer made outside LEDGERS). */
  recordedDocs: Record<string, RecordedPayment>;
  recordDocPayment: (number: string, p: RecordedPayment) => void;
  setEmployeeAccount: (employeeId: string, input: NewAccountInput) => BankAccount;
  /**
   * Register Connected Banking: the bank verifies the IDs over its API and answers straight away.
   * On success the account goes live (and its approval mode is recorded); outcome follows the dev panel.
   */
  registerBank: (accountId: string, approval?: ApprovalMode) => Promise<boolean>;
  /** For a connection waiting on net-banking approval: ask the bank whether it's been approved (goes live if so). */
  checkConnection: (accountId: string) => Promise<boolean>;
  /** Single user: the OTP for adding these payees is confirmed and they're active straight away. */
  addBeneficiariesWithOtp: (accountId: string, payees: { key: string; code: string }[]) => Promise<void>;
  /** Maker & checker: the payees are added and wait for the checker to approve in net banking. */
  requestBeneficiaries: (accountId: string, payees: { key: string; code: string }[]) => void;
  /** Ask the bank whether the checker has approved them; resolves with how many are now active. */
  checkBeneficiaries: (accountId: string, keys: string[]) => Promise<number>;
  /** Penny-less verification of one of the company's own accounts. */
  verifyOwnAccount: (accountId: string) => Promise<boolean>;
  addCompanyAccount: (input: NewCompanyAccountInput) => CompanyAccount;
  updateAccount: (accountId: string, patch: Partial<CompanyAccount>) => void;
  setPrimary: (accountId: string) => void;
  /** Pull the latest balance and statement from the bank; resolves with the number of new transactions. */
  syncAccount: (accountId: string) => Promise<number>;
  uploadStatement: (accountId: string, fileName?: string, period?: string) => void;
  /** Statement uploads left in the plan; past these each upload is charged. */
  uploadCredits: number;

  // ---- reconciliation (Transactions) ----
  acceptMatches: (lineIds: string[]) => void;
  /** Reject an AI match (or undo a match): the bank line becomes Unmatched, its entries Not in bank. */
  rejectMatch: (lineId: string) => void;
  /**
   * Settle a line by hand: link entries already in the books, or record a new one (settling the given
   * invoices/bills by the allocated amounts). Replaces whatever the line was matched to before.
   */
  resolveLine: (lineId: string, match: Match, opts?: { entryIds?: string[]; party?: string; settle?: { itemId: string; amount: number }[] }) => void;
  /** Teach the engine that a UPI ID / narration name belongs to a contact. */
  rememberKey: (partyId: string, key: string) => void;
  moveEntry: (entryId: string, accountId: string) => void;

  // ---- payouts ----
  addPayout: (p: Omit<Payout, "id" | "ref" | "initiatedAt" | "initiatedBy">) => Payout;
  retryPayout: (payoutId: string) => void;
  cancelPayout: (payoutId: string) => void;
  /** Dev panel: the checker approves everything waiting in net banking. */
  approveAwaiting: () => void;
  /** Dev panel: the next payout with the bank fails. */
  failProcessing: () => void;
}

let payoutSeq = 1042;
const synced = new Set<string>();
const todayDMY = () => {
  const d = new Date();
  return [d.getDate(), d.getMonth() + 1, d.getFullYear()].map((n) => String(n).padStart(2, "0")).join("-");
};
const daysAgo = (dmy: string) => {
  const [d, m, y] = dmy.split("-").map(Number);
  return Math.max(0, Math.floor((Date.now() - new Date(y, m - 1, d).getTime()) / 86_400_000));
};
const nowLabel = () => "Today, " + new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export const useBankingStore = create<BankingState>((set, get) => ({
  scenario: DEFAULT_SCENARIO,
  contacts: initialContacts(),
  employees: initialEmployees(),
  ...setupData("mixed"),
  parties: initialParties(),
  beneficiaries: { p3: syncedBeneficiaries() },
  setup: "mixed",

  setScenario: (patch) => set((s) => ({ scenario: { ...s.scenario, ...patch } })),
  resetData: () => {
    synced.clear();
    set({ contacts: initialContacts(), employees: initialEmployees(), parties: initialParties(), beneficiaries: { p3: syncedBeneficiaries() }, ...setupData(get().setup) });
  },
  applySetup: (setup) => {
    synced.clear();
    set({ setup, parties: initialParties(), beneficiaries: { p3: syncedBeneficiaries() }, ...setupData(setup) });
  },

  verifyAccount: () =>
    new Promise((resolve) => {
      setTimeout(() => {
        const { verify } = get().scenario;
        resolve(verify === "pass" ? true : verify === "fail" ? false : Math.random() < 0.75);
      }, 1100);
    }),

  markContactAccountVerified: (contactId, accountId) =>
    set((s) => ({
      contacts: s.contacts.map((c) =>
        c.id !== contactId ? c : { ...c, accounts: c.accounts.map((a) => (a.id !== accountId ? a : { ...a, verified: true })) },
      ),
    })),

  markEmployeeAccountVerified: (employeeId) =>
    set((s) => ({
      employees: s.employees.map((e) => (e.id !== employeeId || !e.account ? e : { ...e, account: { ...e.account, verified: true } })),
    })),

  addContact: (name, input) => {
    const account = toAccount(input);
    const contact: PayeeContact = { id: `c${Date.now()}`, name, category: "other", accounts: [account] };
    set((s) => ({ contacts: [...s.contacts, contact] }));
    return { contact, account };
  },

  addContactAccount: (contactId, input) => {
    const account = toAccount(input);
    set((s) => ({ contacts: s.contacts.map((c) => (c.id !== contactId ? c : { ...c, accounts: [...c.accounts, account] })) }));
    return account;
  },

  recordedDocs: {},
  recordDocPayment: (number, p) => set((s) => ({ recordedDocs: { ...s.recordedDocs, [number]: p } })),

  vendorForDocs: (name, docs) => {
    const key = name.trim().toLowerCase();
    const found = get().contacts.find((c) => c.name.toLowerCase() === key);
    const id = found?.id ?? `c${Date.now()}`;
    const merge = (bills: Bill[] = []) => [...bills.filter((b) => !docs.some((d) => d.id === b.id)), ...docs];
    set((s) => ({
      contacts: found
        ? s.contacts.map((c) => (c.id === id ? { ...c, category: "vendor", bills: merge(c.bills) } : c))
        : [...s.contacts, { id, name, category: "vendor", accounts: [], bills: docs }],
    }));
    return id;
  },

  registerBank: (accountId, approval) =>
    new Promise((resolve) => {
      setTimeout(() => {
        if (get().scenario.register === "fail") return resolve(false);
        const key = get().accounts.find((a) => a.id === accountId)?.bankKey;
        // Banks that need approval in net banking wait in "pending" until the customer approves there.
        const needsApproval = !!(key && BANK_CONNECTORS[key].netBankingApproval);
        get().updateAccount(accountId, { verified: true, ...(approval ? { approval } : {}) });
        if (needsApproval) get().updateAccount(accountId, { connection: "pending" });
        else goLive(accountId);
        resolve(true);
      }, 1500);
    }),

  addBeneficiariesWithOtp: (accountId, payees) =>
    new Promise((resolve) =>
      setTimeout(() => {
        setBeneficiaries(accountId, payees, "active");
        resolve();
      }, 900),
    ),

  requestBeneficiaries: (accountId, payees) => setBeneficiaries(accountId, payees, "pending"),

  checkBeneficiaries: (accountId, keys) =>
    new Promise((resolve) =>
      setTimeout(() => {
        if (get().scenario.beneficiaryApproval !== "approved") return resolve(0);
        const list = get().beneficiaries[accountId] ?? {};
        const pending = keys.filter((k) => list[k]?.status === "pending").map((k) => ({ key: k, code: list[k].code }));
        setBeneficiaries(accountId, pending, "active");
        resolve(pending.length);
      }, 1100),
    ),

  checkConnection: (accountId) =>
    new Promise((resolve) => {
      setTimeout(() => {
        if (get().scenario.bankApproval !== "approved") return resolve(false);
        goLive(accountId);
        resolve(true);
      }, 1200);
    }),

  verifyOwnAccount: async (accountId) => {
    const ok = await get().verifyAccount();
    if (ok) get().updateAccount(accountId, { verified: true });
    return ok;
  },

  addCompanyAccount: ({ ifsc, number, nickname, type, primary, bank, opening }) => {
    const known = IFSC_BANKS[ifsc.slice(0, 4)];
    const account: CompanyAccount = {
      id: `p${Date.now()}`,
      opening,
      bank: bank ?? known?.bank ?? bankFromIfsc(ifsc),
      bankKey: known?.bankKey ?? (bank ? bankKeyFromName(bank) : null),
      number,
      ifsc,
      nickname,
      type,
      primary: false,
      active: true,
      verified: false,
      connection: "none",
      approval: "single",
    };
    set((s) => ({ accounts: [...s.accounts, account] }));
    if (primary) get().setPrimary(account.id);
    return account;
  },

  updateAccount: (accountId, patch) =>
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, ...patch } : a)) })),

  setPrimary: (accountId) => set((s) => ({ accounts: s.accounts.map((a) => ({ ...a, primary: a.id === accountId })) })),

  syncAccount: (accountId) =>
    new Promise((resolve) => {
      setTimeout(() => {
        get().updateAccount(accountId, { syncedMinutesAgo: 0 });
        // The first sync of a session brings in one new receipt, already matched by the AI.
        if (synced.has(accountId)) return resolve(0);
        synced.add(accountId);
        const line: BankLine = {
          id: `ls${Date.now()}${accountId}`,
          accountId,
          date: todayDMY(),
          narration: "NEFT-HDFCN52026100877-KIRAN ENTERPRISES-INV-2026-131",
          amount: 26500,
          status: "suggested",
          party: "Kiran Enterprises",
          match: { kind: "Receipt", ref: "REC 2026-70", party: "Kiran Enterprises", confidence: 96, reason: "Same amount · INV-2026-131 in the narration" },
        };
        set((s) => ({
          bankLines: [line, ...s.bankLines],
          bookEntries: [...s.bookEntries, entryForLine(line)],
          accounts: s.accounts.map((a) => (a.id === accountId && a.liveBalance ? { ...a, liveBalance: [a.liveBalance[0] + line.amount, a.liveBalance[1] + line.amount] } : a)),
        }));
        resolve(1);
      }, 900);
    }),

  uploadCredits: 11,
  uploadStatement: (accountId, fileName = "statement.pdf", period = "Up to today") => {
    const id = `i${Date.now()}`;
    set((s) => ({
      uploadCredits: Math.max(0, s.uploadCredits - 1),
      imports: [{ id, accountId, source: "upload", file: fileName, period, status: "processing", at: nowLabel() }, ...s.imports],
    }));
    setTimeout(() => {
      const date = todayDMY();
      const prev = get().accounts.find((a) => a.id === accountId)?.statement?.balance ?? 75000;
      get().updateAccount(accountId, { statement: { date, balance: Math.round(prev * 1.04 * 100) / 100 } });
      set((s) => ({ imports: s.imports.map((i) => (i.id === id ? { ...i, status: "imported", lines: 37 } : i)) }));
    }, 2500);
  },

  acceptMatches: (lineIds) =>
    set((s) => {
      // A transfer between own accounts is accepted on both sides.
      const ids = new Set(lineIds);
      for (const l of s.bankLines) if (ids.has(l.id) && l.match?.pairLineId) ids.add(l.match.pairLineId);
      const accepted = s.bankLines.filter((l) => ids.has(l.id) && l.match && l.status === "suggested");
      const linked = new Set(s.bookEntries.map((e) => e.lineId));
      return {
        bankLines: s.bankLines.map((l) => (accepted.includes(l) ? { ...l, status: "matched" } : l)),
        // A match the AI proposed as a new entry (bank charge, rent, transfer) is recorded now.
        bookEntries: [...s.bookEntries, ...accepted.filter((l) => !linked.has(l.id)).map(entryForLine)],
      };
    }),

  rejectMatch: (lineId) =>
    set((s) => {
      const pair = s.bankLines.find((l) => l.id === lineId)?.match?.pairLineId;
      const ids = [lineId, ...(pair ? [pair] : [])];
      return {
        bankLines: s.bankLines.map((l) => (ids.includes(l.id) ? { ...l, status: "needs", match: undefined } : l)),
        bookEntries: s.bookEntries.map((e) =>
          e.lineId && ids.includes(e.lineId) ? { ...e, lineId: undefined, daysOpen: daysAgo(e.date), note: "Unlinked from a bank transaction" } : e,
        ),
      };
    }),

  resolveLine: (lineId, match, opts = {}) => {
    const prev = get().bankLines.find((l) => l.id === lineId);
    // Changing an earlier match: unlink what it pointed to first (those entries go back to Not in bank).
    if (prev?.match) get().rejectMatch(lineId);
    set((s) => {
      const line = s.bankLines.find((l) => l.id === lineId)!;
      const matched: BankLine = { ...line, status: "matched", match, party: opts.party ?? line.party };
      const ids = opts.entryIds ?? [];
      const settle = new Map((opts.settle ?? []).map((x) => [x.itemId, x.amount]));
      return {
        bankLines: s.bankLines.map((l) => (l.id === lineId ? matched : l)),
        bookEntries: ids.length
          ? s.bookEntries.map((e) => (ids.includes(e.id) ? { ...e, lineId } : e))
          : [...s.bookEntries, { ...entryForLine(matched), id: `e-${lineId}-${Date.now()}` }],
        parties: settle.size
          ? s.parties.map((p) => ({ ...p, items: p.items.map((i) => (settle.has(i.id) ? { ...i, due: Math.round((i.due - settle.get(i.id)!) * 100) / 100 } : i)).filter((i) => i.due > 0) }))
          : s.parties,
      };
    });
  },

  rememberKey: (partyId, key) => set((s) => ({ parties: s.parties.map((p) => (p.id === partyId && !p.keys.includes(key) ? { ...p, keys: [...p.keys, key] } : p)) })),

  moveEntry: (entryId, accountId) =>
    set((s) => ({
      bookEntries: s.bookEntries.map((e) => (e.id === entryId ? { ...e, accountId, assumedAccount: false, note: e.assumedAccount ? "Account confirmed, not seen at the bank yet" : e.note } : e)),
    })),

  addPayout: (p) => {
    const payout: Payout = { ...p, id: `po${payoutSeq}`, ref: `PO-${payoutSeq++}`, initiatedAt: nowLabel(), initiatedBy: "You" };
    set((s) => ({ payouts: [payout, ...s.payouts] }));
    if (payout.status === "processing") settleLater(payout.id);
    return payout;
  },

  retryPayout: (payoutId) => {
    const original = get().payouts.find((p) => p.id === payoutId);
    if (!original) return;
    const { id: _id, ref: _ref, initiatedAt: _at, initiatedBy: _by, utr: _utr, reason: _reason, voucher: _v, ...rest } = original;
    const approval = get().accounts.find((a) => a.id === original.fromAccountId)?.approval;
    get().addPayout({ ...rest, status: approval === "maker-checker" ? "awaiting" : "processing", retryOf: payoutId });
  },

  cancelPayout: (payoutId) => set((s) => ({ payouts: s.payouts.map((p) => (p.id === payoutId ? { ...p, status: "cancelled" } : p)) })),

  approveAwaiting: () => {
    const ids = get().payouts.filter((p) => p.status === "awaiting").map((p) => p.id);
    set((s) => ({ payouts: s.payouts.map((p) => (ids.includes(p.id) ? { ...p, status: "processing" } : p)) }));
    ids.forEach(settleLater);
  },

  failProcessing: () => {
    const next = get().payouts.find((p) => p.status === "processing");
    if (!next) return;
    set((s) => ({ payouts: s.payouts.map((p) => (p.id === next.id ? { ...p, status: "failed", reason: "Beneficiary bank is not responding" } : p)) }));
  },

  setEmployeeAccount: (employeeId, input) => {
    const account = toAccount(input);
    const { id: _id, ...rest } = account;
    set((s) => ({ employees: s.employees.map((e) => (e.id !== employeeId ? e : { ...e, account: rest })) }));
    return account;
  },
}));

/** Pay From options for Fund Transfer, derived from the accounts list. */
export function usePayFromAccounts() {
  const accounts = useBankingStore((s) => s.accounts);
  const scenario = useBankingStore((s) => s.scenario);
  return payFromAccounts(accounts, scenario);
}

/** The connection is live: balance and statements start syncing, and the beneficiary list is fetched if the bank keeps one. */
function goLive(accountId: string) {
  useBankingStore.setState((s) => {
    const key = s.accounts.find((a) => a.id === accountId)?.bankKey;
    const needsList = !!(key && BANK_CONNECTORS[key].beneficiaryList);
    return {
      accounts: s.accounts.map((a) =>
        a.id === accountId ? { ...a, connection: "connected", syncedMinutesAgo: 0, liveBalance: a.liveBalance ?? [215400, 2000] } : a,
      ),
      beneficiaries: needsList && !s.beneficiaries[accountId] ? { ...s.beneficiaries, [accountId]: syncedBeneficiaries() } : s.beneficiaries,
    };
  });
}

export interface RecordedPayment {
  date: string;
  mode: string;
  reference?: string;
}

/** A payee on the bank's beneficiary list, with the code the customer finds it by in net banking. */
export interface Beneficiary {
  status: "active" | "pending";
  code: string;
}

/** What the bank's beneficiary list returns on connect (codes as set in net banking), matched to contacts by account number + IFSC. */
function syncedBeneficiaries(): Record<string, Beneficiary> {
  return {
    "contact:c1:a1": { status: "active", code: "KAVYATEX" },
    "contact:c7:a8": { status: "active", code: "VERTEXPACK" },
    "employee:e1": { status: "active", code: "MEERAIYER" },
    "employee:e5": { status: "active", code: "NEHAK" },
  };
}

function setBeneficiaries(accountId: string, payees: { key: string; code: string }[], status: Beneficiary["status"]) {
  useBankingStore.setState((s) => ({
    beneficiaries: {
      ...s.beneficiaries,
      [accountId]: { ...s.beneficiaries[accountId], ...Object.fromEntries(payees.map((p) => [p.key, { status, code: p.code }])) },
    },
  }));
}

/** A payout with the bank settles a few seconds later (unless the dev panel failed it first). */
function settleLater(payoutId: string) {
  setTimeout(() => {
    const { payouts } = useBankingStore.getState();
    const p = payouts.find((x) => x.id === payoutId);
    if (!p || p.status !== "processing") return;
    const prefix = p.fromAccountId === "p2" ? "ICIC" : p.fromAccountId === "p3" ? "INDB" : "AXIS";
    useBankingStore.setState({
      payouts: payouts.map((x) =>
        x.id === payoutId
          ? {
              ...x,
              status: "paid",
              utr: `${prefix}${x.mode[0]}${Date.now().toString().slice(-11)}`,
              voucher: x.batch ? `${x.batch.count} vouchers` : `VOU 2026-${40 + Math.floor(Math.random() * 50)}`,
              batch: x.batch ? { ...x.batch, paid: x.batch.count } : undefined,
            }
          : x,
      ),
    });
  }, 4000);
}
