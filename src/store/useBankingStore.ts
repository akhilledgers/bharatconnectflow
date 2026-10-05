import { create } from "zustand";
import {
  DEFAULT_SCENARIO,
  bankFromIfsc,
  IFSC_BANKS,
  initialAccounts,
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

  setScenario: (patch: Partial<BankingScenario>) => void;
  resetData: () => void;
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
  syncAccount: (accountId: string) => Promise<void>;
  uploadStatement: (accountId: string) => void;
}

export const useBankingStore = create<BankingState>((set, get) => ({
  scenario: DEFAULT_SCENARIO,
  contacts: initialContacts(),
  employees: initialEmployees(),
  accounts: initialAccounts(),

  setScenario: (patch) => set((s) => ({ scenario: { ...s.scenario, ...patch } })),
  resetData: () => set({ contacts: initialContacts(), employees: initialEmployees(), accounts: initialAccounts() }),

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
        resolve();
      }, 900);
    }),

  uploadStatement: (accountId) => {
    const today = new Date();
    const date = [today.getDate(), today.getMonth() + 1, today.getFullYear()].map((n) => String(n).padStart(2, "0")).join("-");
    const prev = get().accounts.find((a) => a.id === accountId)?.statement?.balance ?? 75000;
    get().updateAccount(accountId, { statement: { date, balance: Math.round(prev * 1.04 * 100) / 100 } });
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
