import { useState } from "react";
import { ChevronRight, Pencil, Plus, PowerOff, RotateCcw } from "lucide-react";
import { useStore } from "../../../store/useStore";
import { CreateIdDrawer } from "./CreateIdDrawer";
import type { BharatConnectId } from "../../../types";

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
      <div className="mb-1 flex items-center gap-1.5 text-sm text-faint">
        <a href="#/settings/bharatconnect" className="hover:text-body">
          BharatConnect
        </a>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>IDs</span>
      </div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">BharatConnect IDs</h1>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          Create ID
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-faint">
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Visibility</th>
              <th className="px-5 py-3">Linked to</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {business.bharatConnectIds.map((id) => (
              <tr key={id.id}>
                <td className="px-5 py-4">
                  <div className="font-mono font-medium text-ink">{id.id}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        id.legacyFormat
                          ? "bg-amber-50 text-amber-700"
                          : id.label === "Default"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-body"
                      }`}
                    >
                      {id.legacyFormat ? "Legacy format" : id.label}
                    </span>
                    <span className="text-xs text-faint">
                      {id.settlementAccountId ? "Settlement account linked" : "No settlement account"}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4 capitalize text-body">{id.visibility}</td>
                <td className="px-5 py-4 text-body">{id.basedOn}</td>
                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      id.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-faint"
                    }`}
                  >
                    {id.status === "active" ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <button className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    {id.status === "active" ? (
                      <button
                        onClick={() => handleDeactivate(id)}
                        title={blockReason(id) ?? undefined}
                        className={`flex items-center gap-1 text-sm font-medium ${
                          blockReason(id) ? "cursor-not-allowed text-faint" : "text-red-600 hover:text-red-700"
                        }`}
                      >
                        <PowerOff className="h-3.5 w-3.5" />
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => reactivateId(business.id, id.id)}
                        className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover"
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
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-faint">
                  No BharatConnect IDs yet. Connect this business first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-medium text-ink">Good to know</h2>
        <p className="text-sm text-body">
          All IDs route to the same business and end in @BCB. BharatConnect sets the format: your first ID comes
          from your PAN or GSTIN, and extra IDs add a 2 to 5 character ending you choose, such as a city or branch.
          Older IDs can still be in the earlier free-form format. A deactivated ID can't transact, and deactivation
          is blocked while invoices against it are unpaid or partly paid, or financing is active.
        </p>
      </div>

      {drawerOpen && <CreateIdDrawer business={business} onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}
