import { useState, type ReactNode } from "react";
import { Landmark, MoreHorizontal, Plug, Plus, RefreshCw, Search, ShieldCheck, Upload } from "lucide-react";
import { Badge, type BadgeVariant } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardHeader } from "../../components/ui/card";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { tableCls, tdCls, thCls, trCls } from "../../components/ui/table";
import { ToggleGroup } from "../../components/ui/tabs";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { BankIcon } from "./BankLogo";
import { AddBankAccountDrawer } from "./AddBankAccountDrawer";
import { CONNECTED_BANKING, fmtINR, last4, syncedLabel, type CompanyAccount } from "./data";

type Status = { label: string; variant: BadgeVariant; attention: boolean };

function statusOf(a: CompanyAccount): Status {
  if (!a.active) return { label: "Inactive", variant: "secondary", attention: false };
  if (a.connection === "expired") return { label: "Connection expired", variant: "warning", attention: true };
  if (a.connection === "connected") return { label: "Connected", variant: "success", attention: false };
  if (a.verified) return { label: "Verified", variant: "primary", attention: false };
  return { label: "Not verified", variant: "secondary", attention: true };
}

/** Needs attention first, then connected, then everything else; primary leads its group. */
function rank(a: CompanyAccount) {
  const s = statusOf(a);
  return (s.attention ? 0 : a.connection === "connected" ? 10 : 20) + (a.primary ? 0 : 1);
}

const toast = (message: string, tone: "success" | "error" = "success") => useStore.getState().pushToast(message, tone);

