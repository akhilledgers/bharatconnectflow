import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  House,
  ContactRound,
  GalleryVerticalEnd,
  Package,
  TrendingUp,
  ShoppingBag,
  BookOpen,
  Percent,
  Landmark,
  Layers,
  Users,
  DatabaseZap,
  Settings2,
  ChevronDown,
  PanelRightOpen,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { STATUS_META } from "../../lib/status";
import { cn } from "../../lib/cn";
import { LedgersLogoFull } from "./LedgersLogoFull";

type Child = string | { label: string; to: string };

const NAV_ITEMS: { label: string; icon: typeof House; to?: string; children?: Child[]; chevron?: boolean }[] = [
  { label: "Contacts", icon: ContactRound, to: "/contacts" },
  { label: "Catalog", icon: GalleryVerticalEnd },
  { label: "Inventory", icon: Package },
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
  { label: "Expenses", icon: ShoppingBag, children: [{ label: "Bills", to: "/expenses/bills" }] },
  { label: "Accounting", icon: BookOpen, chevron: true },
  { label: "Taxation", icon: Percent, chevron: true },
  { label: "Banking", icon: Landmark },
  { label: "HRMS", icon: Layers, chevron: true },
  { label: "Users & Roles", icon: Users },
  { label: "Dataport", icon: DatabaseZap, chevron: true },
];

const SETTINGS_ITEMS = ["Basic Settings", "Advanced Settings", "Customization", "PG Settings"];

// components.md → Sidebar.
const ITEM =
  "relative flex h-8 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-foreground hover:bg-accent [&_svg]:size-4 [&_svg]:shrink-0";
const SUB_ITEM = "flex h-8 w-full items-center gap-2 rounded-lg px-2 text-sm text-foreground hover:bg-accent";
const ICON = "opacity-60";
const CHEVRON = "ms-auto !size-3.5 text-muted-foreground transition-transform duration-200";

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
    <aside className="fixed inset-y-0 start-0 z-20 flex w-(--sidebar-width) flex-col border-e border-border bg-background">
      <div className="flex h-(--header-height) shrink-0 items-center justify-between gap-2.5 border-b border-border px-2.5">
        <div className="flex items-center ps-1.5">
          <LedgersLogoFull height={22} />
        </div>
        <button className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-accent-foreground hover:bg-accent" title="Collapse sidebar">
          <PanelRightOpen className="size-4 opacity-60" />
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3.5">
        <NavLink to="/" end className={({ isActive }) => cn(ITEM, isActive && "bg-accent")}>
          <House className={ICON} />
          Dashboard
        </NavLink>

        {NAV_ITEMS.map(({ label, icon: Icon, to, children, chevron }) => {
          const isOpen = openSection === label;
          const expandable = !!children && children.length > 0;
          return (
            <div key={label} className="space-y-0.5">
              {to ? (
                <NavLink to={to} className={({ isActive }) => cn(ITEM, isActive && "bg-accent")}>
                  <Icon className={ICON} />
                  <span className="flex-1">{label}</span>
                </NavLink>
              ) : (
                <button
                  onClick={() => expandable && setOpenSection(isOpen ? null : label)}
                  className={cn(ITEM, "text-left", expandable ? "cursor-pointer" : "cursor-default")}
                >
                  <Icon className={ICON} />
                  <span className="flex-1">{label}</span>
                  {(expandable || chevron) && <ChevronDown className={cn(CHEVRON, isOpen && "-rotate-180")} />}
                </button>
              )}

              {expandable && isOpen && (
                <div className="space-y-0.5 ps-4">
                  {children.map((child) =>
                    typeof child === "string" ? (
                      <div key={child} className={cn(SUB_ITEM, "cursor-default text-muted-foreground")}>
                        {child}
                      </div>
                    ) : (
                      <NavLink key={child.to} to={child.to} className={({ isActive }) => cn(SUB_ITEM, isActive && "bg-accent font-medium")}>
                        {child.label}
                      </NavLink>
                    ),
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className={cn(ITEM, "cursor-default")}>
          <Settings2 className={ICON} />
          <span className="flex-1">Settings</span>
          <ChevronDown className={cn(CHEVRON, "-rotate-180")} />
        </div>

        <div className="space-y-0.5 ps-4">
          {SETTINGS_ITEMS.map((item) => (
            <div key={item} className={cn(SUB_ITEM, "cursor-default text-muted-foreground")}>
              {item}
            </div>
          ))}

          <NavLink to="/settings/bharatconnect" className={({ isActive }) => cn(SUB_ITEM, "justify-between", isActive && "bg-accent font-medium")}>
            <span>Bharat Connect</span>
            {incomplete && <span className={`size-1.5 rounded-full ${meta.dotClass}`} />}
          </NavLink>
        </div>
      </nav>

      <div className="flex h-16 shrink-0 items-center gap-2 border-t border-border px-2.5">
        <div className="flex size-8 items-center justify-center rounded-full bg-blue-500/10 text-xs font-medium text-blue-500">DL</div>
        <div className="min-w-0 leading-tight">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Business</div>
          <div className="truncate text-sm font-medium text-foreground">Demo Ledgers</div>
        </div>
      </div>
    </aside>
  );
}
