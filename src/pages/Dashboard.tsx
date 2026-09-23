import { Calendar, TrendingUp, ShoppingCart, Coins, CreditCard, Activity } from "lucide-react";
import { useStore } from "../store/useStore";
import { DashboardBanner } from "../components/layout/DashboardBanner";
import { SendViaBharatConnectButton } from "../components/SendViaBharatConnectButton";
import { ExpenseDonut } from "../components/dashboard/ExpenseDonut";
import { SalesBarChart } from "../components/dashboard/SalesBarChart";
import { money } from "./invoices/kindConfig";

const STAT_TILES = [
  { label: "Total sales", value: "INR 5.09 L", icon: TrendingUp, iconClass: "bg-emerald-50 text-emerald-600" },
  { label: "Purchases", value: "INR 51.89 K", icon: ShoppingCart, iconClass: "bg-blue-50 text-blue-600" },
  { label: "Receivables", value: "INR 5.09 L", icon: Coins, iconClass: "bg-amber-50 text-amber-600" },
  { label: "Payables", value: "INR 51.77 K", icon: CreditCard, iconClass: "bg-red-50 text-red-600" },
];

function CardHeader({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-faint">
        <Activity className="h-3.5 w-3.5" />
      </div>
      <div>
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="text-xs text-faint">Last 30 days</div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const invoices = useStore((s) => s.invoices);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Overview</h1>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-body">
          <Calendar className="h-4 w-4 text-faint" />
          Aug 23, 2026 – Sep 21, 2026
        </div>
      </div>

      <DashboardBanner />

      <div className="mb-6 grid grid-cols-4 gap-4">
        {STAT_TILES.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-faint">{tile.label}</div>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tile.iconClass}`}>
                <tile.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-1.5 text-2xl font-semibold text-ink">{tile.value}</div>
            <div className="mt-1 text-xs text-faint">Last 30 days</div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <CardHeader title="Top Paid Customers" />
          <div className="flex h-32 items-center justify-center text-sm text-faint">No data available</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <CardHeader title="Top Products" />
          <div className="flex h-32 items-center justify-center text-sm text-faint">No data available</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <CardHeader title="Expense Overview" />
          <ExpenseDonut
            total="59.6K"
            segments={[
              { label: "Purchase of Traded Goods", value: 50100, color: "#2563EB" },
              { label: "Purchase of Services", value: 9400, color: "#93C5FD" },
            ]}
          />
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-1 text-sm font-medium text-ink">Sales</div>
        <SalesBarChart />
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
                    INR {money(inv.amount)} · {inv.status.replace("_", " ")}
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
