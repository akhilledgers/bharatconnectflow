import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Clock,
  FileUp,
  Landmark,
  Plug,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { Badge, type BadgeVariant } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/cn";
import { useBankingStore } from "../../store/useBankingStore";
import { BalanceTrend } from "./BalanceTrend";
import { BankIcon } from "./BankLogo";
import { CONNECTED_BANKING, fmtINR, last4, syncedLabel, type CompanyAccount } from "./data";
import {
  BOOKS_ONLY_BALANCE,
  IN_FLIGHT,
  MONEY_FLOW,
  RECON,
  balanceTrend,
  bankBalanceOf,
  compactINR,
  daysSince,
  type PayoutStatus,
} from "./overviewData";

const ATTENTION_LIMIT = 5;

export type OverviewTarget = "statements" | "accounts" | "payouts";

const shortDate = (dmy: string) => {
  const [d, m, y] = dmy.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const accountLabel = (a: CompanyAccount) => `${a.bankKey ? CONNECTED_BANKING[a.bankKey].short : a.bank} ${last4(a.number)}`;

/**
 * Banking landing page. Top half answers the owner ("how much money, where, what's moving"); the
 * bottom half answers the accountant ("does the bank agree with our books, what needs me").
 */
export function OverviewTab({
  onGo,
  onConnect,
  onPay,
  onBulkPay,
}: {
  onGo: (tab: OverviewTarget) => void;
  onConnect: (accountId: string) => void;
  onPay: () => void;
  onBulkPay: () => void;
}) {
  const accounts = useBankingStore((s) => s.accounts).filter((a) => a.active);
  const [showAll, setShowAll] = useState(false);
  const mode = useBankingStore((s) => s.scenario.balance);

  const rows = accounts.map((a) => {
    const bank = bankBalanceOf(a, mode);
    const recon = RECON[a.id];
    const books = bank ? bank.amount - (recon?.difference ?? 0) : (BOOKS_ONLY_BALANCE[a.id] ?? null);
    return { a, bank, recon, books };
  });

  const live = rows.filter((r) => r.bank?.source === "live");
  const fromStatements = rows.filter((r) => r.bank?.source === "statement");
  const stale = rows.filter((r) => r.bank?.source === "stale");
  const totalInBank = rows.reduce((s, r) => s + (r.bank?.amount ?? 0), 0);
  const totalInBooks = rows.reduce((s, r) => s + (r.books ?? 0), 0);

  const withGap = rows.filter((r) => r.recon && r.recon.difference !== 0);
  const toExplain = withGap.reduce((s, r) => s + Math.abs(r.recon!.difference), 0);
  const bankOnly = rows.reduce((acc, r) => ({ count: acc.count + (r.recon?.bankOnly.count ?? 0), amount: acc.amount + (r.recon?.bankOnly.amount ?? 0) }), { count: 0, amount: 0 });
  const booksOnly = rows.reduce((acc, r) => ({ count: acc.count + (r.recon?.booksOnly.count ?? 0), amount: acc.amount + (r.recon?.booksOnly.amount ?? 0) }), { count: 0, amount: 0 });
  const suggestions = rows.reduce((s, r) => s + (r.recon?.suggestions ?? 0), 0);
  const reconciledCount = rows.filter((r) => r.bank && r.recon && r.recon.difference === 0 && r.recon.bankOnly.count === 0 && r.recon.booksOnly.count === 0).length;
  const withBank = rows.filter((r) => r.bank).length;

  const trend = balanceTrend(totalInBank);
  const pct = (now: number, prev: number) => Math.round(((now - prev) / prev) * 1000) / 10;

  // ---- needs attention ----
  type Item = { key: string; tone: "critical" | "warning" | "info"; icon: ReactNode; title: string; detail: string; action: string; run: () => void };
  const items: Item[] = [];
  for (const p of IN_FLIGHT.filter((p) => p.status === "failed"))
    items.push({ key: p.id, tone: "critical", icon: <XCircle />, title: `Payment to ${p.name} failed · ${fmtINR(p.amount)}`, detail: p.note, action: "View", run: () => onGo("payouts") });
  for (const r of rows.filter((r) => r.a.connection === "expired"))
    items.push({
      key: `exp-${r.a.id}`,
      tone: "warning",
      icon: <RefreshCw />,
      title: `${accountLabel(r.a)}${r.a.nickname ? ` (${r.a.nickname})` : ""} connection expired`,
      detail: `Balance and statements stopped syncing ${syncedLabel(r.a.syncedMinutesAgo ?? 0)}.`,
      action: "Reconnect",
      run: () => onConnect(r.a.id),
    });
  const awaiting = IN_FLIGHT.filter((p) => p.status === "awaiting");
  if (awaiting.length)
    items.push({
      key: "awaiting",
      tone: "warning",
      icon: <Clock />,
      title: `${awaiting.length} payout${awaiting.length > 1 ? "s" : ""} waiting for checker approval · ${fmtINR(awaiting.reduce((s, p) => s + p.amount, 0))}`,
      detail: "The checker approves these in net banking. They go out once approved.",
      action: "View",
      run: () => onGo("payouts"),
    });
  if (suggestions)
    items.push({
      key: "ai",
      tone: "info",
      icon: <Sparkles />,
      title: `${suggestions} matches suggested by AI`,
      detail: "Bank transactions matched to receipts, vouchers and bills. Review and accept in one click.",
      action: "Review",
      run: () => onGo("statements"),
    });
  for (const r of rows.filter((r) => r.bank?.source === "statement" && r.a.statement && daysSince(r.a.statement.date) > 7))
    items.push({
      key: `stmt-${r.a.id}`,
      tone: "info",
      icon: <FileUp />,
      title: `${accountLabel(r.a)} statement is ${daysSince(r.a.statement!.date)} days old`,
      detail: "Upload the latest statement to keep its balance and reconciliation current.",
      action: "Upload",
      run: () => onGo("accounts"),
    });
  for (const r of rows.filter((r) => r.a.bankKey && r.a.connection === "none"))
    items.push({
      key: `conn-${r.a.id}`,
      tone: "info",
      icon: <Plug />,
      title: `Connect ${accountLabel(r.a)}${r.a.nickname ? ` (${r.a.nickname})` : ""}`,
      detail: "Pay from LEDGERS and sync balance and statements automatically.",
      action: "Connect",
      run: () => onConnect(r.a.id),
    });
  const unverified = rows.filter((r) => !r.a.verified && !(r.a.bankKey && r.a.connection === "none")).length;
  if (unverified)
    items.push({
      key: "verify",
      tone: "info",
      icon: <ShieldCheck />,
      title: `${unverified} account${unverified > 1 ? "s" : ""} not verified`,
      detail: "An instant check with the bank. No money is moved.",
      action: "Verify",
      run: () => onGo("accounts"),
    });

  const TONE = {
    critical: "bg-[var(--color-destructive-soft)] text-[var(--color-destructive-accent)]",
    warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning-accent)]",
    info: "bg-[var(--color-primary-soft)] text-[var(--color-primary-accent)]",
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Banking overview</h1>
          <p className="text-xs text-muted-foreground">
            All active accounts · as of {new Date().toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={() => onGo("accounts")}>
            <FileUp />
            Upload statement
          </Button>
          <Button onClick={onBulkPay}>
            <Users />
            Bulk pay
          </Button>
          <Button variant="primary" onClick={onPay}>
            <Send />
            Pay someone
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Owner: cash */}
        <Card className="min-w-0 gap-4 p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-sm font-medium text-muted-foreground">Cash in bank</div>
              <div className="mt-1 text-[28px] font-semibold leading-tight tracking-tight tabular-nums">{fmtINR(totalInBank)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {[
                  live.length && `Live from ${live.length} connected account${live.length > 1 ? "s" : ""}`,
                  fromStatements.length && `${compactINR(fromStatements.reduce((s, r) => s + r.bank!.amount, 0))} from statements`,
                  stale.length && `${compactINR(stale.reduce((s, r) => s + r.bank!.amount, 0))} last known (connection expired)`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <div className="flex gap-6">
              <FlowStat label="Money in this month" icon={<ArrowDownLeft />} now={MONEY_FLOW.in.now} prev={MONEY_FLOW.in.prev} change={pct(MONEY_FLOW.in.now, MONEY_FLOW.in.prev)} />
              <FlowStat label="Money out this month" icon={<ArrowUpRight />} now={MONEY_FLOW.out.now} prev={MONEY_FLOW.out.prev} change={pct(MONEY_FLOW.out.now, MONEY_FLOW.out.prev)} />
            </div>
          </div>
          <BalanceTrend points={trend} />
        </Card>

        {/* Accountant: bank vs books */}
        <Card className="min-w-0 gap-4 p-5">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Bank vs your books</div>
            {toExplain ? (
              <>
                <div className="mt-1 text-[28px] font-semibold leading-tight tracking-tight tabular-nums text-[var(--color-warning-accent)]">{fmtINR(toExplain)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  to explain across {withGap.length} account{withGap.length > 1 ? "s" : ""}
                </div>
              </>
            ) : (
              <div className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-[var(--color-success-accent)]">All agree</div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md bg-muted/70 px-3 py-2">
              <dt className="text-muted-foreground">In bank</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">{compactINR(totalInBank)}</dd>
            </div>
            <div className="rounded-md bg-muted/70 px-3 py-2">
              <dt className="text-muted-foreground">In your books</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">{compactINR(totalInBooks)}</dd>
            </div>
          </dl>

          <ul className="flex flex-col divide-y divide-border text-2sm">
            <li className="flex items-center justify-between gap-3 py-2">
              <span>Bank transactions not in books</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {bankOnly.count} · {compactINR(bankOnly.amount)}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 py-2">
              <span>Book entries not seen at bank</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {booksOnly.count} · {compactINR(booksOnly.amount)}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 py-2">
              <span>Accounts fully reconciled</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {reconciledCount} of {withBank}
              </span>
            </li>
          </ul>

          <Button className="mt-auto w-full" variant={suggestions ? "primary" : "outline"} onClick={() => onGo("statements")}>
            <Sparkles />
            {suggestions ? `Review ${suggestions} AI matches` : "Open transactions"}
          </Button>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <div className="text-sm font-semibold">Needs attention</div>
            {items.length > 0 && <span className="text-xs text-muted-foreground">{items.length} items</span>}
          </div>
          {items.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-8 text-2sm text-muted-foreground">
              <ShieldCheck className="size-5 text-[var(--color-success-accent)]" /> Nothing needs you right now.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(showAll ? items : items.slice(0, ATTENTION_LIMIT)).map((it) => (
                <li key={it.key} className="flex items-center gap-3 px-5 py-3">
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4", TONE[it.tone])}>{it.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-2sm font-medium text-foreground">{it.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{it.detail}</div>
                  </div>
                  <Button size="sm" className="shrink-0" onClick={it.run}>
                    {it.action}
                  </Button>
                </li>
              ))}
              {items.length > ATTENTION_LIMIT && (
                <li className="px-5 py-2.5">
                  <button type="button" onClick={() => setShowAll(!showAll)} className="cursor-pointer text-xs font-medium text-primary hover:underline">
                    {showAll ? "Show fewer" : `Show ${items.length - ATTENTION_LIMIT} more`}
                  </button>
                </li>
              )}
            </ul>
          )}
        </Card>

        <Card className="min-w-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <div className="text-sm font-semibold">Payouts in progress</div>
            <button type="button" onClick={() => onGo("payouts")} className="inline-flex cursor-pointer items-center gap-0.5 text-xs font-medium text-primary hover:underline">
              View all <ChevronRight className="size-3.5" />
            </button>
          </div>
          <ul className="divide-y divide-border">
            {IN_FLIGHT.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-2sm font-medium">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.detail} · {p.from}
                  </div>
                  <div className="mt-1.5">
                    <PayoutChip status={p.status} />
                  </div>
                </div>
                <div className="shrink-0 text-2sm font-semibold tabular-nums">{fmtINR(p.amount)}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="text-sm font-semibold">Accounts</div>
          <button type="button" onClick={() => onGo("accounts")} className="inline-flex cursor-pointer items-center gap-0.5 text-xs font-medium text-primary hover:underline">
            Manage accounts <ChevronRight className="size-3.5" />
          </button>
        </div>
        <div className="-mb-px -me-px grid sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ a, bank, recon, books }) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onGo("statements")}
              className="flex cursor-pointer flex-col gap-3 border-b border-e border-border bg-card px-5 py-4 text-left hover:bg-accent/40"
            >
              <div className="flex items-center gap-3">
                {a.bankKey ? (
                  <BankIcon bank={a.bankKey} size={32} />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Landmark className="size-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate text-2sm font-medium">{a.bank}</div>
                  <div className="truncate text-xs text-muted-foreground">{[a.nickname, `${a.type} ${last4(a.number)}`].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">In bank</div>
                  <div className="text-base font-semibold tabular-nums">{bank ? fmtINR(bank.amount) : "—"}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">In books</div>
                  <div className="text-2sm tabular-nums text-muted-foreground">{books !== null ? fmtINR(books) : "—"}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {bank?.source === "live"
                    ? `Live · ${a.syncedMinutesAgo ? syncedLabel(a.syncedMinutesAgo) : "just now"}`
                    : bank?.source === "stale"
                      ? "Connection expired"
                      : bank?.source === "statement"
                        ? `Statement · ${shortDate(a.statement!.date)}`
                        : "No bank data yet"}
                </span>
                {!bank ? null : recon && recon.difference !== 0 ? (
                  <Badge variant="warning">Differs by {compactINR(Math.abs(recon.difference))}</Badge>
                ) : recon?.reconciledTo ? (
                  <Badge variant="success">Reconciled to {shortDate(recon.reconciledTo)}</Badge>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function FlowStat({ label, icon, now, prev, change }: { label: string; icon: ReactNode; now: number; prev: number; change: number }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{compactINR(now)}</div>
      <div className="text-xs text-muted-foreground tabular-nums">
        {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs {compactINR(prev)} last month
      </div>
    </div>
  );
}

const PAYOUT_CHIP: Record<PayoutStatus, { label: string; variant: BadgeVariant; icon: ReactNode }> = {
  awaiting: { label: "Awaiting approval", variant: "warning", icon: <Clock /> },
  processing: { label: "Processing", variant: "secondary", icon: <RefreshCw /> },
  failed: { label: "Failed", variant: "destructive", icon: <AlertTriangle /> },
};

function PayoutChip({ status }: { status: PayoutStatus }) {
  const c = PAYOUT_CHIP[status];
  return (
    <Badge variant={c.variant}>
      {c.icon}
      {c.label}
    </Badge>
  );
}
