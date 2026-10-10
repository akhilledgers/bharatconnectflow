import { useState, type ReactNode } from "react";
import { BookOpen, Check, ChevronDown, Landmark, Layers, Plug, RefreshCw, Search, Sparkles, Undo2, Upload, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input, Select } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { Tabs } from "../../components/ui/tabs";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { BankIcon } from "./BankLogo";
import { ALL_ACCOUNTS, CONNECTED_BANKING, fmtINR, last4, syncedLabel, type CompanyAccount } from "./data";
import { LEDGERS, describeLine, narrationKey, reconFor, type BankLine, type BookEntry, type Match, type MatchKind, type Party } from "./ledgerData";
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

/** The next free voucher number in a series, e.g. REC 2026-71. */
function nextRef(entries: BookEntry[], prefix: "REC" | "VOU") {
  const nums = entries.map((e) => new RegExp(`^${prefix} 2026-(\\d+)$`).exec(e.ref)?.[1]).filter(Boolean).map(Number);
  return `${prefix} 2026-${Math.max(70, ...nums) + 1}`;
}

/** Who paid or was paid: the engine's reading of the narration, or the matched party. */
const lineParty = (l: BankLine) => l.party ?? l.match?.party ?? describeLine(l);

const lineStatus = (l: BankLine): Exclude<Filter, "all" | "notinbank"> => (l.status === "suggested" ? "confirm" : l.status === "needs" ? "unmatched" : "matched");

