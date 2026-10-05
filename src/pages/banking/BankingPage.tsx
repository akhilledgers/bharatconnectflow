import { useState } from "react";
import {
  ArrowDown,
  Banknote,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Funnel,
  Landmark,
  List,
  Receipt,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardFooter, CardHeader, CardToolbar } from "../../components/ui/card";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { tableCls, tdCls, thCls, trCls } from "../../components/ui/table";
import { Tabs } from "../../components/ui/tabs";
import { cn } from "../../lib/cn";
import { useBankingStore } from "../../store/useBankingStore";
import { BulkTransferDrawer, type BulkPreset } from "./BulkTransferDrawer";
import { ConnectBankDialog } from "./ConnectBankDialog";
import { SingleTransferDrawer, type SingleTransferPreset } from "./SingleTransferDrawer";
import { AccountsTab } from "./AccountsTab";
import { RegisterBankDialog } from "./RegisterBankDialog";
import { PAY_FROM_BANKS, STATEMENTS, payFromAccounts, type BankKey } from "./data";

type Tab = "statements" | "accounts" | "payouts" | "uploads";
const TABS: { value: Tab; label: string }[] = [
  { value: "statements", label: "Statements" },
  { value: "accounts", label: "Accounts" },
  { value: "payouts", label: "Payouts" },
  { value: "uploads", label: "Upload Logs" },
];

type Flow =
  | { kind: "none" }
  | { kind: "connect" }
  | { kind: "register"; bank: BankKey }
  | { kind: "single"; preset?: SingleTransferPreset } | { kind: "bulk"; preset?: BulkPreset };

const STATS = [
  { label: "Total Transactions", value: "26", className: "" },
  { label: "Reconciled", value: "0", className: "text-green-600" },
  { label: "Partially Reconciled", value: "0", className: "text-amber-600" },
  { label: "Unreconciled", value: "26", className: "text-red-600" },
];

