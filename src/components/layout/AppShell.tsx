import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useStore } from "../../store/useStore";
import { DevPanel } from "../dev/DevPanel";

export function AppShell() {
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);
  const devPanelOpen = useStore((s) => s.devPanelOpen);
  const toggleDevPanel = useStore((s) => s.toggleDevPanel);

  return (
    <div className="flex h-screen bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-6xl px-8 py-7">
            <Outlet />
          </div>
        </main>
      </div>

      <button
        onClick={() => toggleDevPanel()}
        className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white shadow-lg hover:bg-gray-800"
        title="Dev panel"
      >
        <span className="text-sm font-mono">{"{ }"}</span>
      </button>
      {devPanelOpen && <DevPanel />}

      <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className="cursor-pointer rounded-md bg-ink px-4 py-2.5 text-sm text-white shadow-lg"
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
