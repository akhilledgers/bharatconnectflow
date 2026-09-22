import { NavLink } from "react-router-dom";
import { useStore } from "../../store/useStore";
import { STATUS_META } from "../../lib/status";

const NAV_ITEMS = [
  "Dashboard",
  "Contacts",
  "Catalog",
  "Inventory",
  "Sales",
  "Expenses",
  "Accounting",
  "Taxation",
  "Banking",
  "HRMS",
  "Users & Roles",
  "Dataport",
];

const SETTINGS_ITEMS = ["Basic Settings", "Advanced Settings", "Customization", "PG Settings"];

export function Sidebar() {
  const business = useStore((s) => s.currentBusiness());
  const meta = STATUS_META[business.connectionState];
  const incomplete = business.connectionState !== "connected";

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-gradient-to-br from-red-500 via-amber-400 to-emerald-500 text-xs font-bold text-white">
          L
        </div>
        <span className="text-lg font-semibold tracking-tight text-ink">LEDGERS</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-1 text-sm">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 ${
              isActive ? "bg-gray-100 font-medium text-ink" : "text-body hover:bg-gray-50"
            }`
          }
        >
          <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-300" />
          Dashboard
        </NavLink>

        {NAV_ITEMS.slice(1).map((item) => (
          <div
            key={item}
            className="mb-0.5 flex cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-body hover:bg-gray-50"
          >
            <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-300" />
            {item}
          </div>
        ))}

        <div className="mb-0.5 flex cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-body hover:bg-gray-50">
          <span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-gray-300" />
          Settings
        </div>

        <div className="ml-6 border-l border-gray-100 pl-3">
          {SETTINGS_ITEMS.map((item) => (
            <div key={item} className="mb-0.5 cursor-default rounded-md px-3 py-1.5 text-body hover:bg-gray-50">
              {item}
            </div>
          ))}

          <NavLink
            to="/settings/bharatconnect"
            className={({ isActive }) =>
              `mb-0.5 flex items-center justify-between rounded-md px-3 py-1.5 ${
                isActive ? "bg-gray-100 font-medium text-ink" : "text-body hover:bg-gray-50"
              }`
            }
          >
            <span>BharatConnect</span>
            {incomplete && <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />}
          </NavLink>
        </div>
      </nav>

      <div className="flex items-center gap-2.5 border-t border-gray-200 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
          DL
        </div>
        <div className="leading-tight">
          <div className="text-[10px] font-medium uppercase tracking-wide text-faint">Business</div>
          <div className="text-sm font-medium text-ink">Demo Ledgers</div>
        </div>
      </div>
    </aside>
  );
}
