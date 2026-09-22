import { useStore } from "../store/useStore";
import { DashboardBanner } from "../components/layout/DashboardBanner";
import { SendViaBharatConnectButton } from "../components/SendViaBharatConnectButton";

const STAT_TILES = [
  { label: "Total sales", value: "INR 5.09 L" },
  { label: "Purchases", value: "INR 51.89 K" },
  { label: "Receivables", value: "INR 5.09 L" },
  { label: "Payables", value: "INR 51.77 K" },
];

export function Dashboard() {
  const invoices = useStore((s) => s.invoices);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Overview</h1>
        <div className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-body">
          Aug 23, 2026 – Sep 21, 2026
        </div>
      </div>

      <DashboardBanner />

      <div className="mb-6 grid grid-cols-4 gap-4">
        {STAT_TILES.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-faint">{tile.label}</div>
            <div className="mt-1.5 text-2xl font-semibold text-ink">{tile.value}</div>
            <div className="mt-1 text-xs text-faint">Last 30 days</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 font-medium text-ink">Recent sales</div>
        <div className="divide-y divide-gray-100">
          {invoices
            .filter((i) => i.kind === "sales")
            .map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="font-medium text-blue-600">#{inv.id}</div>
                  <div className="mt-0.5 text-sm text-faint">
                    INR {inv.amount.toLocaleString("en-IN")} · {inv.status.replace("_", " ")}
                  </div>
                </div>
                <SendViaBharatConnectButton invoiceId={inv.id} />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
