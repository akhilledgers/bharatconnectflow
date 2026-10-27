import { Fragment, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Clock, Gauge, FileUp, Landmark, Plug, Plus, RefreshCw, ShieldCheck, Sparkles, Undo2, UserRound, Wallet, XCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle } from "../../components/ui/card";
import { cn } from "../../lib/cn";
import { useBankingStore } from "../../store/useBankingStore";
import { AccountIcon, BankIcon } from "./BankLogo";
import { ALL_ACCOUNTS, CONNECTED_BANKING, GROUP_LABEL, GROUP_ORDER, ONBOARDING_BANKS, accountName, creditUse, fmtINR, groupOf, isCredit, isDeposit, last4, syncedLabel } from "./data";
import { approvalPlace } from "./bankConnectors";
import { reconFor } from "./ledgerData";
import { RECONCILED_TO, bankBalanceOf, compactINR, daysSince, shortDate } from "./overviewData";
import { StatCard, StatLink } from "./StatCard";
import { SyncBadge } from "./SyncBadge";
import { CASH_ALL, CASH_PARENT, cashBalance } from "./cash";
import type { BankingTab } from "./BankingPage";

/** Needs attention is grouped: one row per kind of work, opened on click, so the card stays short. */
type AttentionGroup = "payments" | "balances" | "reconcile" | "connections";
const ATTENTION_GROUPS: { key: AttentionGroup; label: string }[] = [
  { key: "payments", label: "Payments" },
  { key: "balances", label: "Balances and limits" },
  { key: "reconcile", label: "To reconcile" },
  { key: "connections", label: "Bank connections" },
];
const TONE_RANK = { critical: 0, warning: 1, info: 2 } as const;