export function Amount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", value > 0 ? "text-[var(--color-success-accent)]" : "text-foreground", className)}>
      {value > 0 ? "+" : "−"}
      {fmtINR(Math.abs(value))}
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
  const parties = useBankingStore((s) => s.parties);
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
  const [resolvingId, setResolving] = useState<string | null>(null);
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
  const periodLines = accountLines.filter((l) => inPeriod(l.date) && matchesQuery([l.narration, l.party, l.match?.party, l.match?.ref, describeLine(l)].join(" "), l.amount));
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
  const resolving = resolvingId ? lineById.get(resolvingId) : undefined;

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
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
          <div className="hidden md:block">
            <FilterChips
              value={filter}
              onChange={(f) => {
                setFilter(f);
                setSelected([]);
              }}
              items={FILTERS.map((f) => ({ ...f, count: counts[f.value], icon: f.value === "confirm" ? <Sparkles /> : undefined }))}
            />
          </div>
          <Select
            aria-label="Show"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as Filter);
              setSelected([]);
            }}
            wrapperClassName="w-52 md:hidden"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label} ({counts[f.value]})
              </option>
            ))}
          </Select>
          {filter === "confirm" && confirmIds.length > 0 && (
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
          )}
          <div className="relative ms-auto w-full sm:w-60">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="txn-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isStatementView ? "Search party, narration, amount" : "Search voucher, party, amount"}
              className="ps-9"
            />
          </div>
        </div>

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

        {/* Column heads: wide screens only. Below that each row stacks. */}
        <div className="hidden items-center gap-3 border-b border-border bg-muted/40 px-5 py-2 text-xs font-medium text-muted-foreground lg:flex">
          {filter === "confirm" && (
            <input
              type="checkbox"
              aria-label="Select all"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? [] : confirmIds)}
              className="size-4 cursor-pointer accent-primary"
            />
          )}
          <div className="w-16 shrink-0">Date</div>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-6">
            <span>{isStatementView ? "Bank transaction" : "Entry in your books"}</span>
            <span>{isStatementView ? "In your books" : "In the bank"}</span>
          </div>
          <div className="w-28 text-right sm:w-36">Amount</div>
          <div className="w-[164px]" />
        </div>

        {isStatementView
          ? bankRows.map((l) => (
              <Row
                key={l.id}
                checkbox={filter === "confirm"}
                checked={selected.includes(l.id)}
                onToggle={() => toggle(l.id)}
                onOpen={() => setResolving(l.id)}
                date={l.date}
                main={
                  <TwoLines
                    title={lineParty(l)}
                    muted={!l.party && !l.match}
                    sub={`${all ? `${accountName(byId.get(l.accountId)!)} · ` : ""}${l.narration}`}
                    subTitle={l.narration}
                  />
                }
                side={<BooksSide line={l} />}
                amount={l.amount}
                note={showBalance ? `Bal ${fmtINR(balanceAfter.get(l.id) ?? 0)}` : undefined}
                actions={<LineActions line={l} onAccept={() => accept([l.id])} onReject={(undo) => reject(l.id, undo)} onFind={() => setResolving(l.id)} />}
              />
            ))
          : bookRows.map((e) => {
              const l = e.lineId ? lineById.get(e.lineId) : undefined;
              return (
                <Row
                  key={e.id}
                  checkbox={filter === "confirm"}
                  checked={!!e.lineId && selected.includes(e.lineId)}
                  onToggle={() => e.lineId && toggle(e.lineId)}
                  onOpen={l ? () => setResolving(l.id) : undefined}
                  date={e.date}
                  main={<TwoLines title={`${e.ref} · ${e.party}`} sub={`${all ? `${accountName(byId.get(e.accountId)!)} · ` : ""}${e.kind}`} />}
                  side={
                    l ? (
                      <TwoLines
                        icon={l.status === "suggested" ? <Sparkles className="size-3.5 text-primary" /> : <Check className="size-3.5 text-[var(--color-success-accent)]" />}
                        title={lineParty(l)}
                        sub={`${l.status === "suggested" ? "Suggested by AI" : "Matched"} · ${l.date === e.date ? "same day" : `at the bank ${shortDate(l.date)}`}${Math.abs(l.amount) !== Math.abs(e.amount) ? ` · part of ${fmtINR(Math.abs(l.amount))}` : ""}`}
                      />
                    ) : (
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="warning">Not in bank</Badge>
                          {e.assumedAccount && <Badge variant="secondary">Account assumed</Badge>}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {e.note}
                          {e.daysOpen !== undefined && ` · open ${e.daysOpen} days`}
                        </div>
                      </div>
                    )
                  }
                  amount={e.amount}
                  actions={
                    l ? (
                      <LineActions line={l} onAccept={() => accept([l.id])} onReject={(undo) => reject(l.id, undo)} onFind={() => setResolving(l.id)} />
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
                    )
                  }
                />
              );
            })}

        {(isStatementView ? bankRows : bookRows).length === 0 && (
          <div className="px-5 py-10 text-center text-2sm text-muted-foreground">
            {isStatementView
              ? account && !bank && !q
                ? account.bankKey
                  ? "No bank transactions yet. Connect the account to bring them in."
                  : "No bank transactions yet. Upload a statement to bring them in."
                : filter === "confirm"
                  ? "No suggestions waiting. New bank transactions are matched as they arrive."
                  : filter === "unmatched"
                    ? "Every bank transaction in this period is in your books."
                    : "No bank transactions in this period."
              : filter === "notinbank"
                ? "Every entry in your books for this period has shown up at the bank."
                : filter === "confirm"
                  ? "No suggestions waiting."
                  : "No entries in your books for this period."}
          </div>
        )}
      </Card>

      {resolving && (
        <MatchPanel
          key={resolving.id + resolving.status}
          line={resolving}
          accountLabel={accountName(byId.get(resolving.accountId)!)}
          balance={showBalance ? balanceAfter.get(resolving.id) : undefined}
          parties={parties}
          // Open entries, plus whatever the line is matched to now (so a change can keep or swap it).
          openEntries={entries.filter((e) => e.accountId === resolving.accountId && (!e.lineId || e.lineId === resolving.id) && Math.sign(e.amount) === Math.sign(resolving.amount))}
          nextRef={{ receipt: nextRef(entries, "REC"), payment: nextRef(entries, "VOU") }}
          onClose={() => setResolving(null)}
          onAccept={() => {
            accept([resolving.id]);
            setResolving(null);
          }}
          onReject={(undo) => {
            reject(resolving.id, undo);
            setResolving(null);
          }}
          onDone={(match, opts, remember) => {
            store().resolveLine(resolving.id, match, opts);
            if (remember) store().rememberKey(remember.partyId, remember.key);
            setResolving(null);
            toast(remember ? `Matched · the AI will now recognise ${remember.key} as ${match.party}` : "Matched");
          }}
        />
      )}
    </div>
  );
}

/** The one quick action a row offers; everything else opens from a click on the row. */
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
  return null;
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

