import { useEffect, useState, type MouseEvent } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, PanelRightOpen, Plus } from "lucide-react";
import { useStore } from "../../store/useStore";
import { STATUS_META } from "../../lib/status";
import { cn } from "../../lib/cn";
import { popoverCls } from "../ui/popover";
import { LedgersLogoFull, LedgersMark } from "./LedgersLogoFull";
import { BHARAT_CONNECT_PATH, NAV, sectionFor, type NavPage, type NavSection } from "./navItems";

// components.md → Sidebar.
const ITEM =
  "relative flex h-8 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-foreground hover:bg-accent [&_svg]:size-4 [&_svg]:shrink-0";
const SUB_ITEM = "flex h-8 w-full items-center gap-2 rounded-lg px-2 text-sm text-foreground hover:bg-accent [&_svg]:size-4 [&_svg]:shrink-0";
const ICON = "opacity-60";
const CHEVRON = "ms-auto !size-3.5 text-muted-foreground transition-transform duration-200";
// Collapsed rail (live LEDGERS): 34px icon buttons; a section opens as a menu beside the rail.
const RAIL_ITEM =
  "relative flex size-[34px] shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-accent [&_svg]:size-4 [&_svg]:shrink-0";
const RAIL_WIDTH = 52;

export function Sidebar() {
  const business = useStore((s) => s.currentBusiness());
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const meta = STATUS_META[business.connectionState];
  const incomplete = business.connectionState !== "connected";
  const location = useLocation();

  const [openSection, setOpenSection] = useState<string | null>(() => sectionFor(location.pathname));

  // Sidebar persists across route changes (it's outside the routed Outlet), so
  // the section has to re-sync on every navigation, not just once at mount.
  useEffect(() => {
    const section = sectionFor(location.pathname);
    if (section) setOpenSection(section);
  }, [location.pathname]);

  return (
    <aside className="fixed inset-y-0 start-0 z-20 flex w-(--sidebar-width) flex-col border-e border-border bg-background transition-[width] duration-200">
      {collapsed ? (
        <Rail incomplete={incomplete} dotClass={meta.dotClass} />
      ) : (
        <>
          <div className="flex h-(--header-height) shrink-0 items-center justify-between gap-2.5 border-b border-border px-2.5">
            <div className="flex items-center ps-1.5">
              <LedgersLogoFull />
            </div>
            <button
              onClick={toggleSidebar}
              className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-accent-foreground hover:bg-accent"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelRightOpen className="size-4 opacity-60" />
            </button>
          </div>

          <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3.5">
            {NAV.map((section) => {
              const { label, icon: Icon, to, end, pages } = section;
              if (to)
                return (
                  <NavLink key={label} to={to} end={end} className={({ isActive }) => cn(ITEM, isActive && "bg-accent")}>
                    <Icon className={ICON} />
                    <span className="flex-1">{label}</span>
                  </NavLink>
                );
              const isOpen = openSection === label;
              // Settings keeps the setup dot while it's closed; open, the dot moves to Bharat Connect.
              const dot = label === "Settings" && incomplete && !isOpen;
              return (
                <div key={label} className="space-y-0.5">
                  <button
                    onClick={() => setOpenSection(isOpen ? null : label)}
                    className={cn(ITEM, "cursor-pointer text-left")}
                    aria-expanded={isOpen}
                  >
                    <Icon className={ICON} />
                    <span className="flex-1">{label}</span>
                    {dot && <span className={`size-1.5 rounded-full ${meta.dotClass}`} />}
                    <ChevronDown className={cn(CHEVRON, isOpen && "-rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="space-y-0.5 ps-4">
                      {pages!.map((page) => (
                        <PageRow key={page.to} page={page} dotClass={incomplete ? meta.dotClass : null} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="flex h-16 shrink-0 items-center gap-2 border-t border-border px-2.5">
            <BusinessAvatar />
            <div className="min-w-0 leading-tight">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Business</div>
              <div className="truncate text-sm font-medium text-foreground">Demo Ledgers</div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

/** A page inside a section: icon + name, and the + (quick create) link on hover, as in live LEDGERS. */
function PageRow({ page, dotClass, onGo }: { page: NavPage; dotClass: string | null; onGo?: () => void }) {
  const { label, icon: Icon, to, end, create } = page;
  return (
    <div className="group relative">
      <NavLink to={to} end={end} onClick={onGo} role={onGo ? "menuitem" : undefined} className={({ isActive }) => cn(SUB_ITEM, isActive && "bg-accent font-medium")}>
        <Icon className={ICON} />
        <span className="flex-1 truncate">{label}</span>
        {to === BHARAT_CONNECT_PATH && dotClass && <span className={`size-1.5 rounded-full ${dotClass}`} />}
      </NavLink>
      {create && (
        <NavLink
          to={create}
          onClick={onGo}
          aria-label={`New ${label}`}
          title={`New ${label}`}
          className="absolute end-1 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-accent-foreground opacity-0 hover:bg-input focus-visible:opacity-100 group-hover:opacity-100 [&_svg]:size-4 [&_svg]:opacity-60"
        >
          <Plus />
        </NavLink>
      )}
    </div>
  );
}

function BusinessAvatar() {
  return <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-medium text-blue-500">DL</div>;
}

/**
 * The collapsed sidebar, as in live LEDGERS: icons only, the label as a tooltip on hover, and a section with
 * pages opens as a menu beside the rail. Tooltip and menu are fixed-position so the scrolling nav doesn't clip them.
 */
function Rail({ incomplete, dotClass }: { incomplete: boolean; dotClass: string }) {
  const location = useLocation();
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  const [menu, setMenu] = useState<{ section: NavSection; top: number } | null>(null);
  const current = sectionFor(location.pathname);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  const hover = (label: string) => ({
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ label, top: r.top + r.height / 2 });
    },
    onMouseLeave: () => setTip(null),
    "aria-label": label,
  });

  const openMenu = (section: NavSection, e: MouseEvent<HTMLElement>) => {
    if (menu?.section.label === section.label) return setMenu(null);
    setTip(null);
    // Keep the whole menu on screen: heading + rows + padding.
    const height = 44 + section.pages!.length * 34;
    setMenu({ section, top: Math.max(8, Math.min(e.currentTarget.getBoundingClientRect().top, window.innerHeight - height - 8)) });
  };

  return (
    <>
      <div className="flex h-(--header-height) shrink-0 items-center justify-center border-b border-border">
        <NavLink to="/" aria-label="Dashboard">
          <LedgersMark />
        </NavLink>
      </div>

      <nav className="scrollbar-thin flex flex-1 flex-col items-center space-y-0.5 overflow-y-auto px-1.5 py-3.5">
        {NAV.map((section) => {
          const { label, icon: Icon, to, end } = section;
          if (to)
            return (
              <NavLink key={label} to={to} end={end} className={({ isActive }) => cn(RAIL_ITEM, isActive && "bg-accent")} {...hover(label)}>
                <Icon className={ICON} />
              </NavLink>
            );
          const open = menu?.section.label === label;
          return (
            <button
              key={label}
              type="button"
              onClick={(e) => openMenu(section, e)}
              aria-haspopup="menu"
              aria-expanded={open}
              className={cn(RAIL_ITEM, "cursor-pointer", (current === label || open) && "bg-accent")}
              {...hover(label)}
            >
              <Icon className={ICON} />
              {label === "Settings" && incomplete && <span className={cn("absolute end-1.5 top-1.5 size-1.5 rounded-full", dotClass)} />}
            </button>
          );
        })}
      </nav>

      <div className="flex h-16 shrink-0 items-center justify-center border-t border-border">
        <BusinessAvatar />
      </div>

      {tip && !menu && (
        <div
          role="tooltip"
          style={{ top: tip.top, left: RAIL_WIDTH - 4 }}
          className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md"
        >
          {tip.label}
        </div>
      )}

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div role="menu" aria-label={menu.section.label} style={{ top: menu.top, left: RAIL_WIDTH }} className={cn(popoverCls, "fixed z-50 w-56 space-y-0.5 p-2")}>
            <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{menu.section.label}</div>
            {menu.section.pages!.map((page) => (
              <PageRow key={page.to} page={page} dotClass={incomplete ? dotClass : null} onGo={() => setMenu(null)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