const accountLabel = accountName;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "▲ 18.5% vs last month" */
function trend(now: number, prev: number) {
  const pct = Math.round(((now - prev) / prev) * 1000) / 10;
  return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs last month`;
}

/** The date a connection stopped syncing, from how long ago it last synced. */
function syncedOn(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Banking landing page: four stat cards (three for the owner, one for the accountant), then Needs attention
 * and Accounts given equal weight. A business with no bank account yet sees a set-up card instead.
 */
export function OverviewTab({
  onGo,
  onOpenAccount,
  onConnect,
  onAddAccount,
  onOpenNewAccount,
}: {
  onGo: (tab: BankingTab) => void;
  onOpenAccount: (accountId: string) => void;
  onConnect: (accountId: string) => void;
  onAddAccount: () => void;
  onOpenNewAccount: () => void;
}) {
  const accounts = useBankingStore((s) => s.accounts).filter((a) => a.active);
  const lines = useBankingStore((s) => s.bankLines);
  const entries = useBankingStore((s) => s.bookEntries);
  const payouts = useBankingStore((s) => s.payouts);
  const imports = useBankingStore((s) => s.imports);
  const flow = useBankingStore((s) => s.moneyFlow);
  const cashAccounts = useBankingStore((s) => s.cashAccounts).filter((a) => a.active);
  const cashEntries = useBankingStore((s) => s.cashEntries);
  const otherAccounts = useBankingStore((s) => s.otherAccounts);
  const otherEntries = useBankingStore((s) => s.otherEntries);
  const { balance: mode, overviewLayout } = useBankingStore((s) => s.scenario);
  const split = overviewLayout === "split";
  const [openGroup, setOpenGroup] = useState<AttentionGroup | null>(null);

  if (accounts.length === 0) return <SetUpBanking onAddAccount={onAddAccount} onOpenNewAccount={onOpenNewAccount} />;

  const rows = accounts.map((a) => ({ a, bank: bankBalanceOf(a, mode), recon: reconFor(a.id, lines, entries) }));
  const withBank = rows.filter((r) => r.bank);
  const deposits = withBank.filter((r) => isDeposit(r.a));
  const totalInBank = deposits.reduce((s, r) => s + r.bank!.amount, 0);
  // Borrowing on OD / CC: what's used, and what's left where a limit was given.
  const odcc = withBank.filter((r) => isCredit(r.a) && groupOf(r.a) === "bank").map((r) => creditUse(r.a, r.bank!.amount));
  const odccUsed = odcc.reduce((s, u) => s + u.used, 0);
  const odccLeft = odcc.reduce((s, u) => s + Math.max(0, u.available ?? 0), 0);
  const odccHasLimit = odcc.some((u) => u.limit !== undefined);
  const gapAccounts = withBank.filter((r) => !r.recon.reconciled && r.recon.difference !== 0);
  const toExplain = gapAccounts.reduce((s, r) => s + Math.abs(r.recon.difference), 0);
  const toReview = gapAccounts.reduce((s, r) => s + r.recon.suggested + r.recon.needs + r.recon.booksOnly.length, 0);
  const suggestions = rows.reduce((s, r) => s + r.recon.suggested, 0);
  const needsYou = rows.reduce((s, r) => s + r.recon.needs, 0);
  // Review work across accounts lands on All accounts; with one account, on that account.
  const review = () => onOpenAccount(rows.length === 1 ? rows[0].a.id : ALL_ACCOUNTS);
  const count = (src: "live" | "stale" | "statement") => deposits.filter((r) => r.bank!.source === src).length;
  const stale = deposits.filter((r) => r.bank!.source === "stale");
  const allStale = deposits.length > 0 && stale.length === deposits.length;
  // Cash in hand: each cash account's book balance, and their total.
  const cash = cashAccounts.map((c) => ({ c, balance: cashBalance(c, cashEntries) }));
  const cashInHand = cash.reduce((s, x) => s + x.balance, 0);

  // ---- Cash in bank ----
  let cashSub: ReactNode;
  if (!deposits.length) cashSub = rows.some((r) => r.a.bankKey) ? "Connect your bank to see it" : "Upload a statement to see it";
  else if (deposits.length === 1) {
    const { a, bank } = deposits[0];
    cashSub =
      bank!.source === "live"
        ? `Live · synced ${a.syncedMinutesAgo ? syncedLabel(a.syncedMinutesAgo) : "just now"}`
        : bank!.source === "stale"
          ? `Last known · expired ${syncedLabel(a.syncedMinutesAgo ?? 0)}`
          : `As per statement · ${shortDate(a.statement!.date)}`;
  } else
    cashSub = [
      count("live") && `${count("live")} live`,
      count("statement") && `${count("statement")} by statement`,
      count("stale") && `${count("stale")} expired`,
    ]
      .filter(Boolean)
      .join(" · ");

  // ---- Money in / out: from the bank where there's bank data, otherwise from the Bank Book ----
  const flowSource = !withBank.length ? "From your books · " : allStale ? `Till ${syncedOn(Math.min(...stale.map((r) => r.a.syncedMinutesAgo ?? 0)))} · ` : "";

  // ---- Books vs bank ----
  const reconciledTo = withBank.some((r) => r.bank!.source === "live")
    ? "today"
    : withBank.map((r) => r.a.statement?.date ?? RECONCILED_TO[r.a.id]).filter(Boolean).map((d) => shortDate(d!))[0];

  // ---- Needs attention, most urgent first ----
  type Item = { key: string; tone: "critical" | "warning" | "info"; icon: ReactNode; title: string; detail: string; action: string; run: () => void };
  const items: Item[] = [];
  const retried = new Set(payouts.map((p) => p.retryOf).filter(Boolean));
  for (const p of payouts.filter((p) => ["failed", "rejected", "returned"].includes(p.status) && !retried.has(p.id)))
    items.push({
      key: p.id,
      tone: "critical",
      icon: p.status === "returned" ? <Undo2 /> : <XCircle />,
      title: `Payment to ${p.name} ${p.status} · ${fmtINR(p.amount)}`,
      detail: p.reason ?? "",
      action: "View",
      run: () => onGo("payouts"),
    });
  for (const r of withBank.filter((r) => isCredit(r.a) && r.a.limit)) {
    const u = creditUse(r.a, r.bank!.amount);
    if (!u.over && !u.near) continue;
    items.push({
      key: `limit-${r.a.id}`,
      tone: u.over ? "critical" : "warning",
      icon: <Gauge />,
      title: u.over ? `${accountLabel(r.a)} is over its limit by ${fmtINR(-u.available!)}` : `${accountLabel(r.a)} has ${fmtINR(u.available!)} left`,
      detail: `${fmtINR(u.used)} used of ${fmtINR(u.limit!)}${r.a.type === "Credit card" ? " credit limit" : " limit"}.`,
      action: "View",
      run: () => onOpenAccount(r.a.id),
    });
  }
  // Cash can't really go below zero: a negative book balance means an entry is missing or wrong.
  for (const { c, balance } of cash.filter((x) => x.balance < 0))
    items.push({
      key: `cash-${c.id}`,
      tone: "critical",
      icon: <Wallet />,
      title: `${c.name} is below zero · ${fmtINR(balance)}`,
      detail: "Cash can't be negative: an entry is missing or recorded twice.",
      action: "Open cash book",
      run: () => onOpenAccount(c.id),
    });
  // Money received in a director's or owner's own account stays flagged until it reaches the company's bank.
  for (const p of otherAccounts.filter((a) => a.person)) {
    const held = otherEntries.filter((e) => e.accountId === p.id).reduce((s, e) => s + e.amount, 0);
    if (held > 0)
      items.push({
        key: `person-${p.id}`,
        tone: "warning",
        icon: <UserRound />,
        title: `${fmtINR(held)} with ${p.name}`,
        detail: "Received in their account, not in the bank yet. Match it when they transfer it.",
        action: "Review",
        run: review,
      });
    // They paid company bills from their own money: the company owes it back.
    else if (held < 0)
      items.push({
        key: `person-${p.id}`,
        tone: "info",
        icon: <UserRound />,
        title: `You owe ${p.name} ${fmtINR(-held)}`,
        detail: "They paid company expenses from their own account.",
        action: "Review",
        run: review,
      });
  }
  for (const r of rows.filter((r) => r.a.bankKey && r.a.connection === "pending"))
    items.push({
      key: `pending-${r.a.id}`,
      tone: "warning",
      icon: <ShieldCheck />,
      title: `Approve LEDGERS in ${approvalPlace(r.a.bankKey!)}`,
      detail: `${accountLabel(r.a)} is connected but waiting for your approval. Payouts and sync start after that.`,
      action: "Check",
      run: () => onConnect(r.a.id),
    });
  for (const r of rows.filter((r) => r.a.bankKey && r.a.connection === "requested"))
    items.push({
      key: `requested-${r.a.id}`,
      tone: "info",
      icon: <Clock />,
      title: `${CONNECTED_BANKING[r.a.bankKey!].short} is activating account ${last4(r.a.number)}`,
      detail: `Then approve LEDGERS in ${approvalPlace(r.a.bankKey!)}.`,
      action: "Check",
      run: () => onConnect(r.a.id),
    });
  for (const r of rows.filter((r) => r.a.connection === "expired"))
    items.push({
      key: `exp-${r.a.id}`,
      tone: "warning",
      icon: <RefreshCw />,
      title: `${accountLabel(r.a)}${r.a.nickname ? ` (${r.a.nickname})` : ""} connection expired`,
      detail: `Balance and statements stopped syncing ${syncedLabel(r.a.syncedMinutesAgo ?? 0)}. Payouts from this account are paused.`,
      action: "Reconnect",
      run: () => onConnect(r.a.id),
    });
  const awaiting = payouts.filter((p) => p.status === "awaiting");
  if (awaiting.length)
    items.push({
      key: "awaiting",
      tone: "warning",
      icon: <Clock />,
      title: `${plural(awaiting.length, "payout")} waiting for checker approval · ${fmtINR(awaiting.reduce((s, p) => s + p.amount, 0))}`,
      detail: "The checker approves these in net banking. They go out once approved.",
      action: "View",
      run: () => onGo("payouts"),
    });
  if (suggestions + needsYou)
    items.push({
      key: "ai",
      tone: "info",
      icon: <Sparkles />,
      title: suggestions ? `${suggestions} matches suggested by AI${needsYou ? ` · ${needsYou} unmatched` : ""}` : `${plural(needsYou, "bank transaction")} unmatched`,
      detail: "Bank transactions paired with receipts, vouchers and bills. Accept in one click.",
      action: "Review",
      run: review,
    });
  // Statement-only banks (API banks get "Connect" below instead).
  for (const r of rows.filter((r) => !r.a.bankKey)) {
    const latest = imports.find((i) => i.accountId === r.a.id);
    const failed = latest?.status === "failed" ? latest : undefined;
    if (!failed && r.a.statement && daysSince(r.a.statement.date) <= 7) continue;
    items.push({
      key: `stmt-${r.a.id}`,
      tone: failed ? "warning" : "info",
      icon: <FileUp />,
      title: failed
        ? `Statement import failed for ${accountLabel(r.a)}`
        : r.a.statement
          ? `${accountLabel(r.a)} statement is ${daysSince(r.a.statement.date)} days old`
          : `Upload a statement for ${accountLabel(r.a)}`,
      detail: failed?.reason ?? (r.a.statement ? "Upload the latest statement to keep its balance current." : "Its balance and transactions show up here once a statement is in."),
      action: "Upload",
      run: () => onGo("accounts"),
    });
  }
  for (const r of rows.filter((r) => r.a.bankKey && r.a.connection === "none"))
    items.push({
      key: `conn-${r.a.id}`,
      tone: "info",
      icon: <Plug />,
      title: `Connect ${accountLabel(r.a)}${r.a.nickname ? ` (${r.a.nickname})` : ""}`,
      detail: "Live balance, pay from LEDGERS and automatic reconciliation. Connecting also verifies the account.",
      action: "Connect",
      run: () => onConnect(r.a.id),
    });
  const unverified = rows.filter((r) => !r.a.verified && !(r.a.bankKey && r.a.connection === "none")).length;
  if (unverified)
    items.push({
      key: "verify",
      tone: "info",
      icon: <ShieldCheck />,
      title: `${plural(unverified, "account")} not verified`,
      detail: "An instant check with the bank. No money is moved.",
      action: "Verify",
      run: () => onGo("accounts"),
    });

  const groupFor = (it: Item): AttentionGroup =>
    it.key === "ai"
      ? "reconcile"
      : it.key === "awaiting" || payouts.some((p) => p.id === it.key)
        ? "payments"
        : /^(limit|cash|person)-/.test(it.key)
          ? "balances"
          : "connections";
  const groups = ATTENTION_GROUPS.map((g) => ({ ...g, list: items.filter((it) => groupFor(it) === g.key) }))
    .filter((g) => g.list.length)
    .map((g) => ({ ...g, tone: g.list.reduce<Item["tone"]>((t, it) => (TONE_RANK[it.tone] < TONE_RANK[t] ? it.tone : t), "info") }))
    // Most urgent group first.
    .sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);

  const TONE = {
    critical: "bg-[var(--color-destructive-soft)] text-[var(--color-destructive-accent)]",
    warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning-accent)]",
    info: "bg-[var(--color-primary-soft)] text-[var(--color-primary-accent)]",
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Cash in bank"
          value={withBank.length ? fmtINR(totalInBank) : "—"}
          tone={!withBank.length ? "muted" : allStale ? "warn" : "primary"}
          sub={
            <>
              {cashSub}
              {odcc.length > 0 && (
                <span className="mt-0.5 block">
                  {compactINR(odccUsed)} used on OD/CC{odccHasLimit ? ` · ${compactINR(odccLeft)} available` : ""}
                </span>
              )}
              {cash.length > 0 && (
                <span className="mt-0.5 block">
                  + <StatLink onClick={() => onOpenAccount(CASH_ALL)}>{fmtINR(cashInHand)} cash in hand</StatLink>
                </span>
              )}
            </>
          }
        />
        <StatCard label="Money in this month" value={compactINR(flow.in.now)} tone="good" sub={flowSource + trend(flow.in.now, flow.in.prev)} />
        <StatCard label="Money out this month" value={compactINR(flow.out.now)} tone="bad" sub={flowSource + trend(flow.out.now, flow.out.prev)} />
        {!withBank.length ? (
          <StatCard
            label="Books vs bank"
            value="—"
            tone="muted"
            sub={rows.some((r) => r.a.bankKey) ? "Connect your bank to compare" : "Upload a statement to compare"}
          />
        ) : toExplain ? (
          <StatCard
            label="Books differ by"
            value={fmtINR(toExplain)}
            tone="warn"
            sub={
              <>
                {allStale ? "May be out of date · " : !count("live") && reconciledTo ? `As of ${reconciledTo} · ` : ""}
                <StatLink onClick={review}>Review {plural(toReview, "item")}</StatLink>
              </>
            }
          />
        ) : (
          <StatCard label="Books vs bank" value="Matches the bank" tone="good" sub={reconciledTo ? `Reconciled to ${reconciledTo}` : "Nothing to reconcile"} />
        )}
      </div>

      {/* Split: accounts take two thirds; Needs attention is a notification feed beside them. Stacked: the earlier layout. */}
      <div className={cn("grid items-start gap-4", split && "lg:grid-cols-3")}>
        <Card className={cn("min-w-0", split && "lg:order-2")}>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            {items.length > 0 &&
              (split ? (
                <span className="rounded-full bg-[var(--color-destructive-soft)] px-2 text-xs font-semibold text-[var(--color-destructive-accent)]">{items.length}</span>
              ) : (
                <span className="text-xs text-muted-foreground">{items.length}</span>
              ))}
          </CardHeader>
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <CheckCircle2 className="size-8 text-emerald-600" />
              <div className="text-sm font-medium text-foreground">You're all caught up</div>
              <div className="text-xs text-muted-foreground">{reconciledTo ? `Books reconciled to ${reconciledTo}. ` : ""}Nothing needs you right now.</div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {groups.map((g) => {
                const open = openGroup === g.key || groups.length === 1;
                return (
                  <li key={g.key}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenGroup(open ? null : g.key)}
                      className={cn("flex w-full cursor-pointer items-center gap-3 text-left hover:bg-accent", split ? "px-4 py-3" : "px-5 py-3")}
                    >
                      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", TONE[g.tone])}>{g.list.length}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-2sm font-medium text-foreground">{g.label}</div>
                        {!open && <div className="truncate text-xs text-muted-foreground">{g.list.map((it) => it.title).join(" · ")}</div>}
                      </div>
                      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                    </button>
                    {open && (
                      <ul className="divide-y divide-border border-t border-border bg-muted/30">
                        {g.list.map((it) =>
                          split ? (
                              <li key={it.key} className="flex gap-3 px-4 py-3">
                                <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg [&_svg]:size-3.5", TONE[it.tone])}>{it.icon}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-2sm leading-snug text-foreground">{it.title}</div>
                                  {it.detail && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{it.detail}</div>}
                                  <button
                                    type="button"
                                    onClick={it.run}
                                    className="mt-1.5 inline-flex cursor-pointer items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                                  >
                                    {it.action} <ChevronRight className="size-3" />
                                  </button>
                                </div>
                              </li>
                            ) : (
                            <li key={it.key} className="flex items-center gap-3 px-5 py-3">
                              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", TONE[it.tone])}>{it.icon}</span>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-foreground">{it.title}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">{it.detail}</div>
                              </div>
                              <Button size="sm" className="shrink-0" onClick={it.run}>
                                {it.action}
                              </Button>
                            </li>
                            )
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className={cn("min-w-0", split && "lg:order-1 lg:col-span-2")}>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <button type="button" onClick={() => onGo("accounts")} className="inline-flex cursor-pointer items-center gap-0.5 text-xs font-medium text-primary hover:underline">
              Manage <ChevronRight className="size-3.5" />
            </button>
          </CardHeader>
          <ul className="divide-y divide-border">
            {GROUP_ORDER.map((g) => {
              const inGroup = rows.filter((r) => groupOf(r.a) === g);
              if (!inGroup.length) return null;
              const grouped = new Set(rows.map((r) => groupOf(r.a))).size > 1;
              return (
                <Fragment key={g}>
                  {grouped && <li className="bg-muted/40 px-5 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{GROUP_LABEL[g]}</li>}
                  {inGroup.map(({ a, bank }) => {
                    const credit = isCredit(a) && bank ? creditUse(a, bank.amount) : null;
                    return (
              <li key={a.id}>
                <button type="button" onClick={() => onOpenAccount(a.id)} className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left hover:bg-accent/40">
                  <AccountIcon account={a} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      {accountLabel(a)}
                      {a.nickname && <span className="text-muted-foreground"> · {a.nickname}</span>}
                    </span>
                    <span className="mt-1 block">
                      <SyncBadge account={a} />
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={cn("block text-sm font-semibold tabular-nums", bank?.source === "stale" ? "text-amber-600" : bank ? "text-foreground" : "text-muted-foreground")}>
                      {bank ? fmtINR(bank.amount) : "—"}
                    </span>
                    {credit &&
                      (credit.limit === undefined ? (
                        <span className="block text-xs text-muted-foreground">Limit not set</span>
                      ) : credit.over ? (
                        <span className="block text-xs text-destructive">Over limit by {fmtINR(-credit.available!)}</span>
                      ) : (
                        <span className={cn("block text-xs", credit.near ? "text-[var(--color-warning-accent)]" : "text-muted-foreground")}>{fmtINR(credit.available!)} available</span>
                      ))}
                    {g === "gateway" && bank && bank.amount > 0 && <span className="block text-xs text-muted-foreground">Awaiting payout</span>}
                  </span>
                </button>
              </li>
                    );
                  })}
                </Fragment>
              );
            })}
          </ul>
          {cash.length > 0 && (
            <>
              {/* Cash in hand: the total, then each cash account under it. Balances are from the books. */}
              <button
                type="button"
                onClick={() => onOpenAccount(CASH_ALL)}
                className="flex w-full cursor-pointer items-center gap-3 border-t border-border bg-muted/40 px-5 py-3 text-left hover:bg-accent/40"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-success-soft)] text-[var(--color-success-accent)]">
                  <Wallet className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{CASH_PARENT}</span>
                  <span className="block text-xs text-muted-foreground">From your books</span>
                </span>
                <span className={cn("shrink-0 text-sm font-semibold tabular-nums", cashInHand < 0 ? "text-destructive" : "text-foreground")}>{fmtINR(cashInHand)}</span>
              </button>
              <ul className="divide-y divide-border border-t border-border">
                {cash.map(({ c, balance }) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => onOpenAccount(c.id)} className="flex w-full cursor-pointer items-center gap-3 py-2.5 pe-5 ps-[68px] text-left hover:bg-accent/40">
                      <span className="min-w-0 flex-1 truncate text-2sm text-foreground">
                        {c.name}
                        {c.branch && !c.name.includes(c.branch) && <span className="text-muted-foreground"> · {c.branch}</span>}
                      </span>
                      <span className={cn("shrink-0 text-2sm tabular-nums", balance < 0 ? "font-medium text-destructive" : "text-muted-foreground")}>{fmtINR(balance)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

/** A business with no bank account yet: what Banking does, and the two ways in. */
function SetUpBanking({ onAddAccount, onOpenNewAccount }: { onAddAccount: () => void; onOpenNewAccount: () => void }) {
  const POINTS = [
    { icon: <Landmark />, title: "See every balance in one place", text: "Live from connected banks, or from the statements you upload." },
    { icon: <Sparkles />, title: "Reconcile without the spreadsheet", text: "AI matches bank transactions to your receipts, vouchers and bills." },
    { icon: <Plug />, title: "Pay vendors and salaries", text: "Single and bulk payouts from Axis, ICICI and IndusInd, recorded in your books." },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 text-center">
        <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-primary">
          <Landmark className="size-6" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Set up banking</h2>
        <p className="text-sm text-muted-foreground">Add the bank accounts your business uses. It takes a minute, and works with any bank in India.</p>
      </div>

      <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
        {POINTS.map((p) => (
          <div key={p.title} className="rounded-xl border border-border p-5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary-accent)] [&_svg]:size-4">{p.icon}</span>
            <div className="mt-3 text-sm font-medium text-foreground">{p.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{p.text}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button variant="primary" onClick={onAddAccount}>
          <Plus />
          Add bank account
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex -space-x-1.5">
            {ONBOARDING_BANKS.map((b) => (
              <span key={b.key} className="rounded-full ring-2 ring-card">
                <BankIcon bank={b.key} size={20} />
              </span>
            ))}
          </span>
          No current account with Axis, ICICI or IndusInd?
          <button type="button" onClick={onOpenNewAccount} className="cursor-pointer font-medium text-primary hover:underline">
            Open one
          </button>
        </div>
      </div>
    </div>
  );
}