export function AccountsTab({ onConnect }: { onConnect: (accountId: string) => void }) {
  const accounts = useBankingStore((s) => s.accounts);
  const balanceMode = useBankingStore((s) => s.scenario.balance);
  const [show, setShow] = useState<"active" | "inactive">("active");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<Record<string, "verifying" | "syncing">>({});
  const [menuId, setMenuId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const live = (a: CompanyAccount) => a.liveBalance?.[balanceMode === "low" ? 1 : 0] ?? 0;
  const connected = accounts.filter((a) => a.active && a.connection === "connected");
  const attention = accounts.filter((a) => a.active && statusOf(a).attention).length;
  const q = query.trim().toLowerCase();
  const rows = accounts
    .filter((a) => (show === "active" ? a.active : !a.active))
    .filter((a) => !q || [a.bank, a.nickname, a.number, a.ifsc].some((v) => v.toLowerCase().includes(q)))
    .sort((x, y) => rank(x) - rank(y));

  const run = async (a: CompanyAccount, kind: "verifying" | "syncing") => {
    setBusy((b) => ({ ...b, [a.id]: kind }));
    const store = useBankingStore.getState();
    if (kind === "verifying") {
      const ok = await store.verifyOwnAccount(a.id);
      toast(
        ok ? `${a.bank} ${last4(a.number)} verified` : `${a.bank} couldn't confirm ${last4(a.number)}. Check the account number and IFSC, then try again.`,
        ok ? "success" : "error",
      );
    } else {
      await store.syncAccount(a.id);
      toast(`${a.bank} ${last4(a.number)} synced`);
    }
    setBusy(({ [a.id]: _done, ...rest }) => rest);
  };

  return (
    <>
      <Card className="min-w-0">
        <CardHeader className="gap-4 py-3">
          <div className="flex flex-col gap-0.5 py-1">
            <div className="text-sm font-semibold">Bank accounts</div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">{fmtINR(connected.reduce((sum, a) => sum + live(a), 0))}</span> across{" "}
              {connected.length} connected account{connected.length === 1 ? "" : "s"}
              {attention > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-[var(--color-warning-accent)]">{attention} need attention</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-56">
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
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus />
              Add bank account
            </Button>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={cn(thCls, "bg-muted font-medium text-foreground")}>Account</th>
                <th className={cn(thCls, "w-44 bg-muted font-medium text-foreground")}>Status</th>
                <th className={cn(thCls, "w-52 bg-muted font-medium text-foreground")}>Balance</th>
                <th className={cn(thCls, "w-32 bg-muted font-medium text-foreground")}>Statements</th>
                <th className={cn(thCls, "w-56 bg-muted")} />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <AccountRow
                  key={a.id}
                  account={a}
                  balance={live(a)}
                  busy={busy[a.id]}
                  menuOpen={menuId === a.id}
                  onMenu={(open) => setMenuId(open ? a.id : null)}
                  onVerify={() => run(a, "verifying")}
                  onSync={() => run(a, "syncing")}
                  onConnect={() => onConnect(a.id)}
                />
              ))}
              {rows.length === 0 && (
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

      {adding && <AddBankAccountDrawer onClose={() => setAdding(false)} onConnect={onConnect} />}
    </>
  );
}

function AccountRow({
  account: a,
  balance,
  busy,
  menuOpen,
  onMenu,
  onVerify,
  onSync,
  onConnect,
}: {
  account: CompanyAccount;
  balance: number;
  busy?: "verifying" | "syncing";
  menuOpen: boolean;
  onMenu: (open: boolean) => void;
  onVerify: () => void;
  onSync: () => void;
  onConnect: () => void;
}) {
  const store = useBankingStore.getState;
  const [menuPos, setMenuPos] = useState<{ right: number; top?: number; bottom?: number }>({ right: 0 });
  const status = statusOf(a);
  const auto = a.connection === "connected";
  const short = a.bankKey ? CONNECTED_BANKING[a.bankKey].short : a.bank;

  const upload = () => document.getElementById(`statement-${a.id}`)?.click();
  const onFile = (file?: File) => {
    if (!file) return;
    store().uploadStatement(a.id);
    toast(`Statement uploaded for ${a.bank} ${last4(a.number)}`);
  };

  let action: ReactNode = null;
  if (a.active) {
    if (a.connection === "expired")
      action = (
        <Button size="sm" onClick={onConnect}>
          <RefreshCw />
          Reconnect
        </Button>
      );
    else if (a.bankKey && a.connection === "none")
      action = (
        <Button size="sm" onClick={onConnect}>
          <Plug />
          Connect {short} banking
        </Button>
      );
    else if (!a.verified)
      action =
        busy === "verifying" ? (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <CircularSpinner size={14} /> Verifying…
          </span>
        ) : (
          <Button size="sm" onClick={onVerify}>
            <ShieldCheck />
            Verify
          </Button>
        );
  }

  return (
    <tr className={cn(trCls, !a.active && "text-muted-foreground")}>
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
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{a.bank}</span>
              {a.primary && <Badge variant="info">Primary</Badge>}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {[a.nickname, `${a.type} ${last4(a.number)}`, a.ifsc].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      </td>
      <td className={tdCls}>
        <Badge variant={status.variant}>{status.label}</Badge>
      </td>
      <td className={tdCls}>
        {a.connection !== "none" && a.liveBalance ? (
          <>
            <div className={cn("tabular-nums", a.connection === "expired" && "text-muted-foreground")}>{fmtINR(balance)}</div>
            <div className="text-xs text-muted-foreground">
              {busy === "syncing"
                ? "Syncing…"
                : a.connection === "expired"
                  ? `Last synced ${syncedLabel(a.syncedMinutesAgo ?? 0)}`
                  : a.syncedMinutesAgo
                    ? `Synced ${syncedLabel(a.syncedMinutesAgo)}`
                    : "Synced just now"}
            </div>
          </>
        ) : a.statement ? (
          <>
            <div className="tabular-nums">{fmtINR(a.statement.balance)}</div>
            <div className="text-xs text-muted-foreground">From statement · {a.statement.date}</div>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className={tdCls}>
        {auto ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="size-3.5" /> Auto-sync
          </span>
        ) : a.active ? (
          <button type="button" onClick={upload} className="inline-flex cursor-pointer items-center gap-1.5 text-2sm text-primary hover:underline">
            <Upload className="size-3.5" /> Upload
          </button>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        <input id={`statement-${a.id}`} type="file" accept=".csv,.xls,.xlsx,.pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </td>
      <td className={cn(tdCls, "text-right")}>
        <div className="flex items-center justify-end gap-1.5">
          {action}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="More actions"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                // Fixed to the viewport so the table's scroll container can't clip it; flips up near the bottom.
                setMenuPos(r.bottom + 200 > window.innerHeight ? { right: window.innerWidth - r.right, bottom: window.innerHeight - r.top + 4 } : { right: window.innerWidth - r.right, top: r.bottom + 4 });
                onMenu(!menuOpen);
              }}
            >
              <MoreHorizontal />
            </Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => onMenu(false)} />
                <div style={menuPos} className={cn(popoverCls, "fixed z-20 flex w-48 flex-col p-1 text-left")}>
                  {[
                    auto && { label: "Sync now", run: onSync },
                    !auto && a.active && { label: "Upload statement", run: upload },
                    a.active && !a.primary && { label: "Set as primary", run: () => store().setPrimary(a.id) },
                    {
                      label: a.active ? "Deactivate" : "Activate",
                      run: () => store().updateAccount(a.id, { active: !a.active, primary: a.active ? false : a.primary }),
                      danger: a.active,
                    },
                  ]
                    .filter((x): x is { label: string; run: () => void; danger?: boolean } => !!x)
                    .map((item) => (
                      <button
                        key={item.label}
                        className={cn(menuItemCls, item.danger && "!text-destructive")}
                        onClick={() => {
                          onMenu(false);
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
        </div>
      </td>
    </tr>
  );
}
