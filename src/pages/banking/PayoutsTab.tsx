import { useState, type ReactNode } from "react";
import { AlertTriangle, Banknote, Check, ChevronDown, Clock, Download, FileSpreadsheet, Receipt, RefreshCw, RotateCcw, Search, Send, Undo2, X, XCircle } from "lucide-react";
import { Badge, type BadgeVariant } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { tableCls, tdCls, thCls, trCls } from "../../components/ui/table";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { BankIcon } from "./BankLogo";
import { CONNECTED_BANKING, fmtINR, last4 } from "./data";
import type { Payout, PayoutStatus } from "./ledgerData";
import { compactINR } from "./overviewData";
import { OVERLAY } from "./shared";
import { useEscape } from "./useEscape";

type View = "action" | "progress" | "paid" | "all";

const PAYOUT_STATUS: Record<PayoutStatus, { label: string; variant: BadgeVariant; icon: ReactNode }> = {
  awaiting: { label: "Awaiting approval", variant: "warning", icon: <Clock /> },
  processing: { label: "Processing", variant: "secondary", icon: <RefreshCw /> },
  paid: { label: "Paid", variant: "success", icon: <Check /> },
  failed: { label: "Failed", variant: "destructive", icon: <XCircle /> },
  rejected: { label: "Rejected", variant: "destructive", icon: <X /> },
  returned: { label: "Returned", variant: "warning", icon: <Undo2 /> },
  cancelled: { label: "Cancelled", variant: "secondary", icon: <X /> },
};

const NEEDS_ACTION: PayoutStatus[] = ["failed", "rejected", "returned"];
const IN_PROGRESS: PayoutStatus[] = ["awaiting", "processing"];

const toast = (m: string) => useStore.getState().pushToast(m, "success");

