import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

// components.md → Dialog (centered) and Sheet (right floating panel). Close on overlay click and Escape.
function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

const OVERLAY = "fixed inset-0 z-50 bg-black/30 [backdrop-filter:blur(4px)]";

export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className={OVERLAY} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-80px)] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto border border-border bg-background p-6 pb-8 shadow-lg shadow-black/5 sm:rounded-lg",
          className,
        )}
      >
        <button onClick={onClose} aria-label="Close" className="absolute end-5 top-5 cursor-pointer rounded-sm opacity-60 hover:opacity-100">
          <X className="size-4" />
        </button>
        <div className="mb-4 space-y-1 pe-6">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="grow space-y-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2.5">{footer}</div>}
      </div>
    </>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  header,
  footer,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Screen-reader title (visually hidden, per DS). */
  title: string;
  /** Optional visible header row (e.g. segmented tabs or a heading). */
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className={OVERLAY} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "fixed end-5 top-5 z-50 flex h-auto max-h-[calc(100dvh-2.5rem)] w-3/4 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg lg:w-[798px]",
          className,
        )}
      >
        <div className="flex items-center gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0 flex-1">{header}</div>
          <button onClick={onClose} aria-label="Close" className="cursor-pointer rounded-sm opacity-60 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="flex flex-row justify-end gap-2.5 border-t border-border px-8 py-5 pb-4">{footer}</div>}
      </div>
    </>
  );
}
