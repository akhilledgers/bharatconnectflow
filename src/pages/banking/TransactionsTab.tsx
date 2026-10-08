import { useState, type ReactNode } from "react";
import { BookOpen, Check, ChevronDown, Landmark, Layers, Plug, RefreshCw, Search, Sparkles, Undo2, Upload, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input, Select } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { tableCls, tdCls, thCls, trCls } from "../../components/ui/table";
import { Tabs } from "../../components/ui/tabs";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { BankIcon } from "./BankLogo";
import { ALL_ACCOUNTS, CONNECTED_BANKING, fmtINR, last4, syncedLabel, type CompanyAccount } from "./data";
import { LEDGERS, PARTIES, reconFor, type BankLine, type BookEntry, type Match, type MatchKind } from "./ledgerData";
import { RECONCILED_TO, bankBalanceOf, shortDate } from "./overviewData";
import { OVERLAY } from "./shared";
import { FilterChips } from "./FilterChips";
import { StatCard } from "./StatCard";
import { pickStatementFile } from "./statementUpload";
import { useEscape } from "./useEscape";

/** Which side of the reconciliation is listed. */
type Side = "bank" | "books";
/** Bank side: Suggested by AI · Unmatched · Matched. Books side: Suggested by AI · Not in bank · Matched. */
type Filter = "all" | "confirm" | "unmatched" | "notinbank" | "matched";
type Period = "this-month" | "last-month" | "last-3" | "fy" | "custom";

const PERIODS: { value: Period; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-3", label: "Last 3 months" },
  { value: "fy", label: "This financial year" },
  { value: "custom", label: "Custom range" },
];

const toast = (m: string, tone: "success" | "error" = "success") => useStore.getState().pushToast(m, tone);
const accountName = (a: CompanyAccount) => `${a.bankKey ? CONNECTED_BANKING[a.bankKey].short : a.bank} ${last4(a.number)}`;
const toDate = (dmy: string) => {
  const [d, m, y] = dmy.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fmtDay = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** [from, to] for a period, as dates (inclusive). */
function periodRange(p: Period, custom: { from: string; to: string }): [Date, Date] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = new Date(y, m, now.getDate());
  switch (p) {
    case "this-month":
      return [new Date(y, m, 1), today];
    case "last-month":
      return [new Date(y, m - 1, 1), new Date(y, m, 0)];
    case "last-3":
      return [new Date(y, m - 2, 1), today];
    case "fy":
      return [new Date(m >= 3 ? y : y - 1, 3, 1), today];
    case "custom":
      return [custom.from ? new Date(custom.from) : new Date(2000, 0, 1), custom.to ? new Date(custom.to) : today];
  }
}

const lineStatus = (l: BankLine): Exclude<Filter, "all" | "notinbank"> => (l.status === "suggested" ? "confirm" : l.status === "needs" ? "unmatched" : "matched");

export function Amount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", value > 0 ? "text-[var(--color-success-accent)]" : "text-foreground", className)}>
      {value > 0 ? "+" : "−"}
      {fmtINR(Math.abs(value))}
    </span>
  );
}

function MatchText({ m }: { m: Match }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-2sm">
        <span className="font-medium">{m.kind}</span>
        {m.ref && <span className="text-muted-foreground"> · {m.ref}</span>}
        <span className="text-muted-foreground"> · {m.party}</span>
        {m.ledger && <span className="text-muted-foreground"> · {m.ledger}</span>}
      </div>
      {m.reason && <div className="truncate text-xs text-muted-foreground">{m.reason}</div>}
    </div>
  );
}

function Confidence({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        value >= 90 ? "bg-[var(--color-success-soft)] text-[var(--color-success-accent)]" : "bg-[var(--color-primary-soft)] text-[var(--color-primary-accent)]",
      )}
    >
      {value}%
    </span>
  );
}

/**
 * Bank statement and books, side by side in two views, reconciled by the AI engine. Works for one account
 * (with a running balance, like a passbook) or all accounts at once (as a work queue and search).
 */
