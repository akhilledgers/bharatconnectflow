import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useStore } from "../../store/useStore";
import { DevPanel } from "../dev/DevPanel";

// LEDGERS app shell (patterns.md §1): fixed 250px sidebar, fixed 54px top bar, content with a 20px gutter.
export function AppShell() {
  const toasts = useStore((s) => s.toasts);
  const devPanelOpen = useStore((s) => s.devPanelOpen);
  const toggleDevPanel = useStore((s) => s.toggleDevPanel);

  // The store still owns toasts (every action calls pushToast); this bridges each new one to
  // Sonner exactly once. The Set survives StrictMode's double effect run, and Sonner also
  // dedupes by id.
  const shown = useRef(new Set<string>());
  useEffect(() => {
    for (const t of toasts) {
      if (shown.current.has(t.id)) continue;
      shown.current.add(t.id);
      const show = t.tone === "success" ? toast.success : toast.error;
      show(t.message, { id: t.id, duration: 4000 });
    }
  }, [toasts]);

  return (
    <div className="min-h-screen bg-background [--header-height:54px] [--sidebar-width:250px]">
      <Sidebar />
      <TopBar />
      <main className="ms-(--sidebar-width) pt-(--header-height)">
        <div className="container-fluid py-5">
          <Outlet />
        </div>
      </main>

      <button
        onClick={() => toggleDevPanel()}
        className="fixed bottom-4 left-[calc(var(--sidebar-width)-44px)] z-40 flex size-8 cursor-pointer items-center justify-center rounded-full bg-foreground text-background shadow-lg hover:bg-foreground/85"
        title="Dev panel"
      >
        <span className="font-mono text-xs">{"{ }"}</span>
      </button>
      {devPanelOpen && <DevPanel />}

      <Toaster position="top-right" richColors closeButton toastOptions={{ style: { fontFamily: "Inter, sans-serif" } }} />
    </div>
  );
}
