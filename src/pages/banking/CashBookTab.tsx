import { useState } from "react";
import { ChevronDown, Landmark, Plus, Wallet } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input, Select } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { tableCls, tdCls, thCls } from "../../components/ui/table";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { AccountIcon } from "./BankLogo";
import { CASH_ALL, CASH_PARENT } from "./cash";
import { ALL_ACCOUNTS, accountName, fmtINR } from "./data";
import { StatCard } from "./StatCard";
import { PERIODS, periodRange, type Period } from "./periods";
import { MatchPanel } from "./TransactionsTab";
import { nextRef } from "./ledgerData";

const time = (dmy: string) => {
  const [d, m, y] = dmy.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const shortDate = (dmy: string) => fmtDay(time(dmy));

/**
 * Banking → Transactions for cash: a cash book (opening, money in and out, running balance) for one cash account,
 * or for Cash in hand as a whole. Cash has no bank statement, so there is nothing to match or sync here.
 */
export function CashBookTab({ accountId, onAccountChange }: { accountId: string; onAccountChange: (id: string) => void }) {
  const cashAccounts = useBankingStore((s) => s.cashAccounts).filter((a) => a.active);
  const banks = useBankingStore((s) => s.accounts).filter((a) => a.active);
  const allEntries = useBankingStore((s) => s.cashEntries);
  const parties = useBankingStore((s) => s.parties);
  const bookEntries = useBankingStore((s) => s.bookEntries);
  const [adding, setAdding] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("last-3");
  const [custom, setCustom] = useState({ from: "", to: "" });

  const all = accountId === CASH_ALL;
  const account = all ? undefined : cashAccounts.find((a) => a.id === accountId);
  const scope = account ? [account] : cashAccounts;
  const ids = new Set(scope.map((a) => a.id));
  const nameOf = (id: string) => cashAccounts.find((a) => a.id === id)?.name ?? "";

  // Moving cash between two of these accounts is not money in or out of Cash in hand as a whole.
  const entries = allEntries.filter((e) => ids.has(e.accountId)).filter((e) => !(all && e.kind === "Transfer" && cashAccounts.some((a) => a.name === e.party)));

  // The period: opening = the books' opening balance plus everything before it; closing = opening + the period's entries.
  const [from, to] = periodRange(period, custom);
  const start = from.getTime();
  const end = to.getTime();
  const booksOpening = scope.reduce((s, a) => s + a.opening.amount, 0);
  const booksOpeningDate = scope[0]?.opening.date ?? "01-04-2026";
  const opening = booksOpening + entries.filter((e) => time(e.date) < start).reduce((s, e) => s + e.amount, 0);
  const inPeriod = entries.filter((e) => time(e.date) >= start && time(e.date) <= end);
  const moneyIn = inPeriod.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const moneyOut = inPeriod.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0);
  const closing = opening + moneyIn - moneyOut;
  // The period can't open before the books do.
  const openingOn = Math.max(start, time(booksOpeningDate));
  const isToday = end >= new Date(new Date().toDateString()).getTime();

  // Running balance oldest first, shown newest first.
  const rows = [...inPeriod]
    .sort((a, b) => time(a.date) - time(b.date) || a.id.localeCompare(b.id, undefined, { numeric: true }))
    .reduce<{ e: (typeof entries)[number]; balance: number }[]>((acc, e) => [...acc, { e, balance: (acc.at(-1)?.balance ?? opening) + e.amount }], [])
    .reverse();

  const pick = (id: string) => {
    setSwitcherOpen(false);
    onAccountChange(id);
  };
  const bankName = accountName;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => setSwitcherOpen(!switcherOpen)}
            className="flex h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 text-left shadow-xs shadow-black/5 hover:bg-accent"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-success-soft)] text-[var(--color-success-accent)] [&_svg]:size-4">
              <Wallet />
            </span>
            <div>
              <div className="text-2sm font-semibold">{account ? account.name : CASH_PARENT}</div>
              <div className="text-xs text-muted-foreground">{account ? `${CASH_PARENT}${account.branch ? ` · ${account.branch}` : ""}` : `${cashAccounts.length} cash accounts`}</div>
            </div>
            <ChevronDown className="size-4 opacity-60" />
          </button>
          {switcherOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
              <div className={cn(popoverCls, "absolute start-0 top-[calc(100%+4px)] z-50 flex w-80 flex-col gap-0.5 p-1")}>
                {banks.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Bank</div>
                    <button className={menuItemCls} onClick={() => pick(ALL_ACCOUNTS)}>
                      <Landmark />
                      All bank accounts
                    </button>
                    {banks.map((b) => (
                      <button key={b.id} className={menuItemCls} onClick={() => pick(b.id)}>
                        <AccountIcon account={b} size={16} />
                        <span className="truncate">
                          {bankName(b)}
                          {b.nickname && <span className="text-muted-foreground"> · {b.nickname}</span>}
                        </span>
                      </button>
                    ))}
                  </>
                )}
                <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Cash</div>
                <button className={cn(menuItemCls, all && "bg-accent")} onClick={() => pick(CASH_ALL)}>
                  <Wallet />
                  {CASH_PARENT}
                </button>
                {cashAccounts.map((a) => (
                  <button key={a.id} className={cn(menuItemCls, "ps-8", account?.id === a.id && "bg-accent")} onClick={() => pick(a.id)}>
                    <span className="truncate">{a.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <Select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value as Period)} wrapperClassName="w-48">
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        {period === "custom" && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Input type="date" aria-label="From" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="w-36" />
            to
            <Input type="date" aria-label="To" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="w-36" />
          </div>
        )}
        <Button className="ms-auto" onClick={() => setAdding(true)} disabled={cashAccounts.length === 0}>
          <Plus />
          Add entry
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Opening balance" value={fmtINR(opening)} tone="muted" sub={`As on ${fmtDay(openingOn)}`} />
        <StatCard label="Cash in" value={fmtINR(moneyIn)} tone="good" sub="Receipts and transfers in" />
        <StatCard label="Cash out" value={fmtINR(moneyOut)} tone="bad" sub="Payments, expenses and transfers out" />
        <StatCard
          label={isToday ? "Balance" : "Closing balance"}
          value={fmtINR(closing)}
          tone={closing < 0 ? "bad" : "primary"}
          sub={closing < 0 ? "Below zero: an entry is missing or wrong" : isToday ? "In your books today" : `As on ${fmtDay(end)}`}
        />
      </div>

      <Card className="min-w-0">
        <div className="overflow-x-auto">
          <table className={cn(tableCls, "table-fixed")}>
            <thead>
              <tr>
                <th className={cn(thCls, "w-32 bg-muted font-medium text-foreground")}>Date</th>
                <th className={cn(thCls, "w-32 bg-muted font-medium text-foreground")}>Voucher</th>
                <th className={cn(thCls, "bg-muted font-medium text-foreground")}>Particulars</th>
                {all && <th className={cn(thCls, "w-44 bg-muted font-medium text-foreground")}>Cash account</th>}
                <th className={cn(thCls, "w-32 bg-muted text-right font-medium text-foreground")}>In</th>
                <th className={cn(thCls, "w-32 bg-muted text-right font-medium text-foreground")}>Out</th>
                <th className={cn(thCls, "w-36 bg-muted text-right font-medium text-foreground")}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, balance }) => (
                <tr key={e.id} className="border-t border-border">
                  <td className={cn(tdCls, "whitespace-nowrap text-muted-foreground")}>{shortDate(e.date)}</td>
                  <td className={tdCls}>{e.ref}</td>
                  <td className={tdCls}>
                    <div className="truncate text-foreground">{e.party}</div>
                    <div className="text-xs text-muted-foreground">{e.kind === "Transfer" ? (e.amount > 0 ? "Transfer in" : "Transfer out") : e.kind}</div>
                  </td>
                  {all && <td className={cn(tdCls, "truncate text-muted-foreground")}>{nameOf(e.accountId)}</td>}
                  <td className={cn(tdCls, "text-right tabular-nums text-[var(--color-success-accent)]")}>{e.amount > 0 ? fmtINR(e.amount) : ""}</td>
                  <td className={cn(tdCls, "text-right tabular-nums")}>{e.amount < 0 ? fmtINR(-e.amount) : ""}</td>
                  <td className={cn(tdCls, "text-right font-medium tabular-nums", balance < 0 && "text-destructive")}>{fmtINR(balance)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr className="border-t border-border">
                  <td colSpan={all ? 7 : 6} className={cn(tdCls, "py-8 text-center text-muted-foreground")}>
                    No cash entries in this period.
                  </td>
                </tr>
              )}
              <tr className="border-t border-border bg-muted/40">
                <td className={cn(tdCls, "whitespace-nowrap text-muted-foreground")}>{fmtDay(openingOn)}</td>
                <td className={tdCls} />
                <td className={cn(tdCls, "text-muted-foreground")} colSpan={all ? 4 : 3}>
                  Opening balance
                </td>
                <td className={cn(tdCls, "text-right font-medium tabular-nums")}>{fmtINR(opening)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* The same panel as matching a bank line, with In / Out, amount and date in place of the line. */}
      {adding && (
        <MatchPanel
          line={{ id: "new", accountId: account?.id ?? (cashAccounts.find((a) => a.isDefault) ?? cashAccounts[0]).id, date: "", narration: "", amount: 0, status: "needs" }}
          accountLabel={account?.name ?? ""}
          parties={parties}
          openEntries={[]}
          nextRef={{ receipt: nextRef([...bookEntries, ...allEntries], "REC"), payment: nextRef([...bookEntries, ...allEntries], "VOU") }}
          draft={{
            accounts: account ? [] : cashAccounts.map((a) => ({ id: a.id, label: a.name })),
            onAdd: (id, date, amount, match, opts) => {
              useBankingStore.getState().addEntry(id, date, amount, match, opts);
              setAdding(false);
              useStore.getState().pushToast(`Entry added to ${nameOf(id)}`, "success");
            },
          }}
          onClose={() => setAdding(false)}
          onAccept={() => {}}
          onReject={() => {}}
          onDone={() => {}}
        />
      )}
    </div>
  );
}
