import { useState, type ReactNode } from "react";
import { BadgeCheck, CloudDownload, FileText, History, Landmark, MoreHorizontal, Plug, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, Upload, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Select } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { tableCls, tdCls, thCls, trCls } from "../../components/ui/table";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { BankIcon } from "./BankLogo";
import { CONNECTED_BANKING, fmtINR, last4, syncedLabel, type CompanyAccount } from "./data";
import type { StatementImport } from "./ledgerData";
import { bankBalanceOf, daysSince } from "./overviewData";
import { FilterChips } from "./FilterChips";
import { OVERLAY } from "./shared";
import { pickStatementFile } from "./statementUpload";
import { SyncBadge } from "./SyncBadge";
import { useEscape } from "./useEscape";

const toast = (message: string, tone: "success" | "error" = "success") => useStore.getState().pushToast(message, tone);
const shortName = (a: CompanyAccount) => `${a.bankKey ? CONNECTED_BANKING[a.bankKey].short : a.bank} ${last4(a.number)}`;
const STALE_DAYS = 7;

/**
 * Setup and upkeep of the company's bank accounts: one row each, with how it syncs, its balance, and at most
 * one next step. Reconciliation lives in Transactions; statement history opens per account in a side panel.
 */
export function AccountsTab({
  onConnect,
  onOpenTransactions,
  onAdd,
}: {
  onConnect: (accountId: string) => void;
  onOpenTransactions: (accountId: string) => void;
  onAdd: () => void;
}) {
  const accounts = useBankingStore((s) => s.accounts);
  const imports = useBankingStore((s) => s.imports);
  const mode = useBankingStore((s) => s.scenario.balance);
  const [show, setShow] = useState<"active" | "inactive">("active");
  const [query, setQuery] = useState("");
  const [verifying, setVerifying] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ id: string; right: number; top?: number; bottom?: number } | null>(null);
  const [history, setHistory] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const list = accounts
    .filter((a) => (show === "active" ? a.active : !a.active))
    .filter((a) => !q || [a.bank, a.nickname, a.number, a.ifsc].some((v) => v.toLowerCase().includes(q)));

  const verify = async (a: CompanyAccount) => {
    setVerifying((v) => [...v, a.id]);
    const ok = await useBankingStore.getState().verifyOwnAccount(a.id);
    setVerifying((v) => v.filter((x) => x !== a.id));
    if (ok) toast(`${shortName(a)} verified`);
    else toast(`The bank couldn't confirm ${shortName(a)}. Check the account number and IFSC.`, "error");
  };

  const upload = (a: CompanyAccount) =>
    pickStatementFile((name) => {
      useBankingStore.getState().uploadStatement(a.id, name);
      toast(`Importing ${name} for ${shortName(a)}`);
    });

  const row = (a: CompanyAccount) => {
    const bank = bankBalanceOf(a, mode);
    const latest = imports.find((i) => i.accountId === a.id && i.source === "upload");
    const failed = latest?.status === "failed" ? latest : undefined;
    const reading = latest?.status === "processing";
    const age = a.statement ? daysSince(a.statement.date) : undefined;

    // How it syncs: a badge, and one short note beside it.
    let note: ReactNode = null;
    if (!a.active) note = null;
    else if (reading)
      note = (
        <span className="inline-flex items-center gap-1.5">
          <CircularSpinner size={12} /> Reading statement…
        </span>
      );
    else if (failed) note = <span className="text-[var(--color-destructive-accent)]">Import failed · {failed.reason}</span>;
    else if (a.bankKey && a.connection === "connected") note = `Synced ${a.syncedMinutesAgo ? syncedLabel(a.syncedMinutesAgo) : "just now"}`;
    else if (a.bankKey && a.connection === "expired") note = syncedLabel(a.syncedMinutesAgo ?? 0);
    else if (age !== undefined && age > STALE_DAYS) note = <span className="text-[var(--color-warning-accent)]">{age} days old</span>;

    // At most one next step, most urgent first. Healthy accounts get none.
    const isVerifying = verifying.includes(a.id);
    const action: ReactNode = !a.active ? null : a.bankKey && a.connection === "expired" ? (
      <Button size="sm" onClick={() => onConnect(a.id)}>
        <RefreshCw />
        Reconnect
      </Button>
    ) : a.bankKey && a.connection === "none" ? (
      <Button size="sm" onClick={() => onConnect(a.id)}>
        <Plug />
        Connect
      </Button>
    ) : failed ? (
      <Button size="sm" onClick={() => upload(a)}>
        <RotateCcw />
        Upload again
      </Button>
    ) : !a.verified ? (
      <Button size="sm" onClick={() => verify(a)} disabled={isVerifying}>
        {isVerifying ? <CircularSpinner size={12} /> : <ShieldCheck />}
        {isVerifying ? "Verifying…" : "Verify"}
      </Button>
    ) : !a.bankKey && !reading && (age === undefined || age > STALE_DAYS) ? (
      <Button size="sm" onClick={() => upload(a)}>
        <Upload />
        Upload
      </Button>
    ) : null;

    return (
      <tr key={a.id} className={cn(trCls, !a.active && "text-muted-foreground")}>
        <td className={tdCls}>
          <div className="flex min-w-0 items-center gap-3">
            {a.bankKey ? (
              <BankIcon bank={a.bankKey} size={32} />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Landmark className="size-4" />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium">
                  {shortName(a)}
                  {a.nickname && <span className="font-normal text-muted-foreground"> · {a.nickname}</span>}
                </span>
                {a.primary && <Badge variant="info">Primary</Badge>}
              </div>
              <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                {a.type} · {a.ifsc}
                {a.verified ? (
                  <span className="inline-flex items-center gap-0.5 text-[var(--color-success-accent)]">
                    · <BadgeCheck className="size-3.5" /> Verified
                  </span>
                ) : (
                  <span> · Not verified</span>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className={tdCls}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <SyncBadge account={a} />
            {note && <span className="text-xs text-muted-foreground">{note}</span>}
          </div>
        </td>
        <td className={cn(tdCls, "text-right tabular-nums")}>
          {bank ? <span className={cn(bank.source === "stale" && "text-[var(--color-warning-accent)]")}>{fmtINR(bank.amount)}</span> : <span className="text-muted-foreground">—</span>}
        </td>
        <td className={cn(tdCls, "text-right")}>
          <div className="flex items-center justify-end gap-1.5">
            {action}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="More actions"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const up = r.bottom + 260 > window.innerHeight;
                setMenu(menu?.id === a.id ? null : { id: a.id, right: window.innerWidth - r.right, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
              }}
            >
              <MoreHorizontal />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  const menuAccount = menu ? accounts.find((a) => a.id === menu.id) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-60">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="accounts-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bank, nickname, IFSC…"
              className="h-8.5 w-full rounded-md border border-input bg-background ps-9 pe-3 text-2sm shadow-xs shadow-black/5 placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
            />
          </div>
          <FilterChips
            value={show}
            onChange={setShow}
            items={[
              { value: "active", label: "Active", count: accounts.filter((a) => a.active).length },
              { value: "inactive", label: "Inactive", count: accounts.filter((a) => !a.active).length },
            ]}
          />
        </div>
        <div className="flex gap-2.5">
          <Button variant="ghost" onClick={() => setHistory("all")}>
            <History />
            Import history
          </Button>
          <Button onClick={onAdd}>
            <Plus />
            Add bank account
          </Button>
        </div>
      </div>

      <Card className="min-w-0">
        <div className="overflow-x-auto">
          <table className={cn(tableCls, "table-fixed")}>
            <thead>
              <tr>
                <th className={cn(thCls, "bg-muted font-medium text-foreground")}>Account</th>
                <th className={cn(thCls, "w-[28%] bg-muted font-medium text-foreground")}>Status</th>
                <th className={cn(thCls, "w-36 bg-muted text-right font-medium text-foreground")}>Balance</th>
                <th className={cn(thCls, "w-44 bg-muted")} />
              </tr>
            </thead>
            <tbody>
              {list.map(row)}
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className={cn(tdCls, "py-10 text-center text-muted-foreground")}>
                    {q ? "No accounts match your search." : show === "inactive" ? "No inactive accounts." : "No bank accounts yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {menu && menuAccount && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
          <div style={menu} className={cn(popoverCls, "fixed z-20 flex w-52 flex-col p-1 text-left")}>
            {[
              menuAccount.active && { label: "Open transactions", run: () => onOpenTransactions(menuAccount.id) },
              menuAccount.connection === "connected" && {
                label: "Sync now",
                run: async () => {
                  const n = await useBankingStore.getState().syncAccount(menuAccount.id);
                  toast(n ? `${shortName(menuAccount)} synced · ${n} new transaction${n > 1 ? "s" : ""}` : `${shortName(menuAccount)} is up to date`);
                },
              },
              menuAccount.active && { label: "Upload statement", run: () => upload(menuAccount) },
              { label: "Statement history", run: () => setHistory(menuAccount.id) },
              menuAccount.active && !menuAccount.verified && { label: "Verify account", run: () => verify(menuAccount) },
              menuAccount.active && !menuAccount.primary && { label: "Set as primary", run: () => useBankingStore.getState().setPrimary(menuAccount.id) },
              {
                label: menuAccount.active ? "Deactivate" : "Activate",
                run: () => useBankingStore.getState().updateAccount(menuAccount.id, { active: !menuAccount.active, primary: menuAccount.active ? false : menuAccount.primary }),
                danger: menuAccount.active,
              },
            ]
              .filter((x): x is { label: string; run: () => void; danger?: boolean } => !!x)
              .map((item) => (
                <button
                  key={item.label}
                  className={cn(menuItemCls, item.danger && "!text-destructive")}
                  onClick={() => {
                    setMenu(null);
                    item.run();
                  }}
                >
                  {item.label}
                </button>
              ))}
          </div>
        </>
      )}

      {history && <ImportHistory accountId={history} onClose={() => setHistory(null)} onUpload={upload} />}
    </div>
  );
}

const PAGE = 10;

/** Every bank feed and statement upload, newest first, for one account or all — paged so it never grows the page. */
function ImportHistory({ accountId, onClose, onUpload }: { accountId: string; onClose: () => void; onUpload: (a: CompanyAccount) => void }) {
  useEscape(onClose);
  const accounts = useBankingStore((s) => s.accounts);
  const imports = useBankingStore((s) => s.imports);
  const [filter, setFilter] = useState(accountId);
  const [failedOnly, setFailedOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const rows = imports.filter((i) => (filter === "all" || i.accountId === filter) && (!failedOnly || i.status === "failed"));

  return (
    <>
      <div className={OVERLAY} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import history"
        className="fixed bottom-5 end-5 top-5 z-50 flex w-[520px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg animate-[drawer-in_.4s_cubic-bezier(.4,0,.2,1)]"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="text-base font-semibold">{filter === "all" ? "Import history" : "Statement history"}</div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
          <Select
            aria-label="Account"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setShown(PAGE);
            }}
            wrapperClassName="w-60"
          >
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {shortName(a)}
                {a.nickname ? ` · ${a.nickname}` : ""}
              </option>
            ))}
          </Select>
          <label className="flex cursor-pointer items-center gap-2 text-2sm">
            <input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} className="size-4 accent-primary" />
            Failed only
          </label>
          <span className="ms-auto text-xs text-muted-foreground">{rows.length} imports</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {rows.slice(0, shown).map((i) => (
            <ImportRow key={i.id} item={i} account={byId.get(i.accountId)} showAccount={filter === "all"} onUpload={onUpload} />
          ))}
          {rows.length === 0 && <div className="px-6 py-10 text-center text-2sm text-muted-foreground">No imports yet.</div>}
          {rows.length > shown && (
            <div className="px-6 py-3">
              <Button className="w-full" onClick={() => setShown(shown + PAGE)}>
                Load {Math.min(PAGE, rows.length - shown)} more
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ImportRow({ item: i, account: a, showAccount, onUpload }: { item: StatementImport; account?: CompanyAccount; showAccount: boolean; onUpload: (a: CompanyAccount) => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-6 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
        {i.source === "api" ? <CloudDownload /> : <FileText />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-2sm font-medium">{i.source === "api" ? `Bank feed · ${i.period}` : i.file}</div>
        <div className="truncate text-xs text-muted-foreground">
          {[showAccount && a ? shortName(a) : null, i.source === "upload" ? i.period : null, i.at].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {i.status === "imported" ? (
          <>
            <Badge variant="success">Imported</Badge>
            <div className="mt-0.5 text-xs text-muted-foreground">{i.lines} transactions</div>
          </>
        ) : i.status === "processing" ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircularSpinner size={12} /> Reading…
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <div>
              <Badge variant="destructive">Failed</Badge>
              <div className="mt-0.5 max-w-40 truncate text-xs text-muted-foreground" title={i.reason}>
                {i.reason}
              </div>
            </div>
            {a && (
              <Button size="sm" onClick={() => onUpload(a)}>
                <RotateCcw />
                Again
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
