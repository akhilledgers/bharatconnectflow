import { useState } from "react";
import { Landmark, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { BankIcon } from "./BankLogo";
import { ONBOARDING_BANKS } from "./data";
import { OVERLAY } from "./shared";
import { useEscape } from "./useEscape";

/** Shown instead of the transfer drawers when no bank account is connected. */
export function ConnectBankDialog({ onClose, onConnectExisting }: { onClose: () => void; onConnectExisting: () => void }) {
  const [redirectBank, setRedirectBank] = useState<string | null>(null);
  const [statusShown, setStatusShown] = useState(false);
  useEscape(onClose);

  return (
    <>
      <div className={OVERLAY} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connect a Bank Account"
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[512px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-auto rounded-lg border border-border bg-background px-6 pb-8 pt-6 shadow-lg animate-[fade-in_.15s_ease]"
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
              <div className="text-base font-semibold">Connect a Bank Account</div>
              <div className="text-2sm leading-normal text-muted-foreground">You'll need a connected account before you can send transfers.</div>
            </div>

            <div className="flex flex-col gap-2.5">
              {ONBOARDING_BANKS.map((bank) => (
                <div key={bank.key} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3.5">
                  <BankIcon bank={bank.key} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{bank.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">Current account onboarding</div>
                  </div>
                  <Button size="sm" className="shrink-0" onClick={() => setRedirectBank(bank.name)}>
                    Get Started
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5 text-center">
              <button type="button" onClick={onConnectExisting} className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                Already have a current account with one of these banks? Connect it
              </button>
              <button type="button" onClick={() => setStatusShown(!statusShown)} className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                Already applied? Check your application status
              </button>
              {statusShown && <div className="text-xs text-muted-foreground">No pending applications found for your organization.</div>}
            </div>
          </>
        )}
      </div>
    </>
  );
}
