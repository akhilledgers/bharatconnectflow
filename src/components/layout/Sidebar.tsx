import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Contact,
  ShoppingBag,
  Boxes,
  TrendingUp,
  Receipt,
  BookOpen,
  Percent,
  Landmark,
  Layers,
  UsersRound,
  Database,
  Settings as SettingsIcon,
  ChevronDown,
  PanelLeftClose,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { STATUS_META } from "../../lib/status";
import { LedgersLogo } from "./LedgersLogo";

type Child = string | { label: string; to: string };

const NAV_ITEMS: { label: string; icon: typeof LayoutDashboard; to?: string; children?: Child[]; chevron?: boolean }[] = [
  { label: "Contacts", icon: Contact, to: "/contacts" },
  { label: "Catalog", icon: ShoppingBag },
  { label: "Inventory", icon: Boxes },
  {
    label: "Sales",
    icon: TrendingUp,
    children: [
      { label: "Invoices", to: "/sales/invoices" },
      "Quotes",
      "Receipts",
      "Credit Notes",
      "Delivery Challans",
      "Receivables",
      "Payment Collection",
    ],
  },
  { label: "Expenses", icon: Receipt, children: [{ label: "Bills", to: "/expenses/bills" }] },
  { label: "Accounting", icon: BookOpen, chevron: true },
  { label: "Taxation", icon: Percent, chevron: true },
  { label: "Banking", icon: Landmark },
  { label: "HRMS", icon: Layers, chevron: true },
  { label: "Users & Roles", icon: UsersRound },
  { label: "Dataport", icon: Database, chevron: true },
];

const SETTINGS_ITEMS = ["Basic Settings", "Advanced Settings", "Customization", "PG Settings"];

export function Sidebar() {
  const business = useStore((s) => s.currentBusiness());
  const meta = STATUS_META[business.connectionState];
  const incomplete = business.connectionState !== "connected";
  const location = useLocation();

  const [openSection, setOpenSection] = useState<string | null>(() =>
    location.pathname.startsWith("/sales") ? "Sales" : location.pathname.startsWith("/expenses") ? "Expenses" : null,
  );

  // Sidebar persists across route changes (it's outside the routed Outlet), so
  // the section has to re-sync on every navigation, not just once at mount.
  useEffect(() => {
    if (location.pathname.startsWith("/sales")) setOpenSection("Sales");
    else if (location.pathname.startsWith("/expenses")) setOpenSection("Expenses");
  }, [location.pathname]);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <LedgersLogo size={26} />
          <span className="text-lg font-semibold tracking-tight text-ink">LEDGERS</span>
        </div>
        <button className="text-faint hover:text-body" title="Collapse sidebar">
          <PanelLeftClose className="h-4 w-4" />
        </button>
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
          <LayoutDashboard className="h-4 w-4 shrink-0 text-faint" />
          Dashboard
        </NavLink>

        {NAV_ITEMS.map(({ label, icon: Icon, to, children, chevron }) => {
          const isOpen = openSection === label;
          const expandable = !!children && children.length > 0;
          return (
            <div key={label}>
              {to ? (
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 ${
                      isActive ? "bg-gray-100 font-medium text-ink" : "text-body hover:bg-gray-50"
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 text-faint" />
                  <span className="flex-1">{label}</span>
                </NavLink>
              ) : (
                <button
                  onClick={() => expandable && setOpenSection(isOpen ? null : label)}
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-body hover:bg-gray-50 ${expandable ? "" : "cursor-default"}`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-faint" />
                  <span className="flex-1">{label}</span>
                  {(expandable || chevron) && (
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-faint transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  )}
                </button>
              )}

              {expandable && isOpen && (
                <div className="ml-6 border-l border-gray-100 pl-3">
                  {children.map((child) =>
                    typeof child === "string" ? (
                      <div key={child} className="mb-0.5 cursor-default rounded-md px-3 py-1.5 text-body hover:bg-gray-50">
                        {child}
                      </div>
                    ) : (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          `mb-0.5 block rounded-md px-3 py-1.5 ${
                            isActive ? "bg-gray-100 font-medium text-ink" : "text-body hover:bg-gray-50"
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ),
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="mb-0.5 flex cursor-default items-center gap-2.5 rounded-md px-3 py-2 text-body hover:bg-gray-50">
          <SettingsIcon className="h-4 w-4 shrink-0 text-faint" />
          <span className="flex-1">Settings</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
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
