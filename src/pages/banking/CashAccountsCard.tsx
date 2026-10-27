import { useState } from "react";
import { BookOpen, MoreHorizontal, Pencil, Plus, Power, Wallet } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { tableCls, tdCls, thCls } from "../../components/ui/table";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { CASH_PARENT, cashBalance, cashTotal, type CashAccount } from "./cash";
import { fmtINR } from "./data";

/**
 * Banking → Accounts: Cash in hand and the cash accounts under it. The header carries the total; each row its own
 * book balance. Nothing to connect or verify: the next step on a row is its cash book.
 */
export function CashAccountsCard({
  show,
  query,
  onAdd,
  onOpenCashBook,
}: {
  show: "active" | "inactive";
  query: string;
  onAdd: () => void;
  onOpenCashBook: (id: string) => void;
}) {
  const accounts = useBankingStore((s) => s.cashAccounts);
  const entries = useBankingStore((s) => s.cashEntries);
  const [menu, setMenu] = useState<{ id: string; right: number; top: number } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const q = query.trim().toLowerCase();
  const list = accounts.filter((a) => (show === "active" ? a.active : !a.active)).filter((a) => !q || [a.name, a.branch ?? "", CASH_PARENT].some((v) => v.toLowerCase().includes(q)));
  if (q && list.length === 0) return null;
  const total = cashTotal(accounts, entries);
  const menuAccount = menu ? accounts.find((a) => a.id === menu.id) : undefined;

  const saveName = () => {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (name) useBankingStore.getState().updateCashAccount(renaming.id, { name });
    setRenaming(null);
  };
  const setActive = (a: CashAccount, active: boolean) => {
    useBankingStore.getState().updateCashAccount(a.id, { active });
    useStore.getState().pushToast(`${a.name} ${active ? "is active again" : "made inactive"}`);
  };

  return (
    <Card className="min-w-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-success-soft)] text-[var(--color-success-accent)] [&_svg]:size-4">
            <Wallet />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">{CASH_PARENT}</div>
            <div className="text-xs text-muted-foreground">From your books · {accounts.filter((a) => a.active).length} cash accounts</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={cn("text-right text-base font-semibold tabular-nums", total < 0 ? "text-destructive" : "text-foreground")}>{fmtINR(total)}</div>
          <Button size="sm" onClick={onAdd}>
            <Plus />
            Add cash account
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className={cn(tableCls, "table-fixed")}>
          <thead>
            <tr>
              <th className={cn(thCls, "bg-muted font-medium text-foreground")}>Cash account</th>
              <th className={cn(thCls, "w-[28%] bg-muted font-medium text-foreground")}>Branch</th>
              <th className={cn(thCls, "w-36 bg-muted text-right font-medium text-foreground")}>Balance</th>
              <th className={cn(thCls, "w-44 bg-muted")} />
            </tr>
          </thead>
          <tbody>
            {list.map((a) => {
              const bal = cashBalance(a, entries);
              return (
                <tr key={a.id} className="border-t border-border">
                  <td className={tdCls}>
                    {renaming?.id === a.id ? (
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveName();
                        }}
                      >
                        <Input autoFocus aria-label="Cash account name" value={renaming.name} onChange={(e) => setRenaming({ id: a.id, name: e.target.value })} className="h-8" />
                        <Button size="sm" type="submit" variant="primary">
                          Save
                        </Button>
                        <Button size="sm" type="button" variant="ghost" onClick={() => setRenaming(null)}>
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-3 ps-2">
                        <span className="h-5 w-3 shrink-0 border-b border-s border-border" aria-hidden />
                        <span className="truncate text-sm font-medium text-foreground">{a.name}</span>
                        {a.isDefault && <Badge variant="secondary">Default</Badge>}
                      </div>
                    )}
                  </td>
                  <td className={cn(tdCls, "text-muted-foreground")}>{a.branch ?? "—"}</td>
                  <td className={cn(tdCls, "text-right tabular-nums")}>
                    <span className={cn(bal < 0 && "text-destructive")}>{fmtINR(bal)}</span>
                    {bal < 0 && <div className="text-xs text-destructive">Below zero</div>}
                  </td>
                  <td className={cn(tdCls, "text-right")}>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" onClick={() => onOpenCashBook(a.id)}>
                        <BookOpen />
                        Cash book
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="More actions"
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setMenu(menu?.id === a.id ? null : { id: a.id, right: window.innerWidth - r.right, top: r.bottom + 4 });
                        }}
                      >
                        <MoreHorizontal />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className={cn(tdCls, "py-8 text-center text-muted-foreground")}>
                  {show === "inactive" ? "No inactive cash accounts." : "No cash accounts."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {menu && menuAccount && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div style={{ right: menu.right, top: menu.top }} className={cn(popoverCls, "fixed z-50 flex w-48 flex-col gap-0.5 p-1")}>
            <button
              className={menuItemCls}
              onClick={() => {
                setRenaming({ id: menuAccount.id, name: menuAccount.name });
                setMenu(null);
              }}
            >
              <Pencil />
              Rename
            </button>
            {!menuAccount.isDefault && (
              <button
                className={menuItemCls}
                onClick={() => {
                  setActive(menuAccount, !menuAccount.active);
                  setMenu(null);
                }}
              >
                <Power />
                {menuAccount.active ? "Make inactive" : "Make active"}
              </button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
