import { useState } from "react";
import { cn } from "../../lib/cn";
import indusindWordmark from "../../assets/banks/indusind-wordmark.webp";
import type { BankKey } from "./data";

// Square icons come from the LEDGERS asset CDN, same as the live app. IndusInd has no square
// icon yet, so it shows initials there and its wordmark where a full logo is used.
const BANKS: Record<BankKey, { name: string; initials: string; icon?: string; wordmark?: string }> = {
  axis: { name: "Axis Bank", initials: "AX", icon: "https://img.ledgers.cloud/assets/axis-icon.svg" },
  icici: { name: "ICICI Bank", initials: "IC", icon: "https://img.ledgers.cloud/assets/icici-icon.svg" },
  indusind: { name: "IndusInd Bank", initials: "IB", wordmark: indusindWordmark },
};

/** Square bank mark: the bank's icon, or its initials when there's no icon (or it fails to load). */
export function BankIcon({ bank, size = 32, className }: { bank: BankKey; size?: number; className?: string }) {
  const meta = BANKS[bank];
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (meta.icon && !failed) {
    return (
      <span style={box} className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white", className)}>
        <img src={meta.icon} alt={meta.name} onError={() => setFailed(true)} className="size-[78%] object-contain" />
      </span>
    );
  }
  return (
    <span
      style={{ ...box, fontSize: Math.max(9, Math.round(size * 0.34)) }}
      className={cn("flex shrink-0 items-center justify-center rounded-md bg-[var(--color-primary-soft)] font-bold text-primary", className)}
      aria-label={meta.name}
    >
      {meta.initials}
    </span>
  );
}

/** Full logo for headers: the wordmark when we have one, otherwise icon + bank name. */
export function BankLogo({ bank, className }: { bank: BankKey; className?: string }) {
  const meta = BANKS[bank];
  if (meta.wordmark) return <img src={meta.wordmark} alt={meta.name} className={cn("h-6 w-auto self-start object-contain", className)} />;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BankIcon bank={bank} size={28} />
      <span className="text-base font-semibold text-foreground">{meta.name}</span>
    </span>
  );
}
