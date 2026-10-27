import { useState } from "react";
import { Landmark, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { BankIcon } from "./BankLogo";
import { useBankingStore } from "../../store/useBankingStore";
import { ONBOARDING_BANKS, type BankKey } from "./data";
import { OVERLAY } from "./shared";
import { useEscape } from "./useEscape";

/**
 * Shown instead of the transfer drawers when no bank account is connected.
 * Picking a bank connects the company's account with it, or adds one first.
 * "Open one" switches the list to the banks' current account onboarding.
 */
export function ConnectBankDialog({
  onClose,
  onConnectAccount,
  onAddAccount,
}: {
  onClose: () => void;
  onConnectAccount: (accountId: string) => void;
  onAddAccount: (bank: BankKey) => void;
}) {
  const accounts = useBankingStore((s) => s.accounts);
  const [opening, setOpening] = useState(false);
  const [redirectBank, setRedirectBank] = useState<string | null>(null);
  const [statusShown, setStatusShown] = useState(false);
  useEscape(onClose);

  const pick = (bank: (typeof ONBOARDING_BANKS)[number]) => {
    if (opening) return setRedirectBank(bank.name);
    const own = accounts.filter((a) => a.active && a.bankKey === bank.key);
    // Prefer one that still needs connecting; a connected one opens as a reconnect / status check.
    const account = own.find((a) => a.connection !== "connected") ?? own[0];
    if (account) onConnectAccount(account.id);
    else onAddAccount(bank.key);
  };

  return (
    <>
      <div className={OVERLAY} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={opening ? "Open a current account" : "Connect a bank account"}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[440px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-auto rounded-lg border border-border bg-background px-6 pb-6 pt-6 shadow-lg animate-[fade-in_.15s_ease]"
      >
        <Button variant="ghost" size="icon-sm" className="absolute end-4 top-4" onClick={onClose} aria-label="Close">
          <X />
        </Button>

        {redirectBank ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-[var(--color-primary-soft)]">
              <div className="size-[18px] animate-spin rounded-full border-[2.5px] border-primary border-t-transparent" />
            </div>
            <div className="text-[15px] font-semibold">Redirecting to {redirectBank}</div>
            <div className="text-2sm leading-normal text-muted-foreground">
              This opens {redirectBank}'s current account onboarding. (Placeholder in this prototype — no real redirect happens.)
            </div>
            <button type="button" onClick={() => setRedirectBank(null)} className="cursor-pointer text-2sm font-semibold text-primary hover:underline">
              Back
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-primary">
                <Landmark className="size-6" />
              </div>
              <div className="text-base font-semibold">{opening ? "Open a current account" : "Connect a bank account"}</div>
              {!opening && <div className="text-2sm text-muted-foreground">Needed to send payments.</div>}
            </div>

            <div className="flex flex-col gap-2">
              {ONBOARDING_BANKS.map((bank) => (
                <div key={bank.key} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                  <BankIcon bank={bank.key} size={32} />
                  <div className="min-w-0 flex-1 text-sm font-semibold">{bank.name}</div>
                  <Button size="sm" className="shrink-0" onClick={() => pick(bank)}>
                    {opening ? "Open account" : "Connect"}
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5 text-center">
              {opening ? (
                <>
                  <button type="button" onClick={() => setStatusShown(!statusShown)} className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                    Already applied? Check status
                  </button>
                  {statusShown && <div className="text-xs text-muted-foreground">No pending applications.</div>}
                  <button type="button" onClick={() => setOpening(false)} className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                    Back
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setOpening(true)} className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                  No account with these banks? Open one
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
