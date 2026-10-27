import { useState } from "react";
import { CreditCard, Landmark, Wallet, Zap } from "lucide-react";
import { cn } from "../../lib/cn";
import indusindIcon from "../../assets/banks/indusind-icon.png";
import indusindWordmark from "../../assets/banks/indusind-wordmark.webp";
import { groupOf, type BankKey, type CompanyAccount } from "./data";

// Square icons come from the LEDGERS asset CDN, same as the live app. IndusInd's is the bull mark from
// indusind.bank.in (their favicon). It's a filled tile, so it sits a little smaller in the frame to look
// the same size as the open marks.
const BANKS: Record<BankKey, { name: string; initials: string; icon?: string; tile?: boolean; wordmark?: string }> = {
  axis: { name: "Axis Bank", initials: "AX", icon: "https://img.ledgers.cloud/assets/axis-icon.svg" },
  icici: { name: "ICICI Bank", initials: "IC", icon: "https://img.ledgers.cloud/assets/icici-icon.svg" },
  indusind: { name: "IndusInd Bank", initials: "IB", icon: indusindIcon, tile: true, wordmark: indusindWordmark },
};

/** Square bank mark: the bank's icon, or its initials when there's no icon (or it fails to load). */
export function BankIcon({ bank, size = 32, className }: { bank: BankKey; size?: number; className?: string }) {
  const meta = BANKS[bank];
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (meta.icon && !failed) {
    return (
      <span style={box} className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white", className)}>
        <img
          src={meta.icon}
          alt={meta.name}
          onError={() => setFailed(true)}
          className={cn("object-contain", meta.tile ? "size-[62%] rounded-[3px]" : "size-[78%]")}
        />
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
export function BankLogo({ bank, size = "md", className }: { bank: BankKey; size?: "sm" | "md"; className?: string }) {
  const meta = BANKS[bank];
  const sm = size === "sm";
  if (meta.wordmark)
    return <img src={meta.wordmark} alt={meta.name} className={cn("w-auto self-start object-contain", sm ? "h-[18px]" : "h-6", className)} />;
  return (
    <span className={cn("inline-flex items-center gap-2 self-start", className)}>
      <BankIcon bank={bank} size={sm ? 22 : 28} />
      <span className={cn("font-semibold text-foreground", sm ? "text-sm" : "text-base")}>{meta.name}</span>
    </span>
  );
}

/** Any company account's mark: the bank's icon when LEDGERS knows the bank, else an icon for its kind. */
export function AccountIcon({ account, size = 32 }: { account: Pick<CompanyAccount, "type" | "bankKey">; size?: number }) {
  if (account.bankKey) return <BankIcon bank={account.bankKey} size={size} />;
  const g = groupOf(account);
  const Icon = g === "card" ? CreditCard : g === "gateway" ? Zap : g === "wallet" ? Wallet : Landmark;
  return (
    <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <Icon style={{ width: size / 2, height: size / 2 }} />
    </span>
  );
}
