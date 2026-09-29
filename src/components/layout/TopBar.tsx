import { Sparkles } from "lucide-react";
import { StatusChip } from "./StatusChip";

// components.md → Top bar: centered "Ask AI or Search...", soft pill, divider, avatar.
export function TopBar() {
  return (
    <header className="fixed end-0 start-(--sidebar-width) top-0 z-10 h-(--header-height) border-b border-border bg-background">
      <div className="container-fluid flex h-full items-center">
        <div className="mx-auto flex max-w-2xl flex-1 px-4">
          <div className="relative w-full">
            <Sparkles className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              readOnly
              placeholder="Ask AI or Search..."
              className="h-8.5 w-full cursor-text rounded-md border border-input bg-background ps-9 pe-3 text-2sm text-foreground shadow-xs shadow-black/5 placeholder:text-muted-foreground/80 focus-visible:outline-none"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <StatusChip />
          <button className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-500/10 px-3 text-sm font-medium text-blue-500 hover:bg-blue-500/20">
            Go to V3
          </button>
          <div className="mx-2 h-6 w-px shrink-0 bg-border" />
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-medium text-blue-500">AM</div>
        </div>
      </div>
    </header>
  );
}
