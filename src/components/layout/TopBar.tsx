import { Sparkles } from "lucide-react";
import { StatusChip } from "./StatusChip";

export function TopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-6">
      <div className="flex max-w-xl flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-faint">
        <Sparkles className="h-4 w-4 shrink-0 text-faint" />
        <span>Ask AI or Search…</span>
      </div>
      <div className="flex-1" />
      <StatusChip />
      <button className="rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100">
        Go to V3
      </button>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-700">
        AM
      </div>
    </header>
  );
}
