import { useState, type ReactNode } from "react";
import { BookOpen, Check, ChevronDown, Landmark, Plus, Layers, Plug, RefreshCw, Search, Sparkles, Undo2, Upload, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input, Select } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { Tabs } from "../../components/ui/tabs";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { ALL_ACCOUNTS, fmtINR, syncedLabel, type CompanyAccount } from "./data";
import { CASH_ALL, CASH_PARENT } from "./cash";
import { accountName as sharedAccountName, groupOf } from "./data";
import { AccountIcon } from "./BankLogo";
import { LEDGERS, describeLine, narrationKey, nextRef, reconFor, type BankLine, type BookEntry, type Match, type MatchKind, type Party } from "./ledgerData";
import { RECONCILED_TO, bankBalanceOf, shortDate } from "./overviewData";
import { OVERLAY } from "./shared";
import { FilterChips } from "./FilterChips";
import { StatCard } from "./StatCard";
import { UploadStatementDialog } from "./UploadStatementDialog";
import { useEscape } from "./useEscape";
import { PERIODS, periodRange, type Period } from "./periods";

/** Which side of the reconciliation is listed. */
type Side = "bank" | "books";
/** Bank side: Suggested by AI · Unmatched · Matched. Books side: Suggested by AI · Not in bank · Matched. */
type Filter = "all" | "confirm" | "unmatched" | "notinbank" | "matched";