export function TransactionsTab({
  accountId,
  onAccountChange,
  onConnect,
}: {
  accountId: string;
  onAccountChange: (id: string) => void;
  onConnect: (accountId: string) => void;
}) {
  const accounts = useBankingStore((s) => s.accounts).filter((a) => a.active);
  const lines = useBankingStore((s) => s.bankLines);
  const entries = useBankingStore((s) => s.bookEntries);
  const mode = useBankingStore((s) => s.scenario.balance);
  const store = useBankingStore.getState;

  const all = accountId === ALL_ACCOUNTS;
  const account = all ? null : (accounts.find((a) => a.id === accountId) ?? accounts[0]);
  const scope = account ? [account] : accounts;
  const inScope = new Set(scope.map((a) => a.id));
  const rows = scope.map((a) => ({ a, bank: bankBalanceOf(a, mode), recon: reconFor(a.id, lines, entries) }));
  const bank = account ? rows[0].bank : null;
  const recon = account ? rows[0].recon : null;

  const firstOpen = rows.some((r) => r.recon.suggested) ? "confirm" : rows.some((r) => r.recon.needs) ? "unmatched" : "all";
  const [side, setSide] = useState<Side>("bank");
  const [filter, setFilter] = useState<Filter>(firstOpen);
  const [period, setPeriod] = useState<Period>("last-3");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [resolving, setResolving] = useState<BankLine | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [moveMenu, setMoveMenu] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [from, to] = periodRange(period, custom);
  const inPeriod = (dmy: string) => {
    const d = toDate(dmy);
    return d >= from && d <= to;
  };
  const q = query.trim().toLowerCase();
  const matchesQuery = (text: string, amount: number) => !q || text.toLowerCase().includes(q) || String(Math.abs(amount)).includes(q);
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const byId = new Map(accounts.map((a) => [a.id, a]));

  // ---- Bank statement side ----
  const accountLines = lines.filter((l) => inScope.has(l.accountId)).sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime());
  // Running balance, newest first, back from today's balance (one account only).
  const balanceAfter = new Map<string, number>();
  if (account && bank) {
    let bal = bank.amount;
    for (const l of accountLines) {
      balanceAfter.set(l.id, bal);
      bal = Math.round((bal - l.amount) * 100) / 100;
    }
  }
  const periodLines = accountLines.filter((l) => inPeriod(l.date) && matchesQuery(l.narration + (l.match?.party ?? "") + (l.match?.ref ?? ""), l.amount));
  const bankCounts = { confirm: 0, unmatched: 0, matched: 0, notinbank: 0, all: periodLines.length };
  for (const l of periodLines) bankCounts[lineStatus(l)]++;

  // ---- Books side ----
  const entryStatus = (e: BookEntry): Filter => {
    const l = e.lineId ? lineById.get(e.lineId) : undefined;
    return !l ? "notinbank" : l.status === "suggested" ? "confirm" : "matched";
  };
  const periodEntries = entries
    .filter((e) => inScope.has(e.accountId) && inPeriod(e.date) && matchesQuery(e.ref + e.party, e.amount))
    .sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime());
  const bookCounts = { confirm: 0, unmatched: 0, matched: 0, notinbank: 0, all: periodEntries.length };
  for (const e of periodEntries) bookCounts[entryStatus(e) as "confirm" | "notinbank" | "matched"]++;

  const bankRows = filter === "all" ? periodLines : periodLines.filter((l) => lineStatus(l) === filter);
  const bookRows = filter === "all" ? periodEntries : periodEntries.filter((e) => entryStatus(e) === filter);
  const FILTERS: { value: Filter; label: string }[] =
    side === "bank"
      ? [
          { value: "all", label: "All" },
          { value: "confirm", label: "Suggested by AI" },
          { value: "unmatched", label: "Unmatched" },
          { value: "matched", label: "Matched" },
        ]
      : [
          { value: "all", label: "All" },
          { value: "confirm", label: "Suggested by AI" },
          { value: "notinbank", label: "Not in bank" },
          { value: "matched", label: "Matched" },
        ];
  const counts = side === "bank" ? bankCounts : bookCounts;

  // Ids of the bank lines (suggested by AI) shown right now: what "Accept all" accepts.
  const confirmIds =
    filter !== "confirm" ? [] : side === "bank" ? bankRows.map((l) => l.id) : [...new Set(bookRows.map((e) => e.lineId!).filter(Boolean))];
  const allSelected = confirmIds.length > 0 && confirmIds.every((id) => selected.includes(id));

  const accept = (ids: string[]) => {
    store().acceptMatches(ids);
    setSelected((s) => s.filter((id) => !ids.includes(id)));
    toast(ids.length === 1 ? "Match accepted" : `${ids.length} matches accepted`);
  };
  const reject = (lineId: string, undo = false) => {
    store().rejectMatch(lineId);
    toast(undo ? "Match undone · moved to Unmatched" : "Moved to Unmatched · its book entries are now Not in bank");
  };
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const chooseAccount = (id: string) => {
    onAccountChange(id);
    setSwitcherOpen(false);
    setSelected([]);
    const rs = id === ALL_ACCOUNTS ? accounts.map((a) => reconFor(a.id, lines, entries)) : [reconFor(id, lines, entries)];
    setFilter(rs.some((r) => r.suggested) ? "confirm" : rs.some((r) => r.needs) ? "unmatched" : "all");
  };

  const sync = async (ids: string[]) => {
    setSyncing(true);
    const found = (await Promise.all(ids.map((id) => store().syncAccount(id)))).reduce((s, n) => s + n, 0);
    setSyncing(false);
    toast(found ? `${found} new transaction${found > 1 ? "s" : ""} · suggested by AI, ready to accept` : "Up to date · no new transactions");
  };
  const upload = (a: CompanyAccount) => {
    setUploadOpen(false);
    pickStatementFile((name) => {
      store().uploadStatement(a.id, name);
      toast(`Importing ${name} for ${accountName(a)}. New transactions show up here once it's read.`);
    });
  };
  const connected = scope.filter((a) => a.bankKey && a.connection === "connected");

  // ---- stat cards ----
  const openCount = (r: (typeof rows)[number]) => r.recon.suggested + r.recon.needs + r.recon.booksOnly.length;
  const toReview = rows.reduce((s, r) => s + openCount(r), 0);
  const reviewSub = [
    rows.reduce((s, r) => s + r.recon.suggested, 0) && `${rows.reduce((s, r) => s + r.recon.suggested, 0)} suggested`,
    rows.reduce((s, r) => s + r.recon.needs, 0) && `${rows.reduce((s, r) => s + r.recon.needs, 0)} unmatched`,
    rows.reduce((s, r) => s + r.recon.booksOnly.length, 0) && `${rows.reduce((s, r) => s + r.recon.booksOnly.length, 0)} not in bank`,
  ]
    .filter(Boolean)
    .join(" · ");
  const booksOf = (r: (typeof rows)[number]) => (r.bank ? r.bank.amount - r.recon.difference : (r.a.booksBalance ?? -r.recon.difference));
  const withBank = rows.filter((r) => r.bank);
  const differing = withBank.filter((r) => !r.recon.reconciled && r.recon.difference !== 0);

  // Opening / closing balance for the period (one account).
  const periodBalances =
    account && bank && periodLines.length && !q
      ? { closing: balanceAfter.get(periodLines[0].id)!, opening: balanceAfter.get(periodLines.at(-1)!.id)! - periodLines.at(-1)!.amount }
      : null;

  const isStatementView = side === "bank";
  const showBalance = !!account && !!bank;
  const bankCols = 6 + (filter === "confirm" ? 1 : 0) + (all ? 1 : 0) + (showBalance ? 1 : 0);
  const bookCols = 6 + (filter === "confirm" ? 1 : 0) + (all ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Account · period · sync · upload */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => setSwitcherOpen(!switcherOpen)}
            className="flex h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 text-left shadow-xs shadow-black/5 hover:bg-accent"
          >
            <AccountMark account={account} />
            <div>
              <div className="text-2sm font-semibold">{account ? accountName(account) : "All accounts"}</div>
              <div className="text-xs text-muted-foreground">{account ? account.nickname || account.bank : `${accounts.length} bank accounts`}</div>
            </div>
            <ChevronDown className="size-4 opacity-60" />
          </button>
          {switcherOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
              <div className={cn(popoverCls, "absolute start-0 top-[calc(100%+4px)] z-50 flex w-80 flex-col gap-0.5 p-1")}>
                {[null, ...accounts].map((a) => {
                  const open = a ? openCount({ a, bank: null, recon: reconFor(a.id, lines, entries) }) : accounts.reduce((s, x) => s + openCount({ a: x, bank: null, recon: reconFor(x.id, lines, entries) }), 0);
                  const id = a?.id ?? ALL_ACCOUNTS;
                  return (
                    <button key={id} className={cn(menuItemCls, "justify-between", (a ? account?.id === a.id : all) && "bg-accent")} onClick={() => chooseAccount(id)}>
                      <span className="truncate">
                        {a ? accountName(a) : "All accounts"}
                        {a?.nickname && <span className="text-muted-foreground"> · {a.nickname}</span>}
                      </span>
                      {open > 0 && <span className="shrink-0 text-xs text-muted-foreground">{open} to review</span>}
                    </button>
                  );
                })}
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

        <div className="ms-auto flex flex-wrap items-center gap-2.5">
          {account ? (
            account.bankKey && account.connection === "connected" ? (
              <>
                <span className="text-xs text-muted-foreground">Synced {account.syncedMinutesAgo ? syncedLabel(account.syncedMinutesAgo) : "just now"}</span>
                <Button onClick={() => sync([account.id])} disabled={syncing}>
                  <RefreshCw className={cn(syncing && "animate-spin")} />
                  {syncing ? "Syncing…" : "Sync now"}
                </Button>
              </>
            ) : account.bankKey && account.connection === "expired" ? (
              <>
                <Badge variant="warning">Connection expired</Badge>
                <Button onClick={() => onConnect(account.id)}>
                  <RefreshCw />
                  Reconnect
                </Button>
              </>
            ) : account.bankKey ? (
              <Button onClick={() => onConnect(account.id)}>
                <Plug />
                Connect
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">{account.statement ? `Statement up to ${shortDate(account.statement.date)}` : "No statement yet"}</span>
            )
          ) : (
            connected.length > 0 && (
              <Button onClick={() => sync(connected.map((a) => a.id))} disabled={syncing}>
                <RefreshCw className={cn(syncing && "animate-spin")} />
                {syncing ? "Syncing…" : `Sync all (${connected.length})`}
              </Button>
            )
          )}
          <div className="relative">
            <Button variant={account && !account.bankKey ? "primary" : "outline"} onClick={() => (account ? upload(account) : setUploadOpen(!uploadOpen))}>
              <Upload />
              Upload statement
              {!account && <ChevronDown />}
            </Button>
            {uploadOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUploadOpen(false)} />
                <div className={cn(popoverCls, "absolute end-0 top-[calc(100%+4px)] z-50 flex w-72 flex-col gap-0.5 p-1")}>
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Which account is this statement for?</div>
                  {accounts.map((a) => (
                    <button key={a.id} className={menuItemCls} onClick={() => upload(a)}>
                      <span className="truncate">
                        {accountName(a)}
                        {a.nickname && <span className="text-muted-foreground"> · {a.nickname}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bank vs books */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {account ? (
          <>
            <StatCard
              label="In bank"
              value={bank ? fmtINR(bank.amount) : "—"}
              tone={!bank ? "muted" : bank.source === "stale" ? "warn" : "primary"}
              sub={
                !bank
                  ? account.bankKey
                    ? "Connect the account to see it"
                    : "Upload a statement to see it"
                  : bank.source === "live"
                    ? `Live · synced ${account.syncedMinutesAgo ? syncedLabel(account.syncedMinutesAgo) : "just now"}`
                    : bank.source === "stale"
                      ? `Last known · expired ${syncedLabel(account.syncedMinutesAgo ?? 0)}`
                      : `As per statement · ${shortDate(account.statement!.date)}`
              }
            />
            <StatCard label="In your books" value={fmtINR(booksOf(rows[0]))} tone="purple" sub="Bank Book · as of today" />
            {!bank ? (
              <StatCard label="Difference" value="Can't compare yet" tone="muted" sub="Needs bank data" />
            ) : recon!.reconciled ? (
              <StatCard label="Difference" value="Reconciled" tone="good" sub="Books match the bank" />
            ) : (
              <StatCard
                label="Difference"
                value={fmtINR(Math.abs(recon!.difference))}
                tone="warn"
                sub={RECONCILED_TO[account.id] ? `Last fully reconciled on ${shortDate(RECONCILED_TO[account.id])}` : "Not reconciled yet"}
              />
            )}
          </>
        ) : (
          <>
            <StatCard
              label="In bank"
              value={withBank.length ? fmtINR(withBank.reduce((s, r) => s + r.bank!.amount, 0)) : "—"}
              tone={withBank.length ? "primary" : "muted"}
              sub={`Across ${withBank.length} of ${rows.length} accounts`}
            />
            <StatCard label="In your books" value={fmtINR(rows.reduce((s, r) => s + booksOf(r), 0))} tone="purple" sub="Bank Book · all accounts" />
            <StatCard
              label="Accounts reconciled"
              value={`${withBank.length - differing.length} of ${withBank.length}`}
              tone={differing.length ? "warn" : "good"}
              sub={differing.length ? `${differing.length} differ by ${fmtINR(differing.reduce((s, r) => s + Math.abs(r.recon.difference), 0))} in total` : "Books match the bank"}
            />
          </>
        )}
        <StatCard
          label="To review"
          value={account && !bank ? "—" : toReview ? `${toReview} item${toReview === 1 ? "" : "s"}` : "None"}
          tone={toReview && (bank || all) ? "warn" : "muted"}
          sub={account && !bank ? "Matching starts once bank data is in" : toReview ? reviewSub : "Nothing left to match"}
        />
      </div>

      <Card className="min-w-0">
        <Tabs
          variant="line"
          value={side}
          onChange={(v) => {
            setSide(v);
            setSelected([]);
            if (filter === "unmatched" || filter === "notinbank") setFilter("all");
          }}
          items={[
            { value: "bank", label: <SideLabel icon={<Landmark />} text="Bank statement" count={bankCounts.all} /> },
            { value: "books", label: <SideLabel icon={<BookOpen />} text="Your books" count={bookCounts.all} /> },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <FilterChips
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setSelected([]);
            }}
            items={FILTERS.map((f) => ({ ...f, count: counts[f.value], icon: f.value === "confirm" ? <Sparkles /> : undefined }))}
          />
          <div className="relative w-60">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="txn-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isStatementView ? "Search narration, party, amount" : "Search voucher, party, amount"}
              className="ps-9"
            />
          </div>
        </div>

        {filter === "confirm" && confirmIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[var(--color-primary-soft)]/60 px-5 py-2.5 text-xs">
            <span className="text-[var(--color-primary-accent)]">
              The AI paired these bank transactions with entries in your books, from amounts, references and past behaviour. Check and accept.
            </span>
            <div className="flex gap-2">
              {selected.length > 0 && (
                <Button size="sm" onClick={() => accept(selected)}>
                  <Check />
                  Accept selected ({selected.length})
                </Button>
              )}
              <Button size="sm" variant="primary" onClick={() => accept(confirmIds)}>
                <Check />
                Accept all {confirmIds.length}
              </Button>
            </div>
          </div>
        )}

        {isStatementView && periodBalances && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border px-5 py-2.5 text-xs text-muted-foreground">
            <span>
              {fmtDay(from)} – {fmtDay(to)}
            </span>
            <span>
              Opening balance <span className="font-medium text-foreground tabular-nums">{fmtINR(periodBalances.opening)}</span>
            </span>
            <span>
              Closing balance <span className="font-medium text-foreground tabular-nums">{fmtINR(periodBalances.closing)}</span>
            </span>
          </div>
        )}

        <div className="overflow-x-auto">
          {isStatementView ? (
            <table className={cn(tableCls, "table-fixed")}>
              <thead>
                <tr>
                  {filter === "confirm" && (
                    <th className={cn(thCls, "w-10 pe-0")}>
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? [] : confirmIds)}
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </th>
                  )}
                  <th className={cn(thCls, "w-28")}>Date</th>
                  {all && <th className={cn(thCls, "w-32")}>Account</th>}
                  <th className={thCls}>Narration</th>
                  <th className={cn(thCls, "w-28 text-right")}>Withdrawal</th>
                  <th className={cn(thCls, "w-28 text-right")}>Deposit</th>
                  {showBalance && <th className={cn(thCls, "w-36 text-right")}>Balance</th>}
                  <th className={cn(thCls, "w-[24%]")}>In your books</th>
                  <th className={cn(thCls, "w-36")} />
                </tr>
              </thead>
              <tbody>
                {bankRows.map((l) => {
                  const st = lineStatus(l);
                  return (
                    <tr key={l.id} className={trCls}>
                      {filter === "confirm" && (
                        <td className={cn(tdCls, "pe-0")}>
                          <input
                            type="checkbox"
                            aria-label="Select"
                            checked={selected.includes(l.id)}
                            onChange={() => toggle(l.id)}
                            className="size-4 cursor-pointer accent-primary"
                          />
                        </td>
                      )}
                      <td className={cn(tdCls, "tabular-nums text-muted-foreground")}>{l.date}</td>
                      {all && <td className={cn(tdCls, "truncate text-muted-foreground")}>{accountName(byId.get(l.accountId)!)}</td>}
                      <td className={tdCls}>
                        <div className="line-clamp-2 text-2sm [overflow-wrap:anywhere]" title={l.narration}>
                          {l.narration}
                        </div>
                      </td>
                      <td className={cn(tdCls, "text-right tabular-nums")}>{l.amount < 0 ? fmtINR(-l.amount) : ""}</td>
                      <td className={cn(tdCls, "text-right tabular-nums text-[var(--color-success-accent)]")}>{l.amount > 0 ? fmtINR(l.amount) : ""}</td>
                      {showBalance && <td className={cn(tdCls, "text-right tabular-nums text-muted-foreground")}>{fmtINR(balanceAfter.get(l.id) ?? 0)}</td>}
                      <td className={tdCls}>
                        {st === "unmatched" ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="warning">Unmatched</Badge>
                            <span className="truncate text-xs text-muted-foreground">Nothing in your books yet</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            {st === "confirm" && l.match!.confidence ? (
                              <Confidence value={l.match!.confidence} />
                            ) : (
                              <Badge variant="success">{l.status === "auto" ? "AI" : "You"}</Badge>
                            )}
                            <MatchText m={l.match!} />
                          </div>
                        )}
                      </td>
                      <td className={cn(tdCls, "text-right")}>
                        <LineActions line={l} onAccept={() => accept([l.id])} onReject={(undo) => reject(l.id, undo)} onFind={() => setResolving(l)} />
                      </td>
                    </tr>
                  );
                })}
                {bankRows.length === 0 && (
                  <Empty colSpan={bankCols}>
                    {account && !bank && !q
                      ? account.bankKey
                        ? "No bank transactions yet. Connect the account to bring them in."
                        : "No bank transactions yet. Upload a statement to bring them in."
                      : filter === "confirm"
                        ? "No suggestions waiting. New bank transactions are matched as they arrive."
                        : filter === "unmatched"
                          ? "Every bank transaction in this period is in your books."
                          : "No bank transactions in this period."}
                  </Empty>
                )}
              </tbody>
            </table>
          ) : (
            <table className={cn(tableCls, "table-fixed")}>
              <thead>
                <tr>
                  {filter === "confirm" && (
                    <th className={cn(thCls, "w-10 pe-0")}>
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? [] : confirmIds)}
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </th>
                  )}
                  <th className={cn(thCls, "w-28")}>Date</th>
                  {all && <th className={cn(thCls, "w-32")}>Account</th>}
                  <th className={thCls}>Entry</th>
                  <th className={cn(thCls, "w-32 text-right")}>Received</th>
                  <th className={cn(thCls, "w-32 text-right")}>Paid</th>
                  <th className={cn(thCls, "w-[28%]")}>In the bank</th>
                  <th className={cn(thCls, "w-40")} />
                </tr>
              </thead>
              <tbody>
                {bookRows.map((e) => {
                  const st = entryStatus(e);
                  const l = e.lineId ? lineById.get(e.lineId) : undefined;
                  return (
                    <tr key={e.id} className={trCls}>
                      {filter === "confirm" && (
                        <td className={cn(tdCls, "pe-0")}>
                          <input
                            type="checkbox"
                            aria-label="Select"
                            checked={selected.includes(e.lineId!)}
                            onChange={() => toggle(e.lineId!)}
                            className="size-4 cursor-pointer accent-primary"
                          />
                        </td>
                      )}
                      <td className={cn(tdCls, "tabular-nums text-muted-foreground")}>{e.date}</td>
                      {all && <td className={cn(tdCls, "truncate text-muted-foreground")}>{accountName(byId.get(e.accountId)!)}</td>}
                      <td className={tdCls}>
                        <div className="truncate font-medium">{e.ref}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {e.kind} · {e.party}
                        </div>
                      </td>
                      <td className={cn(tdCls, "text-right tabular-nums text-[var(--color-success-accent)]")}>{e.amount > 0 ? fmtINR(e.amount) : ""}</td>
                      <td className={cn(tdCls, "text-right tabular-nums")}>{e.amount < 0 ? fmtINR(-e.amount) : ""}</td>
                      <td className={tdCls}>
                        {st === "notinbank" ? (
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="warning">Not in bank</Badge>
                              {e.assumedAccount && <Badge variant="secondary">Account assumed</Badge>}
                            </div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {e.note}
                              {e.daysOpen !== undefined && ` · open ${e.daysOpen} days`}
                            </div>
                          </div>
                        ) : (
                          <div className="flex min-w-0 items-center gap-2.5">
                            {st === "confirm" && l?.match?.confidence ? <Confidence value={l.match.confidence} /> : <Badge variant="success">Matched</Badge>}
                            <div className="min-w-0">
                              <div className="truncate text-2sm" title={l?.narration}>
                                {l?.narration}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {l?.date}
                                {l && Math.abs(l.amount) !== Math.abs(e.amount) && ` · part of ${fmtINR(Math.abs(l.amount))}`}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className={cn(tdCls, "text-right")}>
                        {l ? (
                          <LineActions line={l} onAccept={() => accept([l.id])} onReject={(undo) => reject(l.id, undo)} onFind={() => setResolving(l)} />
                        ) : e.assumedAccount ? (
                          <div className="relative inline-block">
                            <Button size="sm" onClick={() => setMoveMenu(moveMenu === e.id ? null : e.id)}>
                              Move to… <ChevronDown />
                            </Button>
                            {moveMenu === e.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setMoveMenu(null)} />
                                <div className={cn(popoverCls, "absolute end-0 top-full z-20 mt-1 flex w-56 flex-col p-1 text-left")}>
                                  {accounts
                                    .filter((a) => a.id !== e.accountId)
                                    .map((a) => (
                                      <button
                                        key={a.id}
                                        className={menuItemCls}
                                        onClick={() => {
                                          store().moveEntry(e.id, a.id);
                                          setMoveMenu(null);
                                          toast(`${e.ref} moved to ${accountName(a)}`);
                                        }}
                                      >
                                        {accountName(a)}
                                        {a.nickname && <span className="text-muted-foreground"> · {a.nickname}</span>}
                                      </button>
                                    ))}
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Waiting for the bank</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {bookRows.length === 0 && (
                  <Empty colSpan={bookCols}>
                    {filter === "notinbank"
                      ? "Every entry in your books for this period has shown up at the bank."
                      : filter === "confirm"
                        ? "No suggestions waiting."
                        : "No entries in your books for this period."}
                  </Empty>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {resolving && (
        <ResolveDrawer
          line={resolving}
          candidates={entries.filter((e) => e.accountId === resolving.accountId && !e.lineId && Math.sign(e.amount) === Math.sign(resolving.amount))}
          onClose={() => setResolving(null)}
          onDone={(match, entryId, rule) => {
            store().resolveLine(resolving.id, match, entryId);
            setResolving(null);
            toast(rule ? `Matched · rule saved for similar "${resolving.narration.split("/")[0]}" transactions` : "Matched");
          }}
        />
      )}
    </div>
  );
}

/** Accept / reject an AI match, find a match for an unmatched line, or undo a match. */
function LineActions({ line, onAccept, onReject, onFind }: { line: BankLine; onAccept: () => void; onReject: (undo: boolean) => void; onFind: () => void }) {
  if (line.status === "suggested")
    return (
      <div className="flex justify-end gap-1.5">
        <Button size="sm" onClick={onAccept}>
          <Check />
          Accept
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Not this match" title="Not this match" onClick={() => onReject(false)}>
          <X />
        </Button>
      </div>
    );
  if (line.status === "needs")
    return (
      <Button size="sm" variant="primary" onClick={onFind}>
        Find match
      </Button>
    );
  return (
    <Button size="sm" variant="ghost" onClick={() => onReject(true)}>
      <Undo2 />
      Undo
    </Button>
  );
}

function SideLabel({ icon, text, count }: { icon: ReactNode; text: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 [&_svg]:size-4">
      {icon}
      {text}
      <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{count}</span>
    </span>
  );
}

function AccountMark({ account }: { account: CompanyAccount | null }) {
  if (!account)
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary-soft)] text-[var(--color-primary-accent)]">
        <Layers className="size-4" />
      </span>
    );
  return account.bankKey ? (
    <BankIcon bank={account.bankKey} size={32} />
  ) : (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <Landmark className="size-4" />
    </span>
  );
}

function Empty({ children, colSpan }: { children: ReactNode; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn(tdCls, "py-10 text-center text-muted-foreground")}>
        {children}
      </td>
    </tr>
  );
}

const KINDS: MatchKind[] = ["Receipt", "Payment voucher", "Expense", "Bill payment", "Transfer", "Journal"];

/** Settle one bank line: link an entry already in the books, or record a new one (optionally as a rule). */
function ResolveDrawer({
  line,
  candidates,
  onClose,
  onDone,
}: {
  line: BankLine;
  candidates: BookEntry[];
  onClose: () => void;
  onDone: (match: Match, bookEntryId?: string, rule?: boolean) => void;
}) {
  useEscape(onClose);
  const [tab, setTab] = useState<"match" | "record">(candidates.length ? "match" : "record");
  const [pick, setPick] = useState<string | null>(null);
  const [kind, setKind] = useState<MatchKind>(line.amount > 0 ? "Receipt" : "Expense");
  const [party, setParty] = useState("");
  const [ledger, setLedger] = useState(line.amount > 0 ? "Sales" : "");
  const [rule, setRule] = useState(false);

  const picked = candidates.find((c) => c.id === pick);
  const canRecord = party.trim() !== "" && (kind === "Receipt" || kind === "Payment voucher" || ledger !== "");

  return (
    <>
      <div className={OVERLAY} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Match bank transaction"
        className="fixed bottom-5 end-5 top-5 z-50 flex w-[460px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg animate-[drawer-in_.4s_cubic-bezier(.4,0,.2,1)]"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="text-base font-semibold">Match bank transaction</div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="rounded-lg border border-border p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-2sm">
                <div className="break-words">{line.narration}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{line.date}</div>
              </div>
              <Amount value={line.amount} className="shrink-0 text-base font-semibold" />
            </div>
          </div>

          <div role="tablist" className="flex gap-1 rounded-lg border border-border/80 bg-muted/80 p-1">
            {(
              [
                ["match", `Match an entry (${candidates.length})`],
                ["record", "Record new entry"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={tab === v}
                onClick={() => setTab(v)}
                className={cn("h-8 flex-1 cursor-pointer rounded-md text-2sm", tab === v && "bg-background font-medium shadow-lg shadow-black/5")}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "match" ? (
            candidates.length === 0 ? (
              <p className="text-2sm text-muted-foreground">No open entries in your books for this account. Record a new entry instead.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {candidates.map((c) => {
                  const diff = Math.abs(c.amount) - Math.abs(line.amount);
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md border p-3",
                        pick === c.id ? "border-primary bg-[var(--color-primary-soft)]" : "border-input hover:bg-accent/60",
                      )}
                    >
                      <input type="radio" name="cand" checked={pick === c.id} onChange={() => setPick(c.id)} className="mt-0.5 size-4 accent-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2 text-2sm">
                          <span className="font-medium">
                            {c.ref} · {c.party}
                          </span>
                          <Amount value={c.amount} />
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {c.date} · {diff === 0 ? "Exact amount" : `${fmtINR(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than the bank`}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="rec-kind" className="text-xs font-medium">
                  Type
                </label>
                <Select id="rec-kind" value={kind} onChange={(e) => setKind(e.target.value as MatchKind)}>
                  {KINDS.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="rec-party" className="text-xs font-medium">
                  {line.amount > 0 ? "Received from" : "Paid to"}
                </label>
                <Input id="rec-party" list="rec-parties" value={party} onChange={(e) => setParty(e.target.value)} placeholder="Contact or payee" />
                <datalist id="rec-parties">
                  {PARTIES.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="rec-ledger" className="text-xs font-medium">
                  Account head
                </label>
                <Select id="rec-ledger" value={ledger} onChange={(e) => setLedger(e.target.value)}>
                  <option value="">Select…</option>
                  {LEDGERS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 text-2sm">
                <input type="checkbox" checked={rule} onChange={(e) => setRule(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
                <span>
                  Do the same for similar transactions
                  <span className="block text-xs text-muted-foreground">The AI engine will match future lines like this one automatically.</span>
                </span>
              </label>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-6 py-4">
          <Button onClick={onClose}>Cancel</Button>
          {tab === "match" ? (
            <Button
              variant="primary"
              disabled={!picked}
              onClick={() => picked && onDone({ kind: picked.kind, ref: picked.ref, party: picked.party }, picked.id)}
            >
              Match
            </Button>
          ) : (
            <Button variant="primary" disabled={!canRecord} onClick={() => onDone({ kind, party: party.trim(), ledger: ledger || undefined }, undefined, rule)}>
              Record & match
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
