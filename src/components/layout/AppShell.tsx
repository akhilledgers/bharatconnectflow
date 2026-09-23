import { Outlet } from "react-router-dom";
import { CheckCircle2, X, XCircle } from "lucide-react";
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

      <div className="fixed right-5 top-5 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {t.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismissToast(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
