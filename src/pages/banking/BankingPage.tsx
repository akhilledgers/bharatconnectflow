import { useState, type ReactNode } from "react";
import { ChevronDown, FileUp, Plus, Receipt, Send, Users } from "lucide-react";
import { Button } from "../../components/ui/button";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { Tabs } from "../../components/ui/tabs";
import { cn } from "../../lib/cn";
import { useBankingStore, usePayFromAccounts } from "../../store/useBankingStore";
import { reconFor } from "./ledgerData";
import { AccountsTab } from "./AccountsTab";
import { AddBankAccountDrawer } from "./AddBankAccountDrawer";
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
  | { kind: "add" }
  | { kind: "register"; accountId: string }
  | { kind: "single"; preset?: SingleTransferPreset }
  | { kind: "bulk"; preset?: BulkPreset };

/** Banking: Overview (landing) · Transactions (bank vs books, AI recon) · Payouts · Accounts. */
export function BankingPage() {
  const payFrom = usePayFromAccounts();
  const lines = useBankingStore((s) => s.bankLines);
  const entries = useBankingStore((s) => s.bookEntries);
  const payouts = useBankingStore((s) => s.payouts);
  const accounts = useBankingStore((s) => s.accounts).filter((a) => a.active);
  const connected = payFrom.length > 0;
  const bulkAvailable = payFrom.some((a) => a.bulkSupported);

  const [tab, setTab] = useState<BankingTab>("overview");
  const [txnAccountPicked, setTxnAccount] = useState<string | null>(null);
  const [flow, setFlow] = useState<Flow>({ kind: "none" });
  const [moreOpen, setMoreOpen] = useState(false);
  const txnAccount = accounts.find((a) => a.id === txnAccountPicked)?.id ?? (accounts.find((a) => a.primary) ?? accounts[0])?.id;

  const toReview = accounts.reduce((s, a) => {
    const r = reconFor(a.id, lines, entries);
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
  const payBill = () => open({ kind: "single", preset: { beneficiary: { kind: "contact", contactId: "c1", accountId: "a1" }, billIds: ["b1"], amount: "18500" } });
  const MORE = [
    { icon: <Users />, label: "Bulk pay", run: bulk },
    { icon: <Receipt />, label: "Pay a purchase bill", run: payBill },
    { icon: <FileUp />, label: "Upload statement", run: () => setTab("accounts") },
    { icon: <Plus />, label: "Add bank account", run: () => setFlow({ kind: "add" }) },
  ];
  const openTransactions = (accountId: string) => {
    setTxnAccount(accountId);
    setTab("transactions");
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Banking</h1>
        {accounts.length > 0 && (
          <div className="flex gap-2.5">
            <div className="relative">
              <Button onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen}>
                More <ChevronDown />
              </Button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div className={cn(popoverCls, "absolute end-0 top-[calc(100%+4px)] z-50 flex w-52 flex-col gap-0.5 p-1")}>
                    {MORE.map((m) => (
                      <button
                        key={m.label}
                        className={menuItemCls}
                        onClick={() => {
                          setMoreOpen(false);
                          m.run();
                        }}
                      >
                        {m.icon}
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <Button variant="primary" onClick={single}>
              <Send />
              Pay someone
            </Button>
          </div>
        )}
      </div>

      <Tabs variant="line" items={TABS} value={tab} onChange={setTab} className="!px-0" />

      <div className="flex min-w-0 flex-col gap-4 pt-5">
        {tab === "overview" && (
          <OverviewTab
            onGo={setTab}
            onOpenAccount={openTransactions}
            onConnect={(accountId) => setFlow({ kind: "register", accountId })}
            onAddAccount={() => setFlow({ kind: "add" })}
            onOpenNewAccount={() => setFlow({ kind: "connect" })}
          />
        )}
        {tab === "transactions" &&
          (txnAccount ? (
            <TransactionsTab key={txnAccount} accountId={txnAccount} onAccountChange={setTxnAccount} />
          ) : (
            <NoAccounts onAdd={() => setFlow({ kind: "add" })}>Add a bank account to see its transactions next to your books.</NoAccounts>
          ))}
        {tab === "payouts" &&
          (accounts.length ? (
            <PayoutsTab onSingle={single} />
          ) : (
            <NoAccounts onAdd={() => setFlow({ kind: "add" })}>Add and connect an Axis, ICICI or IndusInd account to pay vendors and salaries from LEDGERS.</NoAccounts>
          ))}
        {tab === "accounts" && (
          <AccountsTab onConnect={(accountId) => setFlow({ kind: "register", accountId })} onOpenTransactions={openTransactions} onAdd={() => setFlow({ kind: "add" })} />
        )}
      </div>

      {flow.kind === "connect" && (
        <ConnectBankDialog
          onClose={close}
          onConnectExisting={() => setFlow({ kind: "add" })}
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
      {flow.kind === "add" && <AddBankAccountDrawer onClose={close} onConnect={(accountId) => setFlow({ kind: "register", accountId })} />}
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

function NoAccounts({ onAdd, children }: { onAdd: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-5 py-14 text-center">
      <div className="text-sm text-muted-foreground">{children}</div>
      <Button variant="primary" onClick={onAdd}>
        <Plus />
        Add bank account
      </Button>
    </div>
  );
}
