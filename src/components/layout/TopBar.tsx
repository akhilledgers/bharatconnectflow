import { StatusChip } from "./StatusChip";

export function TopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-6">
      <div className="flex max-w-md flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-faint">
        <span>✦</span>
        <span>Ask AI or Search…</span>
      </div>
      <div className="flex-1" />
      <StatusChip />
      <button className="text-sm font-medium text-blue-600 hover:text-blue-700">Go to V3</button>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
        AM
      </div>
    </header>
  );
}