/** Everything paid out from LEDGERS, tracked until it's settled and in the books. */
export function PayoutsTab({ onSingle, onBulk, onPayBill }: { onSingle: () => void; onBulk: () => void; onPayBill: () => void }) {
  const payouts = useBankingStore((s) => s.payouts);
  const accounts = useBankingStore((s) => s.accounts);
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  const retried = new Set(payouts.map((p) => p.retryOf).filter(Boolean));
  const needsAction = payouts.filter((p) => NEEDS_ACTION.includes(p.status) && !retried.has(p.id));
  const inProgress = payouts.filter((p) => IN_PROGRESS.includes(p.status));
  const paid = payouts.filter((p) => p.status === "paid");

  const q = query.trim().toLowerCase();
  const rows = (view === "action" ? needsAction : view === "progress" ? inProgress : view === "paid" ? paid : payouts).filter(
    (p) => !q || [p.name, p.detail, p.utr ?? "", p.ref, String(p.amount)].some((v) => v.toLowerCase().includes(q)),
  );
  const open = payouts.find((p) => p.id === openId) ?? null;
  const account = (id: string) => accounts.find((a) => a.id === id);

  const VIEWS: { value: View; label: string; count?: number }[] = [
    { value: "action", label: "Needs action", count: needsAction.length },
    { value: "progress", label: "In progress", count: inProgress.length },
    { value: "paid", label: "Paid", count: paid.length },
    { value: "all", label: "All" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-2sm text-muted-foreground">
          <span>
            Paid this month <span className="font-semibold text-foreground tabular-nums">{compactINR(paid.reduce((s, p) => s + p.amount, 0))}</span>
          </span>
          <span>
            In progress <span className="font-semibold text-foreground tabular-nums">{compactINR(inProgress.reduce((s, p) => s + p.amount, 0))}</span> ({inProgress.length})
          </span>
          {needsAction.length > 0 && <span className="font-medium text-destructive">{needsAction.length} need action</span>}
        </div>
        <div className="relative">
          <Button variant="primary" onClick={() => setMenu(!menu)}>
            <Send />
            New payout <ChevronDown />
          </Button>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div className={cn(popoverCls, "absolute end-0 top-[calc(100%+4px)] z-50 flex w-52 flex-col gap-0.5 p-1")}>
                {[
                  { icon: <Banknote />, label: "Single transfer", run: onSingle },
                  { icon: <FileSpreadsheet />, label: "Bulk transfer", run: onBulk },
                  { icon: <Receipt />, label: "Pay a purchase bill", run: onPayBill },
                ].map((m) => (
                  <button
                    key={m.label}
                    className={menuItemCls}
                    onClick={() => {
                      setMenu(false);
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
                onClick={() => setView(v.value)}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-2sm text-muted-foreground hover:bg-accent hover:text-foreground",
                  view === v.value && "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary",
                )}
              >
                {v.label}
                {v.count !== undefined && <span className="tabular-nums opacity-70">{v.count}</span>}
              </button>
            ))}
          </div>
          <div className="relative w-56">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="payout-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search payee, UTR, amount" className="ps-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className={cn(tableCls, "table-fixed")}>
            <thead>
              <tr>
                <th className={cn(thCls, "w-44")}>Initiated</th>
                <th className={thCls}>Payee</th>
                <th className={cn(thCls, "w-36 text-right")}>Amount</th>
                <th className={cn(thCls, "w-36")}>From</th>
                <th className={cn(thCls, "w-72")}>Status</th>
                <th className={cn(thCls, "w-28")} />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const a = account(p.fromAccountId);
                const st = PAYOUT_STATUS[p.status];
                const canRetry = NEEDS_ACTION.includes(p.status) && !retried.has(p.id);
                return (
                  <tr key={p.id} className={cn(trCls, "cursor-pointer")} onClick={() => setOpenId(p.id)}>
                    <td className={cn(tdCls, "text-muted-foreground")}>
                      <div className="text-2sm">{p.initiatedAt}</div>
                      <div className="text-xs">{p.ref}</div>
                    </td>
                    <td className={cn(tdCls, "max-w-0")}>
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.detail}
                        {p.retryOf && " · retry"}
                      </div>
                    </td>
                    <td className={cn(tdCls, "text-right font-semibold tabular-nums")}>{fmtINR(p.amount)}</td>
                    <td className={tdCls}>
                      {a && (
                        <div className="flex items-center gap-2">
                          {a.bankKey && <BankIcon bank={a.bankKey} size={22} />}
                          <div className="text-xs">
                            <div>{a.bankKey ? CONNECTED_BANKING[a.bankKey].short : a.bank} {last4(a.number)}</div>
                            <div className="text-muted-foreground">{p.mode}</div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className={tdCls}>
                      <Badge variant={st.variant}>
                        {st.icon}
                        {st.label}
                      </Badge>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p.batch
                          ? `${p.batch.count} payments${p.status === "paid" ? ` · all paid` : ""}`
                          : p.reason
                            ? p.reason
                            : p.utr
                              ? `UTR ${p.utr}`
                              : p.status === "awaiting"
                                ? "Waiting for the checker in net banking"
                                : p.status === "processing"
                                  ? "With the bank"
                                  : ""}
                      </div>
                    </td>
                    <td className={cn(tdCls, "text-right")} onClick={(e) => e.stopPropagation()}>
                      {canRetry && (
                        <Button
                          size="sm"
                          onClick={() => {
                            useBankingStore.getState().retryPayout(p.id);
                            toast(`Retrying ${p.name} · ${fmtINR(p.amount)}`);
                          }}
                        >
                          <RotateCcw />
                          Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className={cn(tdCls, "py-10 text-center text-muted-foreground")}>
                    {view === "action" ? "No failed, rejected or returned payouts." : "No payouts here."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {open && <PayoutDrawer payout={open} retried={retried.has(open.id)} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function PayoutDrawer({ payout: p, retried, onClose }: { payout: Payout; retried: boolean; onClose: () => void }) {
  useEscape(onClose);
  const account = useBankingStore((s) => s.accounts.find((a) => a.id === p.fromAccountId));
  const store = useBankingStore.getState;
  const bank = account?.bankKey ? CONNECTED_BANKING[account.bankKey].short : (account?.bank ?? "the bank");
  const st = PAYOUT_STATUS[p.status];
  const makerChecker = account?.approval === "maker-checker";

  type Step = { label: string; detail?: string; state: "done" | "current" | "bad" };
  const steps: Step[] = [
    { label: `Initiated by ${p.initiatedBy}`, detail: p.initiatedAt, state: "done" },
    { label: `Sent to ${bank}`, detail: `${p.mode}${p.batch ? ` · ${p.batch.count} payments` : ""}`, state: "done" },
  ];
  if (p.status === "awaiting") steps.push({ label: "Waiting for checker approval", detail: `Approve in ${bank} net banking. It goes out once approved.`, state: "current" });
  if (p.status === "cancelled") steps.push({ label: "Cancelled", detail: "Cancelled before approval. Nothing was paid.", state: "bad" });
  if (p.status === "rejected") steps.push({ label: "Rejected by the checker", detail: p.reason, state: "bad" });
  if (["processing", "paid", "returned", "failed"].includes(p.status) && makerChecker) steps.push({ label: `Approved in ${bank} net banking`, state: "done" });
  if (p.status === "processing") steps.push({ label: "With the bank", detail: p.mode === "NEFT" ? "Goes out in the next NEFT batch" : "Usually takes a few seconds", state: "current" });
  if (p.status === "failed") steps.push({ label: "Failed", detail: p.reason, state: "bad" });
  if (p.status === "paid" || p.status === "returned") steps.push({ label: "Paid", detail: p.utr ? `UTR ${p.utr}` : undefined, state: "done" });
  if (p.status === "paid") steps.push({ label: "Recorded in your books", detail: `${p.voucher ?? "Voucher"} created and matched to the bank line`, state: "done" });
  if (p.status === "returned") steps.push({ label: "Returned", detail: `${p.reason}. The voucher was reversed and the bills reopened.`, state: "bad" });

  return (
    <>
      <div className={OVERLAY} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Payout to ${p.name}`}
        className="fixed bottom-5 end-5 top-5 z-50 flex w-[460px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg animate-[drawer-in_.4s_cubic-bezier(.4,0,.2,1)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{p.ref}</div>
            <div className="truncate text-base font-semibold">{p.name}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-semibold tabular-nums">{fmtINR(p.amount)}</span>
              <Badge variant={st.variant}>
                {st.icon}
                {st.label}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
          <ol className="flex flex-col">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full [&_svg]:size-3",
                      s.state === "done" && "bg-[var(--color-success-soft)] text-[var(--color-success-accent)]",
                      s.state === "current" && "bg-[var(--color-warning-soft)] text-[var(--color-warning-accent)]",
                      s.state === "bad" && "bg-[var(--color-destructive-soft)] text-[var(--color-destructive-accent)]",
                    )}
                  >
                    {s.state === "done" ? <Check /> : s.state === "current" ? <Clock /> : <AlertTriangle />}
                  </span>
                  {i < steps.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
                </div>
                <div className="pb-4">
                  <div className="text-2sm font-medium">{s.label}</div>
                  {s.detail && <div className="text-xs text-muted-foreground">{s.detail}</div>}
                </div>
              </li>
            ))}
          </ol>

          <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-2sm">
            <dt className="text-muted-foreground">For</dt>
            <dd>{p.detail}</dd>
            <dt className="text-muted-foreground">From</dt>
            <dd>{account ? `${account.bank} ${last4(account.number)}` : "—"}</dd>
            <dt className="text-muted-foreground">Mode</dt>
            <dd>{p.mode} · bank charges may apply</dd>
            {p.utr && (
              <>
                <dt className="text-muted-foreground">UTR</dt>
                <dd className="tabular-nums">{p.utr}</dd>
              </>
            )}
            {p.voucher && p.status === "paid" && (
              <>
                <dt className="text-muted-foreground">In your books</dt>
                <dd>{p.voucher}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="flex flex-wrap justify-end gap-2.5 border-t border-border px-6 py-4">
          {p.status === "paid" && (
            <>
              <Button onClick={() => toast("Payment advice downloaded")}>
                <Download />
                Download advice
              </Button>
              <Button variant="primary" onClick={() => toast(`Payment advice sent to ${p.name}`)}>
                <Send />
                Share advice with payee
              </Button>
            </>
          )}
          {p.status === "awaiting" && (
            <Button
              onClick={() => {
                store().cancelPayout(p.id);
                toast("Payout cancelled");
              }}
            >
              Cancel payout
            </Button>
          )}
          {NEEDS_ACTION.includes(p.status) && !retried && (
            <Button
              variant="primary"
              onClick={() => {
                store().retryPayout(p.id);
                toast(`Retrying ${p.name} · ${fmtINR(p.amount)}`);
                onClose();
              }}
            >
              <RotateCcw />
              Retry payout
            </Button>
          )}
          {(p.status === "processing" || p.status === "cancelled" || retried) && <Button onClick={onClose}>Close</Button>}
        </div>
      </div>
    </>
  );
}
