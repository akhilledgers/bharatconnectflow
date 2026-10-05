import { useState } from "react";
import { Check, Landmark, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { BankIcon } from "./BankLogo";
import { CONNECTED_BANKING, IFSC_BANKS, digitsOnly, last4, type CompanyAccount } from "./data";
import { OVERLAY } from "./shared";
import { useEscape } from "./useEscape";

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Banking → Accounts → Add bank account. IFSC first: it identifies the bank and branch. */
export function AddBankAccountDrawer({ onClose, onConnect }: { onClose: () => void; onConnect: (accountId: string) => void }) {
  const hasPrimary = useBankingStore((s) => s.accounts.some((a) => a.active && a.primary));
  const [ifsc, setIfsc] = useState("");
  const [number, setNumber] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [type, setType] = useState<CompanyAccount["type"]>("Current");
  const [primary, setPrimary] = useState(!hasPrimary);
  const [verify, setVerify] = useState(true);
  const [phase, setPhase] = useState<"form" | "saving" | "added">("form");
  const [added, setAdded] = useState<{ account: CompanyAccount; verified: boolean } | null>(null);
  useEscape(onClose);

  const ifscValid = IFSC_RE.test(ifsc);
  const known = ifscValid ? IFSC_BANKS[ifsc.slice(0, 4)] : undefined;
  const mismatch = confirm !== "" && confirm !== number;
  const canSave = ifscValid && number.length >= 9 && confirm === number && phase === "form";

  const save = async () => {
    if (!canSave) return;
    setPhase("saving");
    const store = useBankingStore.getState();
    const account = store.addCompanyAccount({ ifsc, number, nickname: nickname.trim(), type, primary });
    const verified = verify ? await store.verifyOwnAccount(account.id) : false;
    if (verify && !verified)
      useStore.getState().pushToast(`Account added, but ${account.bank} couldn't verify it. You can retry from the list.`, "error");
    if (account.bankKey) {
      setAdded({ account, verified });
      setPhase("added");
      return;
    }
    useStore.getState().pushToast(`${account.bank} ${last4(number)} added${verified ? " and verified" : ""}`);
    onClose();
  };

  return (
    <>
      <div className={OVERLAY} onClick={phase === "saving" ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add bank account"
        className="fixed bottom-5 end-5 top-5 z-50 flex w-[440px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg animate-[drawer-in_.4s_cubic-bezier(.4,0,.2,1)]"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="text-base font-semibold">Add bank account</div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} disabled={phase === "saving"} aria-label="Close">
            <X />
          </Button>
        </div>

        {phase === "added" && added ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex size-[52px] items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success-accent)]">
              <Check className="size-6" />
            </div>
            <div>
              <div className="text-base font-semibold">
                {added.account.bank} {last4(added.account.number)} added
              </div>
              <p className="mt-1.5 text-2sm leading-relaxed text-muted-foreground">
                Connect {CONNECTED_BANKING[added.account.bankKey!].short} banking to send payments from LEDGERS and keep balance and
                statements in sync automatically.
              </p>
            </div>
            <div className="mt-2 flex w-full gap-2.5">
              <Button className="h-10 flex-1 px-4 text-sm" onClick={onClose}>
                Later
              </Button>
              <Button variant="primary" className="h-10 flex-[2] px-4 text-sm" onClick={() => onConnect(added.account.id)}>
                Connect banking
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="add-ifsc" className="text-xs font-medium">
                  IFSC code
                </label>
                <Input
                  id="add-ifsc"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
                  placeholder="e.g. INDB0000007"
                  autoFocus
                  aria-invalid={ifsc.length === 11 && !ifscValid ? true : undefined}
                  className="uppercase tabular-nums placeholder:normal-case"
                />
                {ifsc.length === 11 && !ifscValid ? (
                  <p className="text-xs text-destructive">That isn't a valid IFSC. It has 4 letters, a 0, then 6 letters or digits.</p>
                ) : ifscValid ? (
                  <div className="flex items-center gap-2.5 rounded-md bg-muted px-3 py-2">
                    {known?.bankKey ? (
                      <BankIcon bank={known.bankKey} size={24} />
                    ) : (
                      <Landmark className="size-4 text-muted-foreground" />
                    )}
                    <div className="min-w-0 text-xs">
                      <div className="font-medium text-foreground">{known?.bank ?? "Bank found"}</div>
                      <div className="text-muted-foreground">{known?.branch ?? `Branch ${ifsc.slice(5)}`}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Fills in the bank and branch.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor="add-number" className="text-xs font-medium">
                    Account number
                  </label>
                  <Input id="add-number" value={number} onChange={(e) => setNumber(digitsOnly(e.target.value))} inputMode="numeric" className="tabular-nums" />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor="add-confirm" className="text-xs font-medium">
                    Confirm account number
                  </label>
                  <Input
                    id="add-confirm"
                    value={confirm}
                    onChange={(e) => setConfirm(digitsOnly(e.target.value))}
                    onPaste={(e) => e.preventDefault()}
                    inputMode="numeric"
                    aria-invalid={mismatch ? true : undefined}
                    className="tabular-nums"
                  />
                </div>
              </div>
              {mismatch && <p className="-mt-3 text-xs text-destructive">Account numbers don't match.</p>}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="add-nickname" className="text-xs font-medium">
                  Nickname <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input id="add-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Payroll, Vendor payments" />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="text-xs font-medium">Account type</div>
                <div role="radiogroup" className="flex gap-1 rounded-lg border border-border/80 bg-muted/80 p-1">
                  {(["Current", "Savings"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={type === t}
                      onClick={() => setType(t)}
                      className={cn("h-8 flex-1 cursor-pointer rounded-md text-2sm", type === t && "bg-background font-medium shadow-lg shadow-black/5")}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <label className="flex cursor-pointer items-start gap-2.5 text-2sm">
                  <input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
                  <span>
                    Verify account now
                    <span className="block text-xs text-muted-foreground">Instant check with the bank. No money is moved.</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 text-2sm">
                  <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
                  <span>
                    Set as primary account
                    <span className="block text-xs text-muted-foreground">Shown on invoices and used by default.</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border px-6 py-4">
              <Button onClick={onClose} disabled={phase === "saving"}>
                Cancel
              </Button>
              <Button variant="primary" onClick={save} disabled={!canSave && phase === "form"}>
                {phase === "saving" ? (
                  <>
                    <CircularSpinner size={14} className="!text-primary-foreground" /> {verify ? "Verifying…" : "Adding…"}
                  </>
                ) : (
                  "Add account"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