/** One list row: who/what (and its match) on the left, amount and action on the right. Stacks below lg. */
function Row({
  checkbox,
  checked,
  onToggle,
  onOpen,
  date,
  main,
  side,
  amount,
  note,
  actions,
}: {
  checkbox: boolean;
  checked: boolean;
  onToggle: () => void;
  onOpen?: () => void;
  date: string;
  main: ReactNode;
  side: ReactNode;
  amount: number;
  note?: string;
  actions: ReactNode;
}) {
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => onOpen && e.key === "Enter" && onOpen()}
      className={cn("flex items-start gap-3 border-b border-border px-5 py-3 last:border-b-0 lg:items-center", onOpen && "cursor-pointer hover:bg-accent/40")}
    >
      {checkbox && (
        <input
          type="checkbox"
          aria-label="Select"
          checked={checked}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggle}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary lg:mt-0"
        />
      )}
      <div className="w-16 shrink-0 pt-px text-2sm tabular-nums text-muted-foreground lg:pt-0">{shortDate(date)}</div>
      <div className="grid min-w-0 flex-1 gap-x-6 gap-y-2 lg:grid-cols-2 lg:items-center">
        {main}
        {side}
      </div>
      <div className="w-28 shrink-0 text-right sm:w-36">
        <Amount value={amount} className="text-2sm font-semibold" />
        {note && <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{note}</div>}
      </div>
      <div className="flex w-[164px] shrink-0 justify-end" onClick={(e) => e.stopPropagation()}>
        {actions}
      </div>
    </div>
  );
}

function TwoLines({ title, sub, subTitle, icon, muted }: { title: ReactNode; sub: ReactNode; subTitle?: string; icon?: ReactNode; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5">
        {icon}
        <span className={cn("truncate text-2sm", muted ? "text-muted-foreground" : "font-medium")}>{title}</span>
      </div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground" title={subTitle}>
        {sub}
      </div>
    </div>
  );
}

/** What a bank line is (or isn't) in the books, in two short lines. */
function BooksSide({ line: l }: { line: BankLine }) {
  if (l.status === "needs")
    return (
      <div className="flex min-w-0 items-center gap-2">
        <Badge variant="warning">Unmatched</Badge>
        <span className="truncate text-xs text-muted-foreground">Nothing in your books yet</span>
      </div>
    );
  const m = l.match!;
  const what = [m.kind, m.ref ?? m.ledger].filter(Boolean).join(" · ");
  const check = l.status === "suggested" && m.confidence !== undefined && m.confidence < 90;
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5">
        {l.status === "suggested" ? <Sparkles className="size-3.5 shrink-0 text-primary" /> : <Check className="size-3.5 shrink-0 text-[var(--color-success-accent)]" />}
        <span className="truncate text-2sm">{what}</span>
        {check && <Badge variant="warning">Check · {m.confidence}%</Badge>}
      </div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">
        {l.status === "suggested" ? m.reason : `Matched by ${l.status === "auto" ? "AI" : "you"}`}
      </div>
    </div>
  );
}

/** A numbered step in the match panel. `grow` lets it take the panel's spare height (for the scrolling list). */
function Step({ n, title, grow, children }: { n: number; title: string; grow?: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex gap-2.5", grow ? "min-h-0 flex-1" : "shrink-0")}>
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[11px] font-semibold text-[var(--color-primary-accent)]">{n}</span>
      <div className={cn("min-w-0 flex-1", grow && "flex min-h-0 flex-col")}>
        <div className="mb-1.5 text-2sm font-medium leading-5">{title}</div>
        {children}
      </div>
    </div>
  );
}

type Settle = { entryIds?: string[]; party?: string; settle?: { itemId: string; amount: number }[] };

/** Items in the "what does it settle" list scroll inside the panel past this many, with a filter. */
const LIST_FILTER_AT = 5;

/**
 * Everything about one bank transaction, editable in place: what the AI found and why, who it is (search any
 * contact, or none), what it settles (open invoices/bills, entries already in the books, or a new receipt or
 * payment), and teaching the engine for next time. Opens from a click anywhere on the row.
 */
