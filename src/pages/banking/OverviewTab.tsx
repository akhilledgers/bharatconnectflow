import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Clock, FileUp, Landmark, Plug, RefreshCw, Send, ShieldCheck, Sparkles, Users, XCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { cn } from "../../lib/cn";
import { useBankingStore } from "../../store/useBankingStore";
import { BankIcon } from "./BankLogo";
import { CONNECTED_BANKING, fmtINR, last4, syncedLabel, type CompanyAccount } from "./data";
import { IN_FLIGHT, MONEY_FLOW, RECON, bankBalanceOf, compactINR, daysSince } from "./overviewData";

const ATTENTION_LIMIT = 5;

export type OverviewTarget = "statements" | "accounts" | "payouts";

const shortDate = (dmy: string) => {
  const [d, m, y] = dmy.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const accountLabel = (a: CompanyAccount) => `${a.bankKey ? CONNECTED_BANKING[a.bankKey].short : a.bank} ${last4(a.number)}`;

/**
 * Banking landing page, kept to three blocks: four headline numbers (three for the owner, one for the
 * accountant), one Needs attention list, and the accounts with one balance each. Detail lives in the tabs.
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
  const mode = useBankingStore((s) => s.scenario.balance);
  const [showAll, setShowAll] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const rows = accounts.map((a) => ({ a, bank: bankBalanceOf(a, mode), recon: RECON[a.id] }));
  const totalInBank = rows.reduce((s, r) => s + (r.bank?.amount ?? 0), 0);
  const gapAccounts = rows.filter((r) => r.bank && r.recon && r.recon.difference !== 0);
  const toExplain = gapAccounts.reduce((s, r) => s + Math.abs(r.recon!.difference), 0);
  const suggestions = rows.reduce((s, r) => s + (r.recon?.suggestions ?? 0), 0);
  const pct = (now: number, prev: number) => Math.round(((now - prev) / prev) * 1000) / 10;

  // ---- needs attention, most urgent first ----
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
      detail: "Bank transactions matched to receipts, vouchers and bills. Accept in one click.",
      action: "Review",
      run: () => onGo("statements"),
    });
  for (const r of rows.filter((r) => r.bank?.source === "statement" && r.a.statement && daysSince(r.a.statement.date) > 7))
    items.push({
      key: `stmt-${r.a.id}`,
      tone: "info",
      icon: <FileUp />,
      title: `${accountLabel(r.a)} statement is ${daysSince(r.a.statement!.date)} days old`,
      detail: "Upload the latest statement to keep its balance current.",
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">Banking overview</h1>
        <div className="flex gap-2.5">
          <div className="relative">
            <Button onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen}>
              More <ChevronDown />
            </Button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                <div className={cn(popoverCls, "absolute end-0 top-[calc(100%+4px)] z-50 flex w-48 flex-col gap-0.5 p-1")}>
                  <button
                    className={menuItemCls}
                    onClick={() => {
                      setMoreOpen(false);
                      onBulkPay();
                    }}
                  >
                    <Users />
                    Bulk pay
                  </button>
                  <button
                    className={menuItemCls}
                    onClick={() => {
                      setMoreOpen(false);
                      onGo("accounts");
                    }}
                  >
                    <FileUp />
                    Upload statement
                  </button>
                </div>
              </>
            )}
          </div>
          <Button variant="primary" onClick={onPay}>
            <Send />
            Pay someone
          </Button>
        </div>
      </div>

      {/* 1 · Four numbers */}
      <Card className="grid min-w-0 grid-cols-2 divide-border lg:grid-cols-4 lg:divide-x">
        <Figure label="Cash in bank" value={fmtINR(totalInBank)} note={`Across ${rows.filter((r) => r.bank).length} accounts`} />
        <Figure
          label="Money in this month"
          value={compactINR(MONEY_FLOW.in.now)}
          note={`${pct(MONEY_FLOW.in.now, MONEY_FLOW.in.prev) >= 0 ? "▲" : "▼"} ${Math.abs(pct(MONEY_FLOW.in.now, MONEY_FLOW.in.prev))}% vs last month`}
        />
        <Figure
          label="Money out this month"
          value={compactINR(MONEY_FLOW.out.now)}
          note={`${pct(MONEY_FLOW.out.now, MONEY_FLOW.out.prev) >= 0 ? "▲" : "▼"} ${Math.abs(pct(MONEY_FLOW.out.now, MONEY_FLOW.out.prev))}% vs last month`}
        />
        {toExplain ? (
          <Figure
            label="Books differ by"
            value={fmtINR(toExplain)}
            valueClass="text-[var(--color-warning-accent)]"
            note={
              <button type="button" onClick={() => onGo("statements")} className="inline-flex cursor-pointer items-center gap-0.5 font-medium text-primary hover:underline">
                Review {gapAccounts.length} account{gapAccounts.length > 1 ? "s" : ""} <ChevronRight className="size-3.5" />
              </button>
            }
          />
        ) : (
          <Figure label="Books" value="Match the bank" valueClass="text-[var(--color-success-accent)]" note="Nothing to reconcile" />
        )}
      </Card>

      {/* 2 · Needs attention */}
      <Card className="min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="text-sm font-semibold">Needs attention</div>
          {items.length > 0 && <span className="text-xs text-muted-foreground">{items.length}</span>}
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

      {/* 3 · Accounts */}
      <Card className="min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="text-sm font-semibold">Accounts</div>
          <button type="button" onClick={() => onGo("accounts")} className="inline-flex cursor-pointer items-center gap-0.5 text-xs font-medium text-primary hover:underline">
            Manage <ChevronRight className="size-3.5" />
          </button>
        </div>
        <ul className="divide-y divide-border">
          {rows.map(({ a, bank }) => (
            <li key={a.id}>
              <button type="button" onClick={() => onGo("statements")} className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left hover:bg-accent/40">
                {a.bankKey ? (
                  <BankIcon bank={a.bankKey} size={28} />
                ) : (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Landmark className="size-3.5" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-2sm">
                  <span className="font-medium">{accountLabel(a)}</span>
                  {a.nickname && <span className="text-muted-foreground"> · {a.nickname}</span>}
                </span>
                <span className={cn("w-36 shrink-0 text-right text-2sm font-semibold tabular-nums", bank?.source === "stale" && "text-muted-foreground")}>
                  {bank ? fmtINR(bank.amount) : "—"}
                </span>
                <span
                  className={cn(
                    "hidden w-40 shrink-0 text-right text-xs sm:block",
                    bank?.source === "stale" ? "font-medium text-[var(--color-warning-accent)]" : "text-muted-foreground",
                  )}
                >
                  {bank?.source === "live"
                    ? `Live · ${a.syncedMinutesAgo ? syncedLabel(a.syncedMinutesAgo) : "just now"}`
                    : bank?.source === "stale"
                      ? "Connection expired"
                      : bank?.source === "statement"
                        ? `Statement · ${shortDate(a.statement!.date)}`
                        : "No bank data yet"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Figure({ label, value, note, valueClass }: { label: string; value: string; note: ReactNode; valueClass?: string }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 truncate text-xl font-semibold tracking-tight tabular-nums", valueClass)}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{note}</div>
    </div>
  );
}
