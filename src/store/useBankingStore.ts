import { create } from "zustand";
import {
  DEFAULT_SCENARIO,
  bankFromIfsc,
  IFSC_BANKS,
  initialContacts,
  initialEmployees,
  maskAccount,
  payFromAccounts,
  type ApprovalMode,
  type BankAccount,
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
  setEmployeeAccount: (employeeId: string, input: NewAccountInput) => BankAccount;
  /**
   * Register Connected Banking: the bank verifies the IDs over its API and answers straight away.
   * On success the account goes live (and its approval mode is recorded); outcome follows the dev panel.
   */
  registerBank: (accountId: string, approval?: ApprovalMode) => Promise<boolean>;
  /** Penny-less verification of one of the company's own accounts. */
  verifyOwnAccount: (accountId: string) => Promise<boolean>;
  addCompanyAccount: (input: NewCompanyAccountInput) => CompanyAccount;
  updateAccount: (accountId: string, patch: Partial<CompanyAccount>) => void;
  setPrimary: (accountId: string) => void;
  /** Pull the latest balance and statement from the bank; resolves with the number of new transactions. */
  syncAccount: (accountId: string) => Promise<number>;
  uploadStatement: (accountId: string, fileName?: string) => void;

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
  setup: "mixed",

  setScenario: (patch) => set((s) => ({ scenario: { ...s.scenario, ...patch } })),
  resetData: () => {
    synced.clear();
    set({ contacts: initialContacts(), employees: initialEmployees(), parties: initialParties(), ...setupData(get().setup) });
  },
  applySetup: (setup) => {
    synced.clear();
    set({ setup, parties: initialParties(), ...setupData(setup) });
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

  registerBank: (accountId, approval) =>
    new Promise((resolve) => {
      setTimeout(() => {
        if (get().scenario.register === "fail") return resolve(false);
        get().updateAccount(accountId, {
          connection: "connected",
          verified: true,
          syncedMinutesAgo: 0,
          ...(approval ? { approval } : {}),
        });
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id !== accountId || a.liveBalance ? a : { ...a, liveBalance: [215400, 2000] })),
        }));
        resolve(true);
      }, 1500);
    }),

  verifyOwnAccount: async (accountId) => {
    const ok = await get().verifyAccount();
    if (ok) get().updateAccount(accountId, { verified: true });
    return ok;
  },

  addCompanyAccount: ({ ifsc, number, nickname, type, primary }) => {
    const known = IFSC_BANKS[ifsc.slice(0, 4)];
    const account: CompanyAccount = {
      id: `p${Date.now()}`,
      bank: known?.bank ?? bankFromIfsc(ifsc),
      bankKey: known?.bankKey ?? null,
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

  uploadStatement: (accountId, fileName = "statement.pdf") => {
    const id = `i${Date.now()}`;
    set((s) => ({ imports: [{ id, accountId, source: "upload", file: fileName, period: "Up to today", status: "processing", at: nowLabel() }, ...s.imports] }));
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
    set((s) => ({ bookEntries: s.bookEntries.map((e) => (e.id === entryId ? { ...e, accountId, assumedAccount: false } : e)) })),

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
