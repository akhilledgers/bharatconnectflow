import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Landmark, Search, Sparkles, Undo2, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input, Select } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { tableCls, tdCls, thCls, trCls } from "../../components/ui/table";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { BankIcon } from "./BankLogo";
import { CONNECTED_BANKING, fmtINR, last4, syncedLabel, type CompanyAccount } from "./data";
import { LEDGERS, PARTIES, reconFor, type BankLine, type BookEntry, type Match, type MatchKind } from "./ledgerData";
import { RECONCILED_TO, bankBalanceOf, shortDate } from "./overviewData";
import { OVERLAY } from "./shared";
import { StatCard } from "./StatCard";
import { useEscape } from "./useEscape";

type View = "suggested" | "needs" | "auto" | "books" | "all";

const toast = (m: string) => useStore.getState().pushToast(m, "success");
const accountName = (a: CompanyAccount) => `${a.bankKey ? CONNECTED_BANKING[a.bankKey].short : a.bank} ${last4(a.number)}`;

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

/**
 * Bank statement and books for one account, reconciled by the AI engine. Suggestions are accepted in one
 * click (or in bulk); what the engine couldn't place goes to "Needs you"; book entries the bank hasn't
 * shown sit under "Books only".
 */
export function TransactionsTab({ accountId, onAccountChange }: { accountId: string; onAccountChange: (id: string) => void }) {
  const accounts = useBankingStore((s) => s.accounts).filter((a) => a.active);
  const lines = useBankingStore((s) => s.bankLines);
  const entries = useBankingStore((s) => s.bookEntries);
  const mode = useBankingStore((s) => s.scenario.balance);
  const store = useBankingStore.getState;

  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const recon = reconFor(account.id, lines, entries);
  const bank = bankBalanceOf(account, mode);
  const inBooks = bank ? bank.amount - recon.difference : (account.booksBalance ?? -recon.difference);

  const [view, setView] = useState<View>(recon.suggested ? "suggested" : recon.needs ? "needs" : "all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [resolving, setResolving] = useState<BankLine | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [moveMenu, setMoveMenu] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const matchesQuery = (text: string, amount: number) => !q || text.toLowerCase().includes(q) || String(Math.abs(amount)).includes(q);
  const mine = lines.filter((l) => l.accountId === account.id && matchesQuery(l.narration + (l.match?.party ?? ""), l.amount));
  const rows =
    view === "suggested"
      ? mine.filter((l) => l.status === "suggested")
      : view === "needs"
        ? mine.filter((l) => l.status === "needs")
        : view === "auto"
          ? mine.filter((l) => l.status === "auto")
          : mine;
  const books = recon.booksOnly.filter((e) => matchesQuery(e.ref + e.party, e.amount));

  const VIEWS: { value: View; label: string; count?: number }[] = [
    { value: "suggested", label: "Suggested by AI", count: recon.suggested },
    { value: "needs", label: "Needs you", count: recon.needs },
    { value: "auto", label: "Auto-matched", count: recon.auto },
    { value: "books", label: "Books only", count: recon.booksOnly.length },
    { value: "all", label: "All" },
  ];

  const accept = (ids: string[]) => {
    store().acceptMatches(ids);
    setSelected((s) => s.filter((id) => !ids.includes(id)));
    toast(ids.length === 1 ? "Match accepted" : `${ids.length} matches accepted`);
  };

  const open = recon.suggested + recon.needs + recon.booksOnly.length;
  const visibleIds = rows.map((l) => l.id);
  const allSelected = view === "suggested" && visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  return (
    <div className="flex flex-col gap-4">
      {/* Account + bank vs books */}
      <div className="relative self-start">
        <button
          type="button"
          onClick={() => setSwitcherOpen(!switcherOpen)}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left shadow-xs shadow-black/5 hover:bg-accent"
        >
          <AccountMark account={account} />
          <div>
            <div className="text-2sm font-semibold">{accountName(account)}</div>
            <div className="text-xs text-muted-foreground">{account.nickname || account.bank}</div>
          </div>
          <ChevronDown className="size-4 opacity-60" />
        </button>
        {switcherOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
            <div className={cn(popoverCls, "absolute start-0 top-[calc(100%+4px)] z-50 flex w-72 flex-col gap-0.5 p-1")}>
              {accounts.map((a) => {
                const r = reconFor(a.id, lines, entries);
                const open = r.suggested + r.needs;
                return (
                  <button
                    key={a.id}
                    className={cn(menuItemCls, "justify-between", a.id === account.id && "bg-accent")}
                    onClick={() => {
                      onAccountChange(a.id);
                      setSwitcherOpen(false);
                      setSelected([]);
                      setView(r.suggested ? "suggested" : r.needs ? "needs" : "all");
                    }}
                  >
                    <span className="truncate">
                      {accountName(a)}
                      {a.nickname && <span className="text-muted-foreground"> · {a.nickname}</span>}
                    </span>
                    {open > 0 && <span className="text-xs text-muted-foreground">{open} to review</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
        <StatCard label="In your books" value={fmtINR(inBooks)} tone="purple" sub="Bank Book · as of today" />
        {!bank ? (
          <StatCard label="Difference" value="Can't compare yet" tone="muted" sub="Needs bank data" />
        ) : recon.reconciled ? (
          <StatCard label="Difference" value="Reconciled" tone="good" sub="Books match the bank" />
        ) : (
          <StatCard
            label="Difference"
            value={fmtINR(Math.abs(recon.difference))}
            tone="warn"
            sub={RECONCILED_TO[account.id] ? `Last fully reconciled on ${shortDate(RECONCILED_TO[account.id])}` : "Not reconciled yet"}
          />
        )}
        <StatCard
          label="To review"
          value={!bank ? "—" : open ? `${open} item${open === 1 ? "" : "s"}` : "None"}
          tone={open && bank ? "warn" : "muted"}
          sub={
            !bank
              ? "Matching starts once bank data is in"
              : open
              ? [recon.suggested && `${recon.suggested} by AI`, recon.needs && `${recon.needs} need you`, recon.booksOnly.length && `${recon.booksOnly.length} books only`]
                  .filter(Boolean)
                  .join(" · ")
              : "Nothing left to match"
          }
        />
      </div>

      <Card className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div role="tablist" className="flex flex-wrap gap-1">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                role="tab"
                aria-selected={view === v.value}
                onClick={() => {
                  setView(v.value);
                  setSelected([]);
                }}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-2sm text-muted-foreground hover:bg-accent hover:text-foreground",
                  view === v.value && "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary",
                )}
              >
                {v.value === "suggested" && <Sparkles className="size-3.5" />}
                {v.label}
                {v.count !== undefined && <span className="tabular-nums opacity-70">{v.count}</span>}
              </button>
            ))}
          </div>
          <div className="relative w-56">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="txn-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search narration, party, amount" className="ps-9" />
          </div>
        </div>

        {view === "suggested" && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[var(--color-primary-soft)]/60 px-5 py-2.5 text-xs">
            <span className="text-[var(--color-primary-accent)]">
              The AI engine matched these from amounts, references and past behaviour. Check and accept.
            </span>
            <div className="flex gap-2">
              {selected.length > 0 && (
                <Button size="sm" onClick={() => accept(selected)}>
                  <Check />
                  Accept selected ({selected.length})
                </Button>
              )}
              <Button size="sm" variant="primary" onClick={() => accept(visibleIds)}>
                <Check />
                Accept all {visibleIds.length}
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {view === "books" ? (
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={cn(thCls, "w-28")}>Date</th>
                  <th className={thCls}>Entry in your books</th>
                  <th className={cn(thCls, "w-40 text-right")}>Amount</th>
                  <th className={thCls}>Why it's open</th>
                  <th className={cn(thCls, "w-40")} />
                </tr>
              </thead>
              <tbody>
                {books.map((e) => (
                  <BooksRow
                    key={e.id}
                    entry={e}
                    accounts={accounts}
                    menuOpen={moveMenu === e.id}
                    onMenu={(o) => setMoveMenu(o ? e.id : null)}
                    onMove={(id) => {
                      store().moveEntry(e.id, id);
                      setMoveMenu(null);
                      toast(`${e.ref} moved to ${accountName(accounts.find((a) => a.id === id)!)}`);
                    }}
                  />
                ))}
                {books.length === 0 && <Empty>Every entry in your books has shown up at the bank.</Empty>}
              </tbody>
            </table>
          ) : (
            <table className={tableCls}>
              <thead>
                <tr>
                  {view === "suggested" && (
                    <th className={cn(thCls, "w-10 pe-0")}>
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? [] : visibleIds)}
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </th>
                  )}
                  <th className={cn(thCls, "w-28")}>Date</th>
                  <th className={thCls}>Bank transaction</th>
                  <th className={cn(thCls, "w-36 text-right")}>Amount</th>
                  <th className={thCls}>{view === "needs" ? "" : "Matched to"}</th>
                  <th className={cn(thCls, "w-44")} />
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className={trCls}>
                    {view === "suggested" && (
                      <td className={cn(tdCls, "pe-0")}>
                        <input
                          type="checkbox"
                          aria-label="Select"
                          checked={selected.includes(l.id)}
                          onChange={() => setSelected((s) => (s.includes(l.id) ? s.filter((x) => x !== l.id) : [...s, l.id]))}
                          className="size-4 cursor-pointer accent-primary"
                        />
                      </td>
                    )}
                    <td className={cn(tdCls, "tabular-nums text-muted-foreground")}>{l.date}</td>
                    <td className={cn(tdCls, "max-w-0")}>
                      <div className="truncate" title={l.narration}>
                        {l.narration}
                      </div>
                    </td>
                    <td className={cn(tdCls, "text-right")}>
                      <Amount value={l.amount} />
                    </td>
                    <td className={cn(tdCls, "max-w-0")}>
                      {l.match ? (
                        <div className="flex items-center gap-2.5">
                          {l.status === "suggested" && l.match.confidence && (
                            <span
                              className={cn(
                                "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                                l.match.confidence >= 90
                                  ? "bg-[var(--color-success-soft)] text-[var(--color-success-accent)]"
                                  : "bg-[var(--color-primary-soft)] text-[var(--color-primary-accent)]",
                              )}
                            >
                              {l.match.confidence}%
                            </span>
                          )}
                          <MatchText m={l.match} />
                        </div>
                      ) : view === "all" ? (
                        <Badge variant="warning">Needs you</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No match found</span>
                      )}
                    </td>
                    <td className={cn(tdCls, "text-right")}>
                      {l.status === "suggested" ? (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" onClick={() => accept([l.id])}>
                            <Check />
                            Accept
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Not this match"
                            title="Not this match"
                            onClick={() => {
                              store().rejectMatch(l.id);
                              toast("Moved to Needs you");
                            }}
                          >
                            <X />
                          </Button>
                        </div>
                      ) : l.status === "needs" ? (
                        <Button size="sm" variant="primary" onClick={() => setResolving(l)}>
                          Match or record
                        </Button>
                      ) : l.status === "auto" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            store().rejectMatch(l.id);
                            toast("Match undone · moved to Needs you");
                          }}
                        >
                          <Undo2 />
                          Undo
                        </Button>
                      ) : (
                        <Badge variant="success">Matched</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <Empty colSpan={view === "suggested" ? 6 : 5}>
                    {view === "suggested"
                      ? "No suggestions waiting. New bank transactions are matched as they arrive."
                      : view === "needs"
                        ? "Nothing needs you on this account."
                        : view === "auto"
                          ? "Nothing was auto-matched yet."
                          : !bank && !q
                            ? account.bankKey
                              ? "No bank transactions yet. Connect the account to bring them in."
                              : "No bank transactions yet. Upload a statement to bring them in."
                            : "No transactions match your search."}
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
          candidates={entries.filter((e) => e.accountId === account.id && Math.sign(e.amount) === Math.sign(resolving.amount))}
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

function AccountMark({ account }: { account: CompanyAccount }) {
  return account.bankKey ? (
    <BankIcon bank={account.bankKey} size={32} />
  ) : (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <Landmark className="size-4" />
    </span>
  );
}

function Empty({ children, colSpan = 5 }: { children: ReactNode; colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn(tdCls, "py-10 text-center text-muted-foreground")}>
        {children}
      </td>
    </tr>
  );
}

function BooksRow({
  entry: e,
  accounts,
  menuOpen,
  onMenu,
  onMove,
}: {
  entry: BookEntry;
  accounts: CompanyAccount[];
  menuOpen: boolean;
  onMenu: (open: boolean) => void;
  onMove: (accountId: string) => void;
}) {
  return (
    <tr className={trCls}>
      <td className={cn(tdCls, "tabular-nums text-muted-foreground")}>{e.date}</td>
      <td className={tdCls}>
        <div className="font-medium">
          {e.ref} <span className="font-normal text-muted-foreground">· {e.kind}</span>
        </div>
        <div className="text-xs text-muted-foreground">{e.party}</div>
      </td>
      <td className={cn(tdCls, "text-right")}>
        <Amount value={e.amount} />
      </td>
      <td className={tdCls}>
        <div className="flex flex-wrap items-center gap-2">
          {e.assumedAccount && <Badge variant="warning">Account assumed</Badge>}
          <span className="text-2sm">{e.note}</span>
        </div>
        <div className="text-xs text-muted-foreground">Open for {e.daysOpen} days</div>
      </td>
      <td className={cn(tdCls, "text-right")}>
        {e.assumedAccount ? (
          <div className="relative inline-block">
            <Button size="sm" onClick={() => onMenu(!menuOpen)}>
              Move to… <ChevronDown />
            </Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => onMenu(false)} />
                <div className={cn(popoverCls, "absolute end-0 top-full z-20 mt-1 flex w-56 flex-col p-1 text-left")}>
                  {accounts
                    .filter((a) => a.id !== e.accountId)
                    .map((a) => (
                      <button key={a.id} className={menuItemCls} onClick={() => onMove(a.id)}>
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
