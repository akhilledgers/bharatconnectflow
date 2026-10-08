import { useState, type ReactNode } from "react";
import { BadgeCheck, CloudDownload, FileText, Landmark, MoreHorizontal, Plug, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, Upload } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { tableCls, tdCls, thCls, trCls } from "../../components/ui/table";
import { ToggleGroup } from "../../components/ui/tabs";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { BankIcon } from "./BankLogo";
import { CONNECTED_BANKING, fmtINR, last4, syncedLabel, type CompanyAccount } from "./data";
import { reconFor } from "./ledgerData";
import { bankBalanceOf, daysSince } from "./overviewData";
import { pickStatementFile } from "./statementUpload";
import { SyncBadge } from "./SyncBadge";

const toast = (message: string, tone: "success" | "error" = "success") => useStore.getState().pushToast(message, tone);
const shortName = (a: CompanyAccount) => `${a.bankKey ? CONNECTED_BANKING[a.bankKey].short : a.bank} ${last4(a.number)}`;

/** Setup and upkeep of the company's bank accounts: how each one syncs, and the statement imports. */
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
  const lines = useBankingStore((s) => s.bankLines);
  const entries = useBankingStore((s) => s.bookEntries);
  const imports = useBankingStore((s) => s.imports);
  const mode = useBankingStore((s) => s.scenario.balance);
  const [show, setShow] = useState<"active" | "inactive">("active");
  const [query, setQuery] = useState("");
  const [verifying, setVerifying] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ id: string; right: number; top?: number; bottom?: number } | null>(null);

  const q = query.trim().toLowerCase();
  const list = accounts
    .filter((a) => (show === "active" ? a.active : !a.active))
    .filter((a) => !q || [a.bank, a.nickname, a.number, a.ifsc].some((v) => v.toLowerCase().includes(q)));
  const connected = list.filter((a) => a.bankKey && a.connection !== "none");
  const manual = list.filter((a) => !(a.bankKey && a.connection !== "none"));
  const unverified = accounts.filter((a) => a.active && !a.verified && !(a.bankKey && a.connection === "none"));

  const verify = async (ids: string[]) => {
    setVerifying((v) => [...v, ...ids]);
    const results = await Promise.all(ids.map((id) => useBankingStore.getState().verifyOwnAccount(id)));
    setVerifying((v) => v.filter((x) => !ids.includes(x)));
    const ok = results.filter(Boolean).length;
    if (ok) toast(ok === 1 && ids.length === 1 ? `${shortName(accounts.find((a) => a.id === ids[0])!)} verified` : `${ok} of ${ids.length} accounts verified`);
    if (ok < ids.length) toast("The bank couldn't confirm some accounts. Check the account number and IFSC.", "error");
  };

  const upload = (a: CompanyAccount) =>
    pickStatementFile((name) => {
      useBankingStore.getState().uploadStatement(a.id, name);
      toast(`Importing ${name} for ${shortName(a)}`);
    });

  const row = (a: CompanyAccount) => {
    const bank = bankBalanceOf(a, mode);
    const recon = reconFor(a.id, lines, entries);
    const books = bank ? bank.amount - recon.difference : (a.booksBalance ?? (recon.booksOnly.length ? -recon.difference : null));
    const isVerifying = verifying.includes(a.id);

    let sync: ReactNode;
    let action: ReactNode = null;
    if (!a.active) sync = <SyncBadge account={a} />;
    else if (a.bankKey && a.connection === "connected") sync = <SyncNote account={a}>Synced {a.syncedMinutesAgo ? syncedLabel(a.syncedMinutesAgo) : "just now"}</SyncNote>;
    else if (a.bankKey && a.connection === "expired") {
      sync = <SyncNote account={a}>{syncedLabel(a.syncedMinutesAgo ?? 0)}</SyncNote>;
      action = (
        <Button size="sm" onClick={() => onConnect(a.id)}>
          <RefreshCw />
          Reconnect
        </Button>
      );
    } else if (a.bankKey) {
      sync = <SyncBadge account={a} />;
      action = (
        <Button size="sm" onClick={() => onConnect(a.id)}>
          <Plug />
          Connect
        </Button>
      );
    } else {
      sync = <SyncNote account={a}>{a.statement && daysSince(a.statement.date) > 7 ? `${daysSince(a.statement.date)} days old` : null}</SyncNote>;
      action = (
        <Button size="sm" onClick={() => upload(a)}>
          <Upload />
          Upload
        </Button>
      );
    }

    return (
      <tr key={a.id} className={cn(trCls, !a.active && "text-muted-foreground")}>
        <td className={tdCls}>
          <div className="flex items-center gap-3">
            {a.bankKey ? (
              <BankIcon bank={a.bankKey} size={32} />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Landmark className="size-4" />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium">{a.bank}</span>
                {a.verified ? (
                  <BadgeCheck className="size-4 shrink-0 text-[var(--color-success-accent)]" aria-label="Verified" />
                ) : isVerifying ? (
                  <CircularSpinner size={12} />
                ) : (
                  a.active && (
                    <button type="button" onClick={() => verify([a.id])} className="cursor-pointer text-xs text-primary hover:underline">
                      Verify
                    </button>
                  )
                )}
                {a.primary && <Badge variant="info">Primary</Badge>}
              </div>
              <div className="truncate text-xs text-muted-foreground">{[a.nickname, `${a.type} ${last4(a.number)}`, a.ifsc].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
        </td>
        <td className={tdCls}>{sync}</td>
        <td className={cn(tdCls, "text-right tabular-nums")}>
          {bank ? <span className={cn(bank.source === "stale" && "text-muted-foreground")}>{fmtINR(bank.amount)}</span> : <span className="text-muted-foreground">—</span>}
        </td>
        <td className={cn(tdCls, "text-right tabular-nums")}>
          {books === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <button type="button" onClick={() => onOpenTransactions(a.id)} className="cursor-pointer text-right hover:underline">
              <div>{fmtINR(books)}</div>
              {bank &&
                (recon.reconciled ? (
                  <div className="text-xs text-[var(--color-success-accent)]">Matches the bank</div>
                ) : recon.difference !== 0 ? (
                  <div className="text-xs text-[var(--color-warning-accent)]">Differs by {fmtINR(Math.abs(recon.difference))}</div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {recon.suggested + recon.needs + recon.booksOnly.length} to review
                  </div>
                ))}
            </button>
          )}
        </td>
        <td className={cn(tdCls, "text-right")}>
          <div className="flex items-center justify-end gap-1.5">
            {a.active && action}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="More actions"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const up = r.bottom + 200 > window.innerHeight;
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
    <div className="flex flex-col gap-5">
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
          <ToggleGroup
            value={show}
            onChange={setShow}
            items={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </div>
        <Button onClick={onAdd}>
          <Plus />
          Add bank account
        </Button>
      </div>

      {show === "active" && unverified.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-[var(--color-primary-soft)]/60 px-4 py-2.5 text-2sm">
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[var(--color-primary-accent)]" />
            {unverified.length} account{unverified.length > 1 ? "s" : ""} not verified. It's an instant check with the bank; no money is moved.
          </span>
          <Button size="sm" onClick={() => verify(unverified.map((a) => a.id))}>
            Verify all
          </Button>
        </div>
      )}

      <Card className="min-w-0">
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={cn(thCls, "bg-muted font-medium text-foreground")}>Account</th>
                <th className={cn(thCls, "w-60 bg-muted font-medium text-foreground")}>How it syncs</th>
                <th className={cn(thCls, "w-40 bg-muted text-right font-medium text-foreground")}>In bank</th>
                <th className={cn(thCls, "w-44 bg-muted text-right font-medium text-foreground")}>In your books</th>
                <th className={cn(thCls, "w-40 bg-muted")} />
              </tr>
            </thead>
            <tbody>
              {show === "active" ? (
                <>
                  {connected.length > 0 && <GroupRow>Connected banking · {connected.length}</GroupRow>}
                  {connected.map(row)}
                  {manual.length > 0 && <GroupRow>Statement upload · {manual.length}</GroupRow>}
                  {manual.map(row)}
                </>
              ) : (
                list.map(row)
              )}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className={cn(tdCls, "py-10 text-center text-muted-foreground")}>
                    {q ? "No accounts match your search." : show === "inactive" ? "No inactive accounts." : "No bank accounts yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {imports.length > 0 && (
        <Card className="min-w-0">
          <CardHeader className="py-3">
            <div>
              <CardTitle>Statement imports</CardTitle>
              <CardDescription>Bank feeds and the statements you upload</CardDescription>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <tbody>
                {imports.slice(0, 8).map((i) => {
                  const a = accounts.find((x) => x.id === i.accountId);
                  return (
                    <tr key={i.id} className={trCls}>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5">
                            {i.source === "api" ? <CloudDownload /> : <FileText />}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-2sm">{i.source === "api" ? "Bank feed" : i.file}</div>
                            <div className="text-xs text-muted-foreground">{a ? shortName(a) : ""}</div>
                          </div>
                        </div>
                      </td>
                      <td className={cn(tdCls, "text-2sm text-muted-foreground")}>{i.period}</td>
                      <td className={tdCls}>
                        {i.status === "imported" ? (
                          <span className="text-2sm">
                            <Badge variant="success">Imported</Badge> <span className="ms-1 text-muted-foreground">{i.lines} transactions</span>
                          </span>
                        ) : i.status === "processing" ? (
                          <span className="inline-flex items-center gap-2 text-2sm text-muted-foreground">
                            <CircularSpinner size={14} /> Reading the statement…
                          </span>
                        ) : (
                          <span className="text-2sm">
                            <Badge variant="destructive">Failed</Badge> <span className="ms-1 text-muted-foreground">{i.reason}</span>
                          </span>
                        )}
                      </td>
                      <td className={cn(tdCls, "text-2sm text-muted-foreground")}>{i.at}</td>
                      <td className={cn(tdCls, "w-32 text-right")}>
                        {i.status === "failed" && a && (
                          <Button size="sm" onClick={() => upload(a)}>
                            <RotateCcw />
                            Upload again
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {menu && menuAccount && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
          <div style={menu} className={cn(popoverCls, "fixed z-20 flex w-52 flex-col p-1 text-left")}>
            {[
              menuAccount.active && { label: "Open transactions", run: () => onOpenTransactions(menuAccount.id) },
              menuAccount.connection === "connected" && {
                label: "Sync now",
                run: async () => {
                  await useBankingStore.getState().syncAccount(menuAccount.id);
                  toast(`${shortName(menuAccount)} synced`);
                },
              },
              menuAccount.active && menuAccount.connection !== "connected" && { label: "Upload statement", run: () => upload(menuAccount) },
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

    </div>
  );
}

function GroupRow({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td colSpan={5} className="border-b border-border bg-muted/40 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

function SyncNote({ account, children }: { account: CompanyAccount; children: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <SyncBadge account={account} />
      {children && <span className="text-xs text-muted-foreground">{children}</span>}
    </span>
  );
}