const toast = (m: string, tone: "success" | "error" = "success") => useStore.getState().pushToast(m, tone);
const accountName = sharedAccountName;
const toDate = (dmy: string) => {
  const [d, m, y] = dmy.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fmtDay = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

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
  const cashAccounts = useBankingStore((s) => s.cashAccounts).filter((a) => a.active);
  const lines = useBankingStore((s) => s.bankLines);
  const entries = useBankingStore((s) => s.bookEntries);
  // Cash receipts and payments share the voucher series with bank ones.
  const cashEntries = useBankingStore((s) => s.cashEntries);
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
  const [moveMenu, setMoveMenu] = useState<{ id: string; right: number; top?: number; bottom?: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [adding, setAdding] = useState(false);

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
  const [uploading, setUploading] = useState<CompanyAccount | null>(null);
  const upload = (a: CompanyAccount) => {
    setUploadOpen(false);
    setUploading(a);
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
                {/* Cash has no statement: picking it opens its cash book. */}
                <div className="mt-1 border-t border-border px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Cash</div>
                {[{ id: CASH_ALL, name: CASH_PARENT }, ...cashAccounts].map((c) => (
                  <button
                    key={c.id}
                    className={cn(menuItemCls, c.id !== CASH_ALL && "ps-6")}
                    onClick={() => {
                      setSwitcherOpen(false);
                      onAccountChange(c.id);
                    }}
                  >
                    <span className="truncate">{c.name}</span>
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
            ) : account.bankKey && (account.connection === "pending" || account.connection === "requested") ? (
              <>
                {account.connection === "pending" ? <Badge variant="warning">Awaiting approval</Badge> : <Badge variant="secondary">Activation requested</Badge>}
                <Button onClick={() => onConnect(account.id)}>
                  <RefreshCw />
                  Check status
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
          {accounts.length > 0 && (
            <Button onClick={() => setAdding(true)}>
              <Plus />
              Add entry
            </Button>
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
              <StatCard
                label="Difference"
                value="—"
                tone="muted"
                sub={account.bankKey ? "Connect the account to compare" : "Upload a statement to compare"}
              />
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
                    ) : e.assumedAccount && accounts.length < 2 ? (
                      // Only one account: nothing to move to, just confirm it's the right one.
                      <Button
                        size="sm"
                        onClick={() => {
                          store().moveEntry(e.id, e.accountId);
                          toast(`${e.ref} confirmed in ${accountName(byId.get(e.accountId)!)}`);
                        }}
                      >
                        <Check />
                        Confirm account
                      </Button>
                    ) : e.assumedAccount ? (
                      <Button
                        size="sm"
                        onClick={(ev) => {
                          const r = ev.currentTarget.getBoundingClientRect();
                          const up = r.bottom + 280 > window.innerHeight;
                          setMoveMenu(
                            moveMenu?.id === e.id
                              ? null
                              : { id: e.id, right: window.innerWidth - r.right, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) },
                          );
                        }}
                      >
                        Move to… <ChevronDown />
                      </Button>
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

      {moveMenu &&
        (() => {
          const e = entries.find((x) => x.id === moveMenu.id);
          if (!e) return null;
          const { id: _id, ...at } = moveMenu;
          return (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMoveMenu(null)} />
              <div style={at} className={cn(popoverCls, "fixed z-50 flex w-72 flex-col p-1 text-left")}>
                <div className="px-2 pb-1.5 pt-1 text-xs text-muted-foreground">
                  Saved without a bank account, so LEDGERS assumed {accountName(byId.get(e.accountId)!)}. Which account did it go through?
                </div>
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    className={menuItemCls}
                    onClick={() => {
                      store().moveEntry(e.id, a.id);
                      setMoveMenu(null);
                      toast(a.id === e.accountId ? `${e.ref} confirmed in ${accountName(a)}` : `${e.ref} moved to ${accountName(a)}`);
                    }}
                  >
                    <span className="truncate">
                      {a.id === e.accountId ? "Keep in " : ""}
                      {accountName(a)}
                      {a.nickname && <span className="text-muted-foreground"> · {a.nickname}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </>
          );
        })()}

      {resolving && (
        <MatchPanel
          key={resolving.id + resolving.status}
          line={resolving}
          accountLabel={accountName(byId.get(resolving.accountId)!)}
          balance={showBalance ? balanceAfter.get(resolving.id) : undefined}
          parties={parties}
          // Open entries, plus whatever the line is matched to now (so a change can keep or swap it).
          openEntries={entries.filter((e) => e.accountId === resolving.accountId && (!e.lineId || e.lineId === resolving.id) && Math.sign(e.amount) === Math.sign(resolving.amount))}
          nextRef={{ receipt: nextRef([...entries, ...cashEntries], "REC"), payment: nextRef([...entries, ...cashEntries], "VOU") }}
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
      {adding && (
        <MatchPanel
          line={{ id: "new", accountId: account?.id ?? accounts[0].id, date: "", narration: "", amount: 0, status: "needs" }}
          accountLabel={account ? accountName(account) : ""}
          parties={parties}
          openEntries={[]}
          nextRef={{ receipt: nextRef([...entries, ...cashEntries], "REC"), payment: nextRef([...entries, ...cashEntries], "VOU") }}
          draft={{
            accounts: account ? [] : accounts.map((a) => ({ id: a.id, label: accountName(a) + (a.nickname ? ` · ${a.nickname}` : "") })),
            onAdd: (id, date, amount, match, opts) => {
              store().addEntry(id, date, amount, match, opts);
              setAdding(false);
              // It's in the books now and waits for the bank: show it there.
              setSide("books");
              setFilter("notinbank");
              toast(`Entry added to ${accountName(byId.get(id)!)}`);
            },
          }}
          onClose={() => setAdding(false)}
          onAccept={() => {}}
          onReject={() => {}}
          onDone={() => {}}
        />
      )}
      {uploading && <UploadStatementDialog account={uploading} onClose={() => setUploading(null)} />}
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
  return <AccountIcon account={account} size={32} />;
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

type Settle = { entryIds?: string[]; party?: string; settle?: { itemId: string; amount: number }[]; transferTo?: string };

function SettleSection({
  title,
  rows,
  picked,
  alloc,
  onToggle,
}: {
  title: string;
  rows: SettleOption[];
  picked: string[];
  alloc: Map<string, number>;
  onToggle: (id: string, isEntry: boolean) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="py-1">
      <div className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {rows.map((x) => (
        <label key={x.id} className={cn("flex cursor-pointer items-center gap-2.5 px-3 py-1.5", picked.includes(x.id) ? "bg-[var(--color-primary-soft)]" : "hover:bg-accent")}>
          <input type="checkbox" checked={picked.includes(x.id)} onChange={() => onToggle(x.id, x.isEntry)} className="size-4 shrink-0 accent-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-2sm font-medium">{x.ref}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {shortDate(x.date)} · {x.note} {fmtINR(x.amount)}
            </span>
          </span>
          {alloc.has(x.id) && <span className="shrink-0 text-2sm tabular-nums">{fmtINR(alloc.get(x.id)!)}</span>}
        </label>
      ))}
    </div>
  );
}

type SettleOption = { id: string; ref: string; date: string; amount: number; note: string; isEntry: boolean };

/**
 * "What does it settle?" as one multi-select field. Collapsed it reads like the answer (REC 2026-66 · ₹1,23,000,
 * 2 invoices · ₹…, or New receipt · ₹…); open, it lists entries and open invoices/bills with a search, and
 * offers a new receipt/payment for the full amount at the top. Floats over the panel so it never pushes it.
 */
function SettlePicker({
  options,
  picked,
  alloc,
  total,
  left,
  isNew,
  allowNew,
  newLabel,
  emptyNote,
  onToggle,
  onNew,
}: {
  options: SettleOption[];
  picked: string[];
  alloc: Map<string, number>;
  total: number;
  left: number;
  isNew: boolean;
  allowNew: boolean;
  newLabel: string;
  emptyNote?: string;
  onToggle: (id: string, isEntry: boolean) => void;
  onNew: () => void;
}) {
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const [q, setQ] = useState("");
  const chosen = options.filter((o) => picked.includes(o.id));
  const lq = q.trim().toLowerCase();
  const shown = lq ? options.filter((o) => o.ref.toLowerCase().includes(lq) || String(o.amount).includes(lq)) : options;
  const entries = shown.filter((o) => o.isEntry);
  const items = shown.filter((o) => !o.isEntry);

  const open = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 16;
    const above = r.top - 16;
    // Open downwards when there's room, else upwards; never taller than the space available.
    setPos(
      below >= 260 || below >= above
        ? { left: r.left, width: r.width, top: r.bottom + 4, maxHeight: Math.min(380, below) }
        : { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(380, above) },
    );
  };

  // Two kinds of answer: link an existing receipt/payment, or create a new one (on account, or against invoices/bills).
  const linking = chosen.some((c) => c.isEntry);
  const label =
    chosen.length === 0 && !isNew ? (
      <span className="text-muted-foreground">Choose…</span>
    ) : linking ? (
      <>
        <Badge variant="secondary">Existing</Badge>
        <span className="truncate font-medium">{chosen.map((c) => c.ref).join(", ")}</span>
      </>
    ) : (
      <>
        <Badge variant="primary">New</Badge>
        <span className="font-medium capitalize">{newLabel.replace("New ", "")}</span>
        <span className="truncate text-muted-foreground">· {chosen.length ? chosen.map((c) => c.ref).join(", ") : "on account"}</span>
      </>
    );

  return (
    <>
      <button
        type="button"
        onClick={(e) => (pos ? setPos(null) : open(e.currentTarget))}
        aria-expanded={!!pos}
        className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-2sm shadow-xs shadow-black/5 hover:bg-accent/40"
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">{label}</span>
        {(isNew || chosen.length > 0) && <span className="shrink-0 font-medium tabular-nums">{fmtINR(linking ? total - left : total)}</span>}
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </button>
      {!pos && !linking && chosen.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {chosen.map((c) => (
            <span key={c.id}>
              {c.ref} <span className="font-medium text-foreground tabular-nums">{fmtINR(alloc.get(c.id) ?? 0)}</span>
            </span>
          ))}
          {left > 0 && (
            <span>
              On account <span className="font-medium text-foreground tabular-nums">{fmtINR(left)}</span>
            </span>
          )}
        </div>
      )}
      {emptyNote && !pos && <div className="mt-1.5 text-xs text-muted-foreground">{emptyNote}</div>}

      {pos && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setPos(null)} />
          <div style={pos} className={cn(popoverCls, "fixed z-[61] flex flex-col overflow-hidden p-0")}>
            {options.length > 3 && (
              <div className="relative shrink-0 border-b border-border p-2">
                <Search className="pointer-events-none absolute start-4.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number or amount" className="h-8 ps-8 text-xs" />
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {allowNew && (
                <button
                  type="button"
                  onClick={() => {
                    onNew();
                    setPos(null);
                  }}
                  className={cn("flex w-full cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2.5 text-left text-2sm", isNew ? "bg-[var(--color-primary-soft)]" : "hover:bg-accent")}
                >
                  <Plus className="size-4 shrink-0 text-primary" />
                  <span className="flex-1">
                    <span className="block font-medium text-primary">{newLabel} on account</span>
                    <span className="block text-xs text-muted-foreground">Or tick {items[0]?.note.startsWith("Bill") ? "bills" : "invoices"} below to set it against them</span>
                  </span>
                  <span className="tabular-nums">{fmtINR(total)}</span>
                </button>
              )}
              <SettleSection title={`${newLabel} against`} rows={items} picked={picked} alloc={alloc} onToggle={onToggle} />
              <SettleSection title={`Existing ${newLabel.replace("New ", "")} · link as is`} rows={entries} picked={picked} alloc={alloc} onToggle={onToggle} />
              {shown.length === 0 && options.length > 0 && <div className="px-3 py-3 text-xs text-muted-foreground">Nothing matches “{q}”.</div>}
            </div>
            {!isNew && picked.length > 0 && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs">
                <span className={left === 0 ? "text-[var(--color-success-accent)]" : "text-muted-foreground"}>
                  {linking
                    ? left === 0
                      ? `Matches ${fmtINR(total)} ✓`
                      : `${fmtINR(total - left)} of ${fmtINR(total)}`
                    : left === 0
                      ? `Fully against invoices ✓`
                      : `On account ${fmtINR(left)}`}
                </span>
                <Button size="sm" variant="primary" onClick={() => setPos(null)}>
                  Done
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

/**
 * Everything about one bank transaction, editable in place: what the AI found and why, who it is (search any
 * contact, or none), what it settles (open invoices/bills, entries already in the books, or a new receipt or
 * payment), and teaching the engine for next time. Opens from a click anywhere on the row.
 */
export function MatchPanel({
  line: given,
  accountLabel,
  balance,
  parties,
  openEntries,
  nextRef,
  draft,
  onClose,
  onAccept,
  onReject,
  onDone: done,
}: {
  line: BankLine;
  accountLabel: string;
  /**
   * Add entry: the same panel with no bank line. In / Out, amount and date replace the line at the top;
   * the account can be picked when more than one is offered. `onDone` gets them back.
   */
  draft?: { accounts: { id: string; label: string }[]; onAdd: (accountId: string, date: string, amount: number, match: Match, opts: Settle) => void };
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
  // Add entry: what the bank line would have said, typed in.
  const [dir, setDir] = useState<1 | -1>(-1);
  const [amountText, setAmountText] = useState("");
  const [day, setDay] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [draftAccount, setDraftAccount] = useState(given.accountId);
  const line: BankLine = draft
    ? { ...given, accountId: draftAccount, amount: dir * (Number(amountText) || 0), date: day.split("-").reverse().join("-") }
    : given;
  const inflow = draft ? dir > 0 : line.amount > 0;
  const total = Math.abs(line.amount);
  const key = narrationKey(line);
  // A transfer goes to one of the company's own accounts: another bank account, or cash.
  const ownBanks = useBankingStore((s) => s.accounts).filter((a) => a.active && a.id !== line.accountId);
  const cashAccounts = useBankingStore((s) => s.cashAccounts).filter((a) => a.active && a.id !== line.accountId);
  // Directors' / owners' own accounts: money they put into (or take from) the company's bank.
  const people = useBankingStore((s) => s.otherAccounts).filter((a) => a.person);
  const isCashLine = !draft && ["Cash withdrawal", "Cash deposit"].includes(describeLine(line));
  const defaultCash = cashAccounts.find((a) => a.isDefault) ?? cashAccounts[0];
  const narr = line.narration.toUpperCase();
  // A gateway payout names the gateway; a card bill payment carries the card's last 4 digits.
  const transferTo =
    isCashLine && defaultCash
      ? defaultCash.id
      : describeLine(line) === "Gateway payout"
        ? ownBanks.find((a) => groupOf(a) === "gateway" && narr.includes(a.bank.toUpperCase()))?.id
        : describeLine(line) === "Card bill payment"
          ? ownBanks.find((a) => groupOf(a) === "card" && a.number && narr.includes(a.number.slice(-4)))?.id
          : undefined;
  // Lines the bank itself makes (charges, interest, tax) have no contact: they open on the account head.
  const headGuess = ({ "Bank charge": "Bank charges", "Interest credit": "Interest income", "Interest charge": "Interest paid", "Tax payment": "GST payable" } as Record<string, string>)[describeLine(line)];
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
    if (transferTo || headGuess) return "none";
    return suggested.length === 1 ? suggested[0].id : null;
  })();

  const [who, setWho] = useState<string | null>(initialWho);
  const [dirty, setDirty] = useState(false);
  const [q, setQ] = useState("");
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
  // Nothing to link → a new receipt/payment for the full amount (number generated, booked on account).
  const [isNew, setIsNew] = useState(() => picked.length === 0);
  const [kind, setKind] = useState<MatchKind>(m && initialWho === "none" ? m.kind : transferTo ? "Transfer" : inflow ? "Journal" : "Expense");
  const guessLedger = headGuess ?? transferTo ?? "";
  // For a transfer, `ledger` holds the other account's id (a bank account or a cash account).
  const [ledger, setLedger] = useState(m && initialWho === "none" ? (m.cashAccountId ?? m.otherAccountId ?? m.ledger ?? guessLedger) : guessLedger);
  const ownName = (id: string) => {
    const c = cashAccounts.find((a) => a.id === id);
    if (c) return c.name;
    const b = ownBanks.find((a) => a.id === id);
    return b ? sharedAccountName(b) : (people.find((a) => a.id === id)?.name ?? id);
  };
  const [remember, setRemember] = useState(true);
  const [fullNarration, setFullNarration] = useState(false);
  const touch = () => setDirty(true);

  const choose = (id: string | null) => {
    touch();
    setWho(id);
    setQ("");
    const next = pickFor(parties.find((x) => x.id === id));
    setPicked(next);
    setIsNew(next.length === 0);
  };

  // Entries already in the books and open invoices/bills are alternatives: linking one excludes the other.
  const pickedEntries = entries.filter((e) => picked.includes(e.id));
  const toggle = (id: string, isEntry: boolean) => {
    touch();
    setIsNew(false);
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
    (!draft || total > 0) &&
    (who === "none" ? ledger !== "" : who === "multi" ? pickedEntries.length > 0 && left === 0 : !!party && (isNew || (picked.length > 0 && (pickedEntries.length === 0 || left === 0))));

  const submit = () => {
    const onDone: typeof done = draft ? (match, opts) => draft.onAdd(line.accountId, line.date, line.amount, match, opts) : done;
    if (who === "none" && kind === "Transfer") {
      // Add entry posts both sides itself; a bank line's cash side goes through the match.
      if (draft) return onDone({ kind, party: ownName(ledger), ledger: "Transfer between accounts" }, { transferTo: ledger });
      const cash = cashAccounts.find((a) => a.id === ledger);
      if (people.some((a) => a.id === ledger)) return onDone({ kind, party: ownName(ledger), ledger: ownName(ledger), otherAccountId: ledger }, {});
      return onDone(cash ? { kind, party: cash.name, ledger: `${CASH_PARENT} › ${cash.name}`, cashAccountId: cash.id } : { kind, party: ownName(ledger), ledger: "Transfer between accounts" }, {});
    }
    if (who === "none") return onDone({ kind, party: draft ? ledger : describeLine(line), ledger }, {});
    if (who === "multi") return onDone(m!, { entryIds: pickedEntries.map((e) => e.id), party: line.party });
    const p = party!;
    const rem = remember && key && !p.keys.includes(key.value) ? { partyId: p.id, key: key.value } : undefined;
    if (isNew)
      return onDone(
        { kind: inflow ? "Receipt" : "Payment voucher", ref: newRef, party: p.name, ledger: "On account" },
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
    const split = [...settled.map((i) => `${i.ref} ${fmtINR(alloc.get(i.id)!)}`), ...(left > 0 ? [`On account ${fmtINR(left)}`] : [])].join(" · ");
    onDone(
      { kind: inflow ? "Receipt" : "Payment voucher", ref: newRef, party: p.name, reason: split },
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
        aria-label={draft ? "Add entry" : "Bank transaction"}
        className="fixed bottom-5 end-5 top-5 z-50 flex w-[500px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg animate-[drawer-in_.4s_cubic-bezier(.4,0,.2,1)]"
      >
        {draft ? (
          /* No bank line: the user says which way, how much and when; the steps below are the same. */
          <div className="shrink-0 border-b border-border px-6 pb-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 text-base font-semibold">Add entry</div>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="-me-2">
                <X />
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-[auto_1fr_1fr] gap-2.5">
              <div role="radiogroup" aria-label="Direction" className="flex h-9 rounded-md border border-input p-0.5">
                {([
                  [1, "In"],
                  [-1, "Out"],
                ] as const).map(([d, label]) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={dir === d}
                    onClick={() => {
                      if (d === dir) return;
                      // Invoices for money in, bills for money out: a pick doesn't carry across.
                      setDir(d);
                      setPicked([]);
                      setIsNew(true);
                      if (kind === "Expense" && d > 0) setKind("Journal");
                    }}
                    className={cn("cursor-pointer rounded px-3 text-2sm font-medium", dir === d ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-accent)]" : "text-muted-foreground hover:text-foreground")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-2sm text-muted-foreground">₹</span>
                <Input autoFocus aria-label="Amount" inputMode="decimal" placeholder="Amount" value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ""))} className="ps-7 tabular-nums" />
              </div>
              <Input type="date" aria-label="Date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            {draft.accounts.length > 1 ? (
              <Select aria-label="Account" value={draftAccount} onChange={(e) => setDraftAccount(e.target.value)} wrapperClassName="mt-2.5">
                {draft.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="mt-2 text-xs text-muted-foreground">{accountLabel}</div>
            )}
          </div>
        ) : (
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
        )}
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
                  <Input autoFocus={!draft} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contact, GSTIN, phone, UPI ID" className="ps-9" />
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
                  {draft ? "No contact: expense, journal, transfer…" : "No contact: bank charge, interest, tax, transfer…"}
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
                    const next = e.target.value as MatchKind;
                    // Transfers pick an account, the others an account head: the choice doesn't carry across.
                    if ((next === "Transfer") !== (kind === "Transfer")) setLedger(next === "Transfer" && transferTo ? transferTo : "");
                    setKind(next);
                  }}
                >
                  {(["Expense", "Journal", "Transfer"] as MatchKind[]).map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </Select>
                {kind === "Transfer" ? (
                  <Select
                    aria-label={inflow ? "From account" : "To account"}
                    value={ledger}
                    onChange={(e) => {
                      touch();
                      setLedger(e.target.value);
                    }}
                  >
                    <option value="">{inflow ? "From account…" : "To account…"}</option>
                    {cashAccounts.length > 0 && (
                      <optgroup label={CASH_PARENT}>
                        {cashAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {people.length > 0 && (
                      <optgroup label="Directors and owners">
                        {people.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {ownBanks.length > 0 && (
                      <optgroup label="Bank accounts">
                        {ownBanks.map((a) => (
                          <option key={a.id} value={a.id}>
                            {ownName(a.id)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Select>
                ) : (
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
                )}
              </div>
            </Step>
          )}

          {(party || who === "multi") && (
            <Step n={2} title="What does it settle?">
              <SettlePicker
                options={options}
                picked={picked}
                alloc={alloc}
                total={total}
                left={left}
                isNew={isNew}
                allowNew={!!party}
                newLabel={`New ${voucher}`}
                emptyNote={party && options.length === 0 ? `No open ${inflow ? "invoices" : "bills"}.` : undefined}
                onToggle={toggle}
                onNew={() => {
                  touch();
                  setIsNew(true);
                  setPicked([]);
                }}
              />
              {pickedEntries.length > 0 && left > 0 && (
                <div className="mt-1.5 text-xs text-[var(--color-warning-accent)]">
                  Short by {fmtINR(left)}: these add up to {fmtINR(total - left)}.
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
              {draft ? "Add entry" : line.status === "needs" ? "Match" : "Save match"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