function MatchPanel({
  line,
  accountLabel,
  balance,
  parties,
  openEntries,
  nextRef,
  onClose,
  onAccept,
  onReject,
  onDone,
}: {
  line: BankLine;
  accountLabel: string;
  balance?: number;
  parties: Party[];
  /** Book entries on this account with no bank line yet (same direction), plus the ones linked to this line. */
  openEntries: BookEntry[];
  /** Number a new receipt / payment voucher would get. */
  nextRef: { receipt: string; payment: string };
  onClose: () => void;
  /** Accept the AI's match as it is. */
  onAccept: () => void;
  /** Not this match (suggested) / undo (matched). */
  onReject: (undo: boolean) => void;
  onDone: (match: Match, opts: Settle, remember?: { partyId: string; key: string }) => void;
}) {
  useEscape(onClose);
  const inflow = line.amount > 0;
  const total = Math.abs(line.amount);
  const key = narrationKey(line);
  const narr = line.narration.toUpperCase();
  const m = line.match;
  const linked = openEntries.filter((e) => e.lineId === line.id);
  const linkedParties = [...new Set(linked.map((e) => e.party))];

  // Who it might be: contacts with a learned UPI ID / name, or a name word in the narration.
  const suggested = parties
    .map((p) => ({ p, score: (key && p.keys.includes(key.value) ? 10 : 0) + p.name.toUpperCase().split(/\s+/).filter((w) => w.length >= 4 && narr.includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p)
    .slice(0, 3);

  // Start from what the line is matched to now (or what the AI proposes).
  const initialWho = (() => {
    if (linkedParties.length > 1) return "multi";
    const named = m ? parties.find((p) => p.name === m.party) : undefined;
    if (named) return named.id;
    if (m && (m.kind === "Expense" || m.kind === "Journal" || m.kind === "Transfer")) return "none";
    return suggested.length === 1 ? suggested[0].id : null;
  })();

  const [who, setWho] = useState<string | null>(initialWho);
  const [dirty, setDirty] = useState(false);
  const [q, setQ] = useState("");
  const [listQ, setListQ] = useState("");
  const party = parties.find((p) => p.id === who);
  const itemsOf = (p?: Party) => (p ? p.items.filter((i) => (inflow ? i.kind === "Invoice" : i.kind === "Bill")) : []);
  const entriesOf = (p?: Party) => (who === "multi" ? linked : p ? openEntries.filter((e) => e.party === p.name || e.lineId === line.id) : []);
  const items = itemsOf(party);
  const entries = entriesOf(party);
  const pickFor = (p?: Party) => {
    const ln = (who === "multi" ? linked : p ? openEntries.filter((e) => e.lineId === line.id && e.party === p.name) : []).map((e) => e.id);
    if (ln.length) return ln;
    const ex = [...(p ? openEntries.filter((e) => e.party === p.name) : []).map((e) => ({ id: e.id, amount: Math.abs(e.amount) })), ...itemsOf(p).map((i) => ({ id: i.id, amount: i.due }))].find(
      (x) => x.amount === total,
    );
    return ex ? [ex.id] : [];
  };
  const [picked, setPicked] = useState<string[]>(() => (initialWho === "multi" ? linked.map((e) => e.id) : pickFor(parties.find((p) => p.id === initialWho))));
  const [mode, setMode] = useState<"link" | "new">("link");
  const [treatAs, setTreatAs] = useState<"Advance" | "On account">("On account");
  const [newNote, setNewNote] = useState("");
  const [kind, setKind] = useState<MatchKind>(m && initialWho === "none" ? m.kind : inflow ? "Journal" : "Expense");
  const guessLedger = { "Bank charge": "Bank charges", "Interest credit": "Interest income", "Tax payment": "GST payable" }[describeLine(line)] ?? "";
  const [ledger, setLedger] = useState(m && initialWho === "none" ? (m.ledger ?? guessLedger) : guessLedger);
  const [remember, setRemember] = useState(true);
  const [fullNarration, setFullNarration] = useState(false);
  const touch = () => setDirty(true);

  const choose = (id: string | null) => {
    touch();
    setWho(id);
    setQ("");
    setListQ("");
    setMode("link");
    setPicked(pickFor(parties.find((x) => x.id === id)));
  };

  // Entries already in the books and open invoices/bills are alternatives: linking one excludes the other.
  const pickedEntries = entries.filter((e) => picked.includes(e.id));
  const toggle = (id: string, isEntry: boolean) => {
    touch();
    setPicked((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      const sameKind = s.filter((x) => (isEntry ? entries.some((e) => e.id === x) : items.some((i) => i.id === x)));
      return [...sameKind, id];
    });
  };
  const options = [
    ...entries.map((e) => ({
      id: e.id,
      ref: who === "multi" ? `${e.ref} · ${e.party}` : e.ref,
      date: e.date,
      amount: Math.abs(e.amount),
      note: e.lineId === line.id ? (line.status === "suggested" ? "Suggested by AI" : "Linked") : "In your books, not in bank yet",
      isEntry: true,
    })),
    ...items.map((i) => ({ id: i.id, ref: i.ref, date: i.date, amount: i.due, note: `${i.kind} · due`, isEntry: false })),
  ];
  const lq = listQ.trim().toLowerCase();
  const shownOptions = lq ? options.filter((o) => o.ref.toLowerCase().includes(lq) || String(o.amount).includes(lq)) : options;
  const alloc = new Map<string, number>();
  let left = total;
  for (const x of options)
    if (picked.includes(x.id)) {
      const a = Math.min(x.amount, left);
      alloc.set(x.id, a);
      left = Math.round((left - a) * 100) / 100;
    }
  const results = q.trim()
    ? parties.filter((p) => [p.name, p.gstin ?? "", p.phone ?? "", ...p.keys].some((v) => v.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 6)
    : [];
  const voucher = inflow ? "receipt" : "payment";
  const newRef = inflow ? nextRef.receipt : nextRef.payment;

  const canSave =
    who === "none" ? ledger !== "" : who === "multi" ? pickedEntries.length > 0 && left === 0 : !!party && (mode === "new" || pickedEntries.length === 0 || left === 0);

  const submit = () => {
    if (who === "none") return onDone({ kind, party: describeLine(line), ledger }, {});
    if (who === "multi") return onDone(m!, { entryIds: pickedEntries.map((e) => e.id), party: line.party });
    const p = party!;
    const rem = remember && key && !p.keys.includes(key.value) ? { partyId: p.id, key: key.value } : undefined;
    if (mode === "new")
      return onDone(
        { kind: inflow ? "Receipt" : "Payment voucher", ref: newRef, party: p.name, ledger: treatAs, reason: newNote.trim() || undefined },
        { party: p.name },
        rem,
      );
    if (pickedEntries.length)
      return onDone(
        { kind: pickedEntries[0].kind === "Receipt" ? "Receipt" : pickedEntries[0].kind === "Journal" ? "Journal" : "Payment voucher", ref: pickedEntries.map((e) => e.ref).join(", "), party: p.name },
        { entryIds: pickedEntries.map((e) => e.id), party: p.name },
        rem,
      );
    const settled = items.filter((i) => picked.includes(i.id));
    const ref = settled.length === 0 ? newRef : settled.length <= 2 ? settled.map((i) => i.ref).join(", ") : `${settled.length} ${inflow ? "invoices" : "bills"}`;
    onDone(
      { kind: settled.length ? (inflow ? "Receipt" : "Bill payment") : inflow ? "Receipt" : "Payment voucher", ref, party: p.name, ledger: left > 0 ? "Advance / on account" : undefined },
      { party: p.name, settle: settled.map((i) => ({ itemId: i.id, amount: alloc.get(i.id)! })) },
      rem,
    );
  };

  return (
    <>
      <div className={OVERLAY} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bank transaction"
        className="fixed bottom-5 end-5 top-5 z-50 flex w-[500px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg animate-[drawer-in_.4s_cubic-bezier(.4,0,.2,1)]"
      >
        {/* The transaction is the header: who, when, how much, and the narration on one line. */}
        <div className="shrink-0 border-b border-border px-6 pb-3 pt-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold">{lineParty(line)}</div>
              <div className="truncate text-xs text-muted-foreground">
                {fmtDay(toDate(line.date))} · {accountLabel}
                {balance !== undefined && ` · bal ${fmtINR(balance)}`}
              </div>
            </div>
            <Amount value={line.amount} className="shrink-0 pt-0.5 text-lg font-semibold" />
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="-me-2">
              <X />
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setFullNarration(!fullNarration)}
            title={fullNarration ? "Show less" : "Show the full narration"}
            className={cn("mt-2 block w-full cursor-pointer rounded bg-muted/60 px-2 py-1 text-left font-mono text-[11px] text-muted-foreground", fullNarration ? "[overflow-wrap:anywhere]" : "truncate")}
          >
            {line.narration}
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">

          {/* What the AI found / current state */}
          {m && line.status === "suggested" && (
            <div className="flex shrink-0 items-center gap-2 rounded-md border border-[var(--color-primary-accent)]/20 bg-[var(--color-primary-soft)] px-3 py-2 text-xs">
              <Sparkles className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1 truncate" title={m.reason}>
                <span className="text-foreground">
                  AI suggests <span className="font-medium">{[m.kind, m.ref ?? m.ledger].filter(Boolean).join(" · ")}</span>
                </span>
                {m.reason && <span className="text-muted-foreground"> · {m.reason}</span>}
              </div>
              {m.confidence !== undefined && <Badge variant={m.confidence < 90 ? "warning" : "primary"}>{m.confidence}% sure</Badge>}
            </div>
          )}
          {m && line.status !== "suggested" && (
            <div className="flex shrink-0 items-center gap-2 rounded-md bg-[var(--color-success-soft)] px-3 py-2 text-xs text-[var(--color-success-accent)]">
              <Check className="size-4 shrink-0" />
              Matched by {line.status === "auto" ? "AI" : "you"}: {[m.kind, m.ref ?? m.ledger].filter(Boolean).join(" · ")}. Change it below if it's wrong.
            </div>
          )}

          <Step n={1} title="Who is this?">
            {who === "multi" ? (
              <div className="rounded-md border border-primary bg-[var(--color-primary-soft)] px-3 py-2.5 text-2sm">
                <span className="font-medium">{linkedParties.length} contacts</span>
                <span className="text-muted-foreground"> · one bank payment for several bills</span>
              </div>
            ) : who && who !== "none" && party ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-primary bg-[var(--color-primary-soft)] px-3 py-2.5">
                <div className="min-w-0 text-2sm">
                  <div className="font-medium">{party.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{[party.type, party.gstin, party.phone].filter(Boolean).join(" · ")}</div>
                </div>
                <button type="button" onClick={() => choose(null)} className="cursor-pointer text-xs font-medium text-primary hover:underline">
                  Change
                </button>
              </div>
            ) : who === "none" ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-primary bg-[var(--color-primary-soft)] px-3 py-2.5 text-2sm">
                <span className="font-medium">No contact</span>
                <button type="button" onClick={() => choose(null)} className="cursor-pointer text-xs font-medium text-primary hover:underline">
                  Change
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contact, GSTIN, phone, UPI ID" className="ps-9" />
                </div>
                {results.length > 0 ? (
                  <div className="flex flex-col rounded-md border border-border">
                    {results.map((p) => (
                      <button key={p.id} type="button" onClick={() => choose(p.id)} className="flex cursor-pointer flex-col items-start border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-accent">
                        <span className="text-2sm font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{[p.type, p.gstin, p.phone].filter(Boolean).join(" · ")}</span>
                      </button>
                    ))}
                  </div>
                ) : q.trim() ? (
                  <div className="text-xs text-muted-foreground">No contact found. Create it from Contacts, or pick No contact below.</div>
                ) : (
                  suggested.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      Could be:
                      {suggested.map((p) => (
                        <button key={p.id} type="button" onClick={() => choose(p.id)} className="cursor-pointer rounded-md border border-input px-2 py-1 text-foreground hover:bg-accent">
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )
                )}
                <button type="button" onClick={() => choose("none")} className="cursor-pointer self-start text-xs font-medium text-primary hover:underline">
                  No contact: bank charge, interest, tax, transfer…
                </button>
              </div>
            )}
          </Step>

          {who === "none" && (
            <Step n={2} title="Record it as">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  aria-label="Type"
                  value={kind}
                  onChange={(e) => {
                    touch();
                    setKind(e.target.value as MatchKind);
                  }}
                >
                  {(["Expense", "Journal", "Transfer"] as MatchKind[]).map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </Select>
                <Select
                  aria-label="Account head"
                  value={ledger}
                  onChange={(e) => {
                    touch();
                    setLedger(e.target.value);
                  }}
                >
                  <option value="">Account head…</option>
                  {LEDGERS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </div>
            </Step>
          )}

          {(party || who === "multi") && (
            <Step n={2} title="What does it settle?" grow={mode === "link" && options.length > 3}>
              {party && (
                <div role="radiogroup" className="mb-2 flex shrink-0 gap-1 rounded-lg border border-border/80 bg-muted/80 p-0.5">
                  {(
                    [
                      ["link", `Link ${inflow ? "invoices" : "bills"} or entries`],
                      ["new", `Record new ${voucher}`],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={mode === v}
                      onClick={() => {
                        touch();
                        setMode(v);
                      }}
                      className={cn("h-7 flex-1 cursor-pointer rounded-md text-xs", mode === v && "bg-background font-medium shadow-lg shadow-black/5")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {mode === "new" && party ? (
                <div className="flex flex-col gap-3 rounded-md border border-border p-3.5">
                  <div className="flex justify-between text-2sm">
                    <span>
                      New {voucher} <span className="font-medium">{newRef}</span>
                    </span>
                    <span className="font-medium tabular-nums">{fmtINR(total)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {inflow ? "From" : "To"} {party.name} · dated {fmtDay(toDate(line.date))}, the day it hit the bank
                  </div>
                  <div role="radiogroup" className="flex flex-col gap-1.5 text-2sm">
                    {(
                      [
                        ["On account", `On account: adjust against ${inflow ? "invoices" : "bills"} later`],
                        ["Advance", `Advance ${inflow ? "from customer" : "to vendor"}: before ${inflow ? "an invoice" : "a bill"} is raised`],
                      ] as const
                    ).map(([v, label]) => (
                      <label key={v} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="treat"
                          checked={treatAs === v}
                          onChange={() => {
                            touch();
                            setTreatAs(v);
                          }}
                          className="size-4 accent-primary"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <Input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Note (optional)" />
                </div>
              ) : options.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No open {inflow ? "invoices" : "bills"} for {party?.name}. Record a new {voucher} instead.
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                  {options.length > LIST_FILTER_AT && (
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input value={listQ} onChange={(e) => setListQ(e.target.value)} placeholder="Filter by number or amount" className="h-8 ps-8 text-xs" />
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{options.length} open</span>
                    </div>
                  )}
                  {/* Takes whatever height is left and scrolls inside, so the panel itself doesn't. */}
                  <div className={cn("flex flex-col gap-1 overflow-y-auto rounded-md border border-border p-1", options.length > 3 && "min-h-[124px] flex-1")}>
                    {shownOptions.map((x) => (
                      <label
                        key={x.id}
                        className={cn("flex shrink-0 cursor-pointer items-center gap-2.5 rounded px-2.5 py-1.5", picked.includes(x.id) ? "bg-[var(--color-primary-soft)]" : "hover:bg-accent/60")}
                      >
                        <input type="checkbox" checked={picked.includes(x.id)} onChange={() => toggle(x.id, x.isEntry)} className="size-4 shrink-0 accent-primary" />
                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={`${x.ref} · ${x.note} ${fmtINR(x.amount)}`}>
                          <span className="text-2sm font-medium text-foreground">{x.ref}</span> · {shortDate(x.date)} · {x.note} {fmtINR(x.amount)}
                        </span>
                        {alloc.has(x.id) && <span className="text-2sm tabular-nums">{fmtINR(alloc.get(x.id)!)}</span>}
                      </label>
                    ))}
                    {shownOptions.length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">Nothing matches “{listQ}”.</div>}
                  </div>
                  <div className={cn("shrink-0 text-xs", left === 0 ? "text-[var(--color-success-accent)]" : "text-muted-foreground")}>
                    {left === 0
                      ? `Allocated ${fmtINR(total)} of ${fmtINR(total)} ✓`
                      : pickedEntries.length
                        ? `The entries add up to ${fmtINR(total - left)}; the bank shows ${fmtINR(total)}.`
                        : `${fmtINR(total - left)} allocated · ${fmtINR(left)} left will be recorded as an advance / on account`}
                  </div>
                </div>
              )}
            </Step>
          )}

          {party && key && !party.keys.includes(key.value) && (
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs" title={`The AI will match transactions like this to ${party.name} on its own.`}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 shrink-0 accent-primary" />
              <span className="min-w-0 truncate">
                Next time, treat {key.label} <span className="font-mono">{key.value}</span> as {party.name}
              </span>
            </label>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-border px-6 py-3">
          {line.status === "suggested" && (
            <Button variant="ghost" className="me-auto" onClick={() => onReject(false)}>
              <X />
              Not this match
            </Button>
          )}
          {(line.status === "auto" || line.status === "matched") && (
            <Button variant="ghost" className="me-auto" onClick={() => onReject(true)}>
              <Undo2 />
              Undo match
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          {line.status === "suggested" && !dirty ? (
            <Button variant="primary" onClick={onAccept}>
              <Check />
              Accept
            </Button>
          ) : (
            <Button variant="primary" disabled={!canSave || (line.status !== "needs" && line.status !== "suggested" && !dirty)} onClick={submit}>
              {line.status === "needs" ? "Match" : "Save match"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