export function BankingPage() {
  const scenario = useBankingStore((s) => s.scenario);
  const accounts = payFromAccounts(scenario);
  const connected = accounts.length > 0;
  const bulkAvailable = accounts.some((a) => a.bulkSupported);

  const [tab, setTab] = useState<Tab>("statements");
  const [menuOpen, setMenuOpen] = useState(false);
  const [flow, setFlow] = useState<Flow>({ kind: "none" });

  const open = (next: Flow) => {
    setMenuOpen(false);
    setFlow(connected ? next : { kind: "connect" });
  };
  const close = () => setFlow({ kind: "none" });

  return (
    <div className="-mx-5 -mt-5">
      <Tabs variant="line" items={TABS} value={tab} onChange={setTab} />

      <div className="flex min-w-0 flex-col gap-5 p-5">
        {tab === "accounts" ? (
          <AccountsTab onConnect={(bank) => setFlow({ kind: "register", bank })} />
        ) : tab !== "statements" ? (
          <Card className="items-center justify-center py-16 text-sm text-muted-foreground">
            {TABS.find((t) => t.value === tab)!.label} isn't part of this prototype yet.
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4">
              {STATS.map((s) => (
                <Card key={s.label} className="gap-1 p-6">
                  <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                  <p className={cn("text-xl font-semibold tracking-tight tabular-nums", s.className)}>{s.value}</p>
                </Card>
              ))}
            </div>

            <Card className="min-w-0">
              <CardHeader className="flex-nowrap py-3">
                <div className="relative w-60 shrink-0">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    placeholder="Search transactions..."
                    className="h-8.5 w-full rounded-md border border-input bg-background ps-9 pe-3 text-2sm shadow-xs shadow-black/5 placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
                  />
                </div>
                <CardToolbar className="flex-wrap justify-end">
                  <Button>
                    <Calendar />
                    <span className="tabular-nums">25-09-2026 - 26-09-2026</span>
                  </Button>
                  <Button size="icon" aria-label="Bank accounts" title="Bank accounts" onClick={() => setTab("accounts")}>
                    <Landmark />
                  </Button>
                  <Button size="icon" aria-label="Adjust">
                    <SlidersHorizontal />
                  </Button>
                  <Button size="icon" aria-label="Filter">
                    <Funnel />
                  </Button>
                  <div className="relative">
                    <Button onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
                      Fund Transfer <ChevronDown />
                    </Button>
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                        <div className={cn(popoverCls, "absolute end-0 top-[calc(100%+4px)] z-41 flex w-56 flex-col gap-0.5 p-1 animate-[fade-in_.15s_ease]")}>
                          <button className={menuItemCls} onClick={() => open({ kind: "single" })}>
                            <Banknote />
                            Single Transfer
                          </button>
                          <button
                            className={cn(menuItemCls, connected && !bulkAvailable && "pointer-events-none opacity-50")}
                            disabled={connected && !bulkAvailable}
                            onClick={() => open({ kind: "bulk" })}
                          >
                            <FileSpreadsheet />
                            Bulk Transfer
                          </button>
                          <div className="-mx-1 my-0.5 h-px bg-border" />
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Prototype Shortcut</div>
                          <button
                            className={menuItemCls}
                            onClick={() =>
                              open({
                                kind: "single",
                                preset: { beneficiary: { kind: "contact", contactId: "c1", accountId: "a1" }, billIds: ["b1"], amount: "18500" },
                              })
                            }
                          >
                            <Receipt />
                            Pay Purchase Bill
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <Button size="icon" aria-label="Columns">
                    <List />
                  </Button>
                </CardToolbar>
              </CardHeader>

              <div className="overflow-x-auto">
                <table className={cn(tableCls, "table-fixed")}>
                  <thead>
                    <tr>
                      <th className={cn(thCls, "w-[22%] bg-muted")}>
                        <button className="-ms-2 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 font-medium text-foreground hover:bg-secondary">
                          Date <ArrowDown className="size-3.5 opacity-60" />
                        </button>
                      </th>
                      <th className={cn(thCls, "bg-muted font-medium text-foreground")}>Transaction Details</th>
                      <th className={cn(thCls, "w-[16%] bg-muted font-medium text-foreground")}>Amount</th>
                      <th className={cn(thCls, "w-[14%] bg-muted font-medium text-foreground")}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STATEMENTS.map((r) => (
                      <tr key={r.id} className={trCls}>
                        <td className={tdCls}>
                          <div className="tabular-nums">{r.date}</div>
                          <span className="block text-xs text-muted-foreground">{r.acct}</span>
                        </td>
                        <td className={tdCls}>
                          <div className="truncate">{r.details}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2sm text-muted-foreground">
                            <a href="#" onClick={(e) => e.preventDefault()} className="text-primary hover:underline">
                              Update Contact
                            </a>
                            -
                            <a href="#" onClick={(e) => e.preventDefault()} className="text-primary hover:underline">
                              Update Document
                            </a>
                            -
                            <a href="#" onClick={(e) => e.preventDefault()} className="text-primary hover:underline">
                              Update Account
                            </a>
                          </div>
                        </td>
                        <td className={cn(tdCls, "tabular-nums text-green-600")}>{r.amount} Cr</td>
                        <td className={cn(tdCls, "tabular-nums")}>
                          <span className="inline-flex items-center gap-1.5">
                            {r.balance}
                            <ArrowDown className="size-3 rotate-45 text-green-600" />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <CardFooter>
                <div className="flex w-full flex-wrap items-center justify-between gap-2.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    Rows per page
                    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-input px-2 text-xs text-foreground">
                      10 <ChevronDown className="size-3.5 opacity-60" />
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>1 - 10 of 26</span>
                    <div className="flex items-center gap-1">
                      <button className={pageBtn} aria-label="Previous">
                        <ChevronLeft className="size-3.5" />
                      </button>
                      {[1, 2, 3].map((n) => (
                        <button key={n} className={cn(pageBtn, n === 1 && "bg-accent text-accent-foreground")} aria-current={n === 1 ? "page" : undefined}>
                          {n}
                        </button>
                      ))}
                      <button className={pageBtn} aria-label="Next">
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </CardFooter>
            </Card>
          </>
        )}
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
        <RegisterBankDialog bank={flow.bank} onClose={close} onMakeTransfer={() => setFlow({ kind: "single", preset: { payFromId: PAY_FROM_BANKS.find((b) => b.key === flow.bank)!.id } })} />
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

const pageBtn =
  "inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground";
