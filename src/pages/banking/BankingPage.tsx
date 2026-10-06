import { useState, type ReactNode } from "react";
import { Tabs } from "../../components/ui/tabs";
import { useBankingStore, usePayFromAccounts } from "../../store/useBankingStore";
import { reconFor } from "./ledgerData";
import { AccountsTab } from "./AccountsTab";
import { BulkTransferDrawer, type BulkPreset } from "./BulkTransferDrawer";
import { ConnectBankDialog } from "./ConnectBankDialog";
import { OverviewTab } from "./OverviewTab";
import { PayoutsTab } from "./PayoutsTab";
import { RegisterBankDialog } from "./RegisterBankDialog";
import { SingleTransferDrawer, type SingleTransferPreset } from "./SingleTransferDrawer";
import { TransactionsTab } from "./TransactionsTab";

export type BankingTab = "overview" | "transactions" | "payouts" | "accounts";

type Flow =
  | { kind: "none" }
  | { kind: "connect" }
  | { kind: "register"; accountId: string }
  | { kind: "single"; preset?: SingleTransferPreset }
  | { kind: "bulk"; preset?: BulkPreset };

/** Banking: Overview (landing) · Transactions (bank vs books, AI recon) · Payouts · Accounts. */
export function BankingPage() {
  const payFrom = usePayFromAccounts();
  const lines = useBankingStore((s) => s.bankLines);
  const entries = useBankingStore((s) => s.bookEntries);
  const payouts = useBankingStore((s) => s.payouts);
  const connected = payFrom.length > 0;
  const bulkAvailable = payFrom.some((a) => a.bulkSupported);

  const [tab, setTab] = useState<BankingTab>("overview");
  const [txnAccount, setTxnAccount] = useState("p1");
  const [flow, setFlow] = useState<Flow>({ kind: "none" });

  const toReview = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"].reduce((s, id) => {
    const r = reconFor(id, lines, entries);
    return s + r.suggested + r.needs;
  }, 0);
  const payoutIssues = payouts.filter((p) => ["failed", "rejected", "returned"].includes(p.status) && !payouts.some((x) => x.retryOf === p.id)).length;

  const TABS: { value: BankingTab; label: ReactNode }[] = [
    { value: "overview", label: "Overview" },
    { value: "transactions", label: <TabLabel text="Transactions" count={toReview} /> },
    { value: "payouts", label: <TabLabel text="Payouts" count={payoutIssues} tone="bad" /> },
    { value: "accounts", label: "Accounts" },
  ];

  const open = (next: Flow) => setFlow(connected ? next : { kind: "connect" });
  const close = () => setFlow({ kind: "none" });
  const single = () => open({ kind: "single" });
  const bulk = () => (bulkAvailable || !connected ? open({ kind: "bulk" }) : open({ kind: "single" }));
  const openTransactions = (accountId: string) => {
    setTxnAccount(accountId);
    setTab("transactions");
  };

  return (
    <div className="-mx-5 -mt-5">
      <Tabs variant="line" items={TABS} value={tab} onChange={setTab} />

      <div className="flex min-w-0 flex-col gap-5 p-5">
        {tab === "overview" && (
          <OverviewTab
            onGo={setTab}
            onOpenAccount={openTransactions}
            onConnect={(accountId) => setFlow({ kind: "register", accountId })}
            onPay={single}
            onBulkPay={bulk}
          />
        )}
        {tab === "transactions" && <TransactionsTab key={txnAccount} accountId={txnAccount} onAccountChange={setTxnAccount} />}
        {tab === "payouts" && (
          <PayoutsTab
            onSingle={single}
            onBulk={bulk}
            onPayBill={() => open({ kind: "single", preset: { beneficiary: { kind: "contact", contactId: "c1", accountId: "a1" }, billIds: ["b1"], amount: "18500" } })}
          />
        )}
        {tab === "accounts" && <AccountsTab onConnect={(accountId) => setFlow({ kind: "register", accountId })} onOpenTransactions={openTransactions} />}
      </div>

      {flow.kind === "connect" && (
        <ConnectBankDialog
          onClose={close}
          onConnectExisting={() => {
            setTab("accounts");
            close();
          }}
        />
      )}
      {flow.kind === "register" && (
        <RegisterBankDialog accountId={flow.accountId} onClose={close} onMakeTransfer={() => setFlow({ kind: "single", preset: { payFromId: flow.accountId } })} />
      )}
      {flow.kind === "single" && (
        <SingleTransferDrawer
          preset={flow.preset}
          onClose={close}
          onSwitchToBulk={(payFromId, carry) =>
            setFlow({
              kind: "bulk",
              preset: { payFromId, rows: carry ? [{ ...carry, id: `r${Date.now()}`, ifscValid: true }] : [] },
            })
          }
        />
      )}
      {flow.kind === "bulk" && <BulkTransferDrawer preset={flow.preset} onClose={close} />}
    </div>
  );
}

function TabLabel({ text, count, tone }: { text: string; count: number; tone?: "bad" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {text}
      {count > 0 && (
        <span
          className={
            tone === "bad"
              ? "rounded-full bg-[var(--color-destructive-soft)] px-1.5 text-[11px] font-semibold text-[var(--color-destructive-accent)]"
              : "rounded-full bg-[var(--color-primary-soft)] px-1.5 text-[11px] font-semibold text-[var(--color-primary-accent)]"
          }
        >
          {count}
        </span>
      )}
    </span>
  );
}
