import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "../store/useStore";
import { BharatConnectMark } from "./layout/BharatConnectMark";

export function InviteBcTooltip({
  counterpartyName,
  children,
  className = "relative inline-flex",
}: {
  counterpartyName: string;
  children: ReactNode;
  className?: string;
}) {
  const inviteToBharatConnect = useStore((s) => s.inviteToBharatConnect);
  const [show, setShow] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function open() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setShow(true);
  }
  function scheduleClose() {
    closeTimer.current = setTimeout(() => setShow(false), 150);
  }

  return (
    <span className={className} onMouseEnter={open} onMouseLeave={scheduleClose}>
      {children}
      {show && (
        <div
          onMouseEnter={open}
          onMouseLeave={scheduleClose}
          className="absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg"
        >
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink">
            <BharatConnectMark size={12} />
            Not on BharatConnect
          </div>
          <p className="mb-2 text-[11px] leading-snug text-faint">
            {counterpartyName} hasn't joined BharatConnect yet. Invite them so future invoices reach them instantly.
          </p>
          <button
            onClick={() => inviteToBharatConnect(counterpartyName)}
            className="w-full rounded-md bg-primary px-2 py-1.5 text-[11px] font-medium text-white hover:bg-primary-hover"
          >
            Invite to BharatConnect
          </button>
        </div>
      )}
    </span>
  );
}
