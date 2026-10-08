import { useEffect, useState } from "react";
import { AlertTriangle, Check, Eye, EyeOff, Landmark, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { BankIcon } from "./BankLogo";
import { CONNECTED_BANKING, FY_START, digitsOnly, fmtINR, last4, type CompanyAccount } from "./data";
import { lookupIfsc, type IfscResult } from "./ifscLookup";
import { OVERLAY } from "./shared";
import { useEscape } from "./useEscape";

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const toDMY = (iso: string) => iso.split("-").reverse().join("-");
const fyLabel = (iso: string) => {
  const y = Number(iso.slice(0, 4));
  return `FY ${y}–${String(y + 1).slice(2)}`;
};

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
  const [showNumber, setShowNumber] = useState(false);
  const [lookup, setLookup] = useState<{ code: string; result: IfscResult | null }>({ code: "", result: null });
  const [openingAmount, setOpeningAmount] = useState("");
  const [overdrawn, setOverdrawn] = useState(false);
  const [openingDate, setOpeningDate] = useState(FY_START);
  const [phase, setPhase] = useState<"form" | "saving" | "added">("form");
  const [added, setAdded] = useState<{ account: CompanyAccount; verified: boolean } | null>(null);
  useEscape(onClose);

  const ifscValid = IFSC_RE.test(ifsc);
  // Look the IFSC up as soon as it's complete; a stale answer for an earlier code is ignored.
  useEffect(() => {
    if (!ifscValid) return;
    let live = true;
    lookupIfsc(ifsc).then((result) => live && setLookup({ code: ifsc, result }));
    return () => {
      live = false;
    };
  }, [ifsc, ifscValid]);
  const result = ifscValid && lookup.code === ifsc ? lookup.result : null;
  const checking = ifscValid && !result;
  const info = result?.status === "found" ? result.info : undefined;
  const notFound = result?.status === "not-found";

  // Only flag a mismatch once the second number is as long as the first, so typing isn't shouted at.
  const mismatch = confirm.length >= number.length && confirm !== "" && confirm !== number;
  const opening = openingAmount === "" ? null : Number(openingAmount);
  const beforeFy = openingDate < FY_START;
  const canSave = ifscValid && !notFound && !checking && number.length >= 9 && confirm === number && opening !== null && !!openingDate && !beforeFy && phase === "form";

  const save = async () => {
    if (!canSave) return;
    setPhase("saving");
    const store = useBankingStore.getState();
    const account = store.addCompanyAccount({
      ifsc,
      number,
      nickname: nickname.trim(),
      type,
      primary,
      bank: info?.bank,
      opening: { amount: overdrawn ? -opening! : opening!, date: toDMY(openingDate) },
    });
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
                ) : checking ? (
                  <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                    <CircularSpinner size={12} /> Checking IFSC…
                  </div>
                ) : notFound ? (
                  <div className="flex items-start gap-2 rounded-md bg-[var(--color-destructive-soft)] px-3 py-2.5 text-xs text-[var(--color-destructive-accent)]">
                    <AlertTriangle className="mt-px size-3.5 shrink-0" />
                    No branch has this IFSC. Check it on a cheque leaf or the passbook.
                  </div>
                ) : info ? (
                  <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/50 px-3 py-2.5">
                    {info.bankKey ? <BankIcon bank={info.bankKey} size={28} /> : <Landmark className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex items-center gap-1.5 text-2sm font-medium text-foreground">
                        {info.bank}
                        <Check className="size-3.5 text-[var(--color-success-accent)]" />
                      </div>
                      <div className="text-muted-foreground">{[info.branch, info.city, info.state].filter(Boolean).join(", ")}</div>
                      {info.address && <div className="mt-0.5 text-muted-foreground">{info.address}</div>}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(["neft", "rtgs", "imps", "upi"] as const).map((rail) => (
                          <span
                            key={rail}
                            className={cn(
                              "rounded px-1.5 py-px text-[10px] font-semibold uppercase",
                              info[rail] ? "bg-[var(--color-success-soft)] text-[var(--color-success-accent)]" : "bg-muted text-muted-foreground line-through",
                            )}
                          >
                            {rail}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : result?.status === "unreachable" ? (
                  <p className="text-xs text-[var(--color-warning-accent)]">Couldn't reach the IFSC directory to confirm the branch. You can still add the account.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">We'll find the bank and branch.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor="add-number" className="text-xs font-medium">
                    Account number
                  </label>
                  <div className="relative">
                    <Input
                      id="add-number"
                      type={showNumber ? "text" : "password"}
                      value={number}
                      onChange={(e) => setNumber(digitsOnly(e.target.value))}
                      onCopy={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      inputMode="numeric"
                      autoComplete="off"
                      className="pe-9 tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNumber(!showNumber)}
                      aria-label={showNumber ? "Hide account number" : "Show account number"}
                      className="absolute end-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      {showNumber ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
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
                    onDrop={(e) => e.preventDefault()}
                    inputMode="numeric"
                    autoComplete="off"
                    aria-invalid={mismatch ? true : undefined}
                    className="tabular-nums"
                  />
                </div>
              </div>
              <p className={cn("-mt-3 text-xs", mismatch ? "text-destructive" : confirm && confirm === number ? "text-[var(--color-success-accent)]" : "text-muted-foreground")}>
                {mismatch
                  ? "Account numbers don't match."
                  : confirm && confirm === number
                    ? `Account numbers match · ending ${number.slice(-4)}`
                    : "The first number is hidden. Type it again to confirm; pasting is turned off."}
              </p>

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
                <div>
                  <div className="text-sm font-medium">Opening balance</div>
                  <p className="text-xs text-muted-foreground">The balance your books start from for this account, so your balance sheet is right.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <label htmlFor="add-opening" className="text-xs font-medium">
                      Amount (₹)
                    </label>
                    <Input
                      id="add-opening"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="tabular-nums"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <label htmlFor="add-opening-date" className="text-xs font-medium">
                      As on
                    </label>
                    <Input id="add-opening-date" type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
                  </div>
                </div>
                <div role="radiogroup" aria-label="Balance type" className="flex gap-1 rounded-lg border border-border/80 bg-muted/80 p-1">
                  {([false, true] as const).map((od) => (
                    <button
                      key={String(od)}
                      type="button"
                      role="radio"
                      aria-checked={overdrawn === od}
                      onClick={() => setOverdrawn(od)}
                      className={cn("h-8 flex-1 cursor-pointer rounded-md text-2sm", overdrawn === od && "bg-background font-medium shadow-lg shadow-black/5")}
                    >
                      {od ? "Overdrawn (OD / CC)" : "Money in the account"}
                    </button>
                  ))}
                </div>
                <p className={cn("text-xs", beforeFy ? "text-[var(--color-warning-accent)]" : "text-muted-foreground")}>
                  {beforeFy
                    ? `That's before your financial year starts (${fmtDate(FY_START)}). Enter the balance as on ${fmtDate(FY_START)} instead.`
                    : openingDate === FY_START
                      ? `Start of ${fyLabel(FY_START)}. Opened later in the year? Pick the opening date and enter 0 or the first deposit.`
                      : `Opened during ${fyLabel(FY_START)}: the balance before ${fmtDate(openingDate)} is taken as zero.`}
                  {opening !== null && opening > 0 && !beforeFy && ` ${fmtINR(overdrawn ? -opening : opening)} as on ${fmtDate(openingDate)}.`}
                </p>
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
