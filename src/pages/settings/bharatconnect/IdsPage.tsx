import { useState } from "react";
import { ChevronRight, Plus, PowerOff, RotateCcw } from "lucide-react";
import { useStore } from "../../../store/useStore";
import { CreateIdDrawer } from "./CreateIdDrawer";
import type { BharatConnectId } from "../../../types";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { tableCls, thCls, tdCls, trCls } from "../../../components/ui/table";

export function IdsPage() {
  const business = useStore((s) => s.currentBusiness());
  const deactivateId = useStore((s) => s.deactivateId);
  const reactivateId = useStore((s) => s.reactivateId);
  const pushToast = useStore((s) => s.pushToast);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function blockReason(id: BharatConnectId): string | null {
    if (id.hasOpenInvoices) return "Deactivation is blocked while invoices against this ID are unpaid or partly paid.";
    if (id.activeFinancing) return "Deactivation is blocked while financing is active against this ID.";
    return null;
  }

  function handleDeactivate(id: BharatConnectId) {
    const reason = blockReason(id);
    if (reason) {
      pushToast(reason, "error");
      return;
    }
    deactivateId(business.id, id.id);
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <a href="#/settings/bharatconnect" className="hover:text-foreground">
          Bharat Connect
        </a>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>B2B IDs</span>
      </div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Bharat Connect B2B IDs</h1>
        <Button variant="outline" onClick={() => setDrawerOpen(true)}>
          <Plus />
          Create B2B ID
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs shadow-black/5">
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={thCls}>B2B ID</th>
              <th className={thCls}>Visibility</th>
              <th className={thCls}>Linked To</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {business.bharatConnectIds.map((id) => (
              <tr key={id.id} className={trCls}>
                <td className={tdCls}>
                  <div className="tabular-nums font-medium text-foreground">{id.id}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={id.legacyFormat ? "warning" : id.label === "Default" ? "primary" : "secondary"}>
                      {id.legacyFormat ? "Legacy Format" : id.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {id.settlementAccountId ? "Settlement account linked" : "No settlement account"}
                    </span>
                  </div>
                </td>
                <td className={`${tdCls} capitalize`}>{id.visibility}</td>
                <td className={tdCls}>{id.basedOn}</td>
                <td className={tdCls}>
                  <Badge variant={id.status === "active" ? "success" : "secondary"}>
                    {id.status === "active" ? "Active" : "Deactivated"}
                  </Badge>
                </td>
                <td className={tdCls}>
                  {/* Editing an ID (visibility, identifier, settlement account — reqEditId) is phase 2. */}
                  <div className="flex items-center gap-3">
                    {id.status === "active" ? (
                      <button
                        onClick={() => handleDeactivate(id)}
                        title={blockReason(id) ?? undefined}
                        className={`flex items-center gap-1 text-sm font-medium ${
                          blockReason(id) ? "cursor-not-allowed text-muted-foreground" : "text-red-600 hover:text-red-700"
                        }`}
                      >
                        <PowerOff className="h-3.5 w-3.5" />
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => reactivateId(business.id, id.id)}
                        className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {business.bharatConnectIds.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-xs text-muted-foreground">
                  No B2B IDs yet. Onboard this business first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-2 text-sm font-medium text-foreground">Good to know</h2>
        <p className="text-sm text-foreground">
          All IDs route to the same business and end in @BCB. Bharat Connect sets the format: your first ID comes
          from your PAN or GSTIN, and extra IDs add a 2 to 5 character ending you choose, such as a city or branch.
          Older IDs can still be in the earlier free-form format. A deactivated ID can't transact, and deactivation
          is blocked while invoices against it are unpaid or partly paid, or financing is active.
        </p>
      </div>

      {drawerOpen && <CreateIdDrawer business={business} onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}
