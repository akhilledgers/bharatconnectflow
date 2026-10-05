import { create } from "zustand";
import {
  DEFAULT_SCENARIO,
  bankFromIfsc,
  initialContacts,
  initialEmployees,
  maskAccount,
  type ApprovalMode,
  type BankAccount,
  type BankKey,
  type BankingScenario,
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
interface BankingState {
  scenario: BankingScenario;
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
  registerBank: (bank: BankKey, approval?: ApprovalMode) => Promise<boolean>;
}

export const useBankingStore = create<BankingState>((set, get) => ({
  scenario: DEFAULT_SCENARIO,
  contacts: initialContacts(),
  employees: initialEmployees(),

  setScenario: (patch) => set((s) => ({ scenario: { ...s.scenario, ...patch } })),
  resetData: () => set({ contacts: initialContacts(), employees: initialEmployees() }),

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

  registerBank: (bank, approval) =>
    new Promise((resolve) => {
      setTimeout(() => {
        if (get().scenario.register === "fail") return resolve(false);
        set((s) => ({
          scenario: {
            ...s.scenario,
            connected: { ...s.scenario.connected, [bank]: true },
            approval: approval && bank !== "icici" ? { ...s.scenario.approval, [bank]: approval } : s.scenario.approval,
          },
        }));
        resolve(true);
      }, 1500);
    }),

  setEmployeeAccount: (employeeId, input) => {
    const account = toAccount(input);
    const { id: _id, ...rest } = account;
    set((s) => ({ employees: s.employees.map((e) => (e.id !== employeeId ? e : { ...e, account: rest })) }));
    return account;
  },
}));
