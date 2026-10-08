// Dev panel → Banking setup: whole-world presets that put Banking into one stage of a business's journey
// (no bank yet, bank added, statement uploaded, connected…) so every empty and in-between state can be seen.
import { initialAccounts, type CompanyAccount } from "./data";
import {
  initialBankLines,
  initialBookEntries,
  initialImports,
  initialPayouts,
  linkedEntries,
  openBookEntries,
  type BankLine,
  type BookEntry,
  type Payout,
  type StatementImport,
} from "./ledgerData";

export type BankingSetup = "new" | "added" | "statement" | "live" | "review" | "expired" | "mixed";

export const SETUP_OPTIONS: { value: BankingSetup; label: string }[] = [
  { value: "new", label: "New business · no bank" },
  { value: "added", label: "Bank added · no statement" },
  { value: "statement", label: "Bank added · statement uploaded" },
  { value: "live", label: "Connected · all reconciled" },
  { value: "review", label: "Connected · items to review" },
  { value: "expired", label: "Connection expired" },
  { value: "mixed", label: "Several banks (sample data)" },
];

/** Money in / out this month vs last, across all accounts. */
export interface MoneyFlow {
  in: { now: number; prev: number };
  out: { now: number; prev: number };
}

export interface SetupData {
  accounts: CompanyAccount[];
  bankLines: BankLine[];
  bookEntries: BookEntry[];
  payouts: Payout[];
  imports: StatementImport[];
  moneyFlow: MoneyFlow;
}

const SMALL_FLOW: MoneyFlow = { in: { now: 312400, prev: 268000 }, out: { now: 241900, prev: 255300 } };
const MAIN_FLOW: MoneyFlow = { in: { now: 572300, prev: 498100 }, out: { now: 463900, prev: 489700 } };
const ALL_FLOW: MoneyFlow = { in: { now: 842300, prev: 710500 }, out: { now: 695800, prev: 732100 } };

export function setupData(setup: BankingSetup): SetupData {
  const all = initialAccounts();
  const axis = all.find((a) => a.id === "p1")!;
  const only = (id: string) => ({
    bankLines: initialBankLines().filter((l) => l.accountId === id),
    bookEntries: initialBookEntries().filter((e) => e.accountId === id),
    payouts: initialPayouts().filter((p) => p.fromAccountId === id),
    imports: initialImports().filter((i) => i.accountId === id),
  });

  switch (setup) {
    case "new":
      return { accounts: [], bankLines: [], bookEntries: [], payouts: [], imports: [], moneyFlow: SMALL_FLOW };

    case "added":
      return {
        accounts: [{ ...axis, verified: false, connection: "none", approval: "single", syncedMinutesAgo: undefined, booksBalance: 186420 }],
        bankLines: [],
        bookEntries: openBookEntries().filter((e) => e.accountId === "p1"),
        payouts: [],
        imports: [],
        moneyFlow: SMALL_FLOW,
      };

    case "statement": {
      const canara = { ...all.find((a) => a.id === "p5")!, primary: true, verified: true };
      const extra = initialBankLines()
        .filter((l) => ["l03", "l08", "l10"].includes(l.id))
        .map((l) => ({ ...l, id: `${l.id}c`, accountId: "p5", date: l.date.replace("-10-", "-09-") }));
      const d = only("p5");
      return { accounts: [canara], ...d, bankLines: [...d.bankLines, ...extra], bookEntries: [...d.bookEntries, ...linkedEntries(extra)], moneyFlow: SMALL_FLOW };
    }

    case "live": {
      const d = only("p1");
      // Everything the engine suggested has been accepted; nothing is left in the books alone.
      const bankLines = d.bankLines.filter((l) => l.status !== "needs").map((l): BankLine => (l.status === "suggested" ? { ...l, status: "matched" } : l));
      return {
        accounts: [axis],
        ...d,
        bankLines,
        bookEntries: linkedEntries(bankLines),
        payouts: d.payouts.filter((p) => p.status === "paid"),
        moneyFlow: MAIN_FLOW,
      };
    }

    case "review":
      return { accounts: [axis], ...only("p1"), moneyFlow: MAIN_FLOW };

    case "expired":
      return {
        accounts: [{ ...axis, connection: "expired", syncedMinutesAgo: 3 * 24 * 60 }],
        ...only("p1"),
        moneyFlow: MAIN_FLOW,
      };

    case "mixed":
      return {
        accounts: all,
        bankLines: initialBankLines(),
        bookEntries: initialBookEntries(),
        payouts: initialPayouts(),
        imports: initialImports(),
        moneyFlow: ALL_FLOW,
      };
  }
}
