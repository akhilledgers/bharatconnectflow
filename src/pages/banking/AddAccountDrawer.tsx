import { useEffect, useState } from "react";
import { AlertTriangle, Check, Eye, EyeOff, Landmark, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input, Select } from "../../components/ui/input";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { BankIcon } from "./BankLogo";
import { CONNECTED_BANKING, FY_START, IFSC_BANKS, digitsOnly, groupOf, isCredit, last4, type BankKey, type CompanyAccount } from "./data";
import { lookupIfsc, type IfscResult } from "./ifscLookup";
import { CashAccountForm } from "./CashAccountForm";
import { OtherAccountForm } from "./OtherAccountForm";
import { OVERLAY } from "./shared";
import { useEscape } from "./useEscape";

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const toDMY = (iso: string) => iso.split("-").reverse().join("-");
const fyLabel = (iso: string) => {
  const y = Number(iso.slice(0, 4));
  return `FY ${String(y).slice(2)}–${String(y + 1).slice(2)}`;
};
/** Opening balances are taken at the start of a financial year: this one and the few before it. */
const FY_STARTS = [0, 1, 2, 3].map((n) => `${Number(FY_START.slice(0, 4)) - n}${FY_START.slice(4)}`);
/** Digits with an optional leading minus (overdrawn) and one decimal point. */
const signedAmount = (v: string) => {
  const neg = v.trim().startsWith("-");
  return (neg ? "-" : "") + v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
};
const ACCOUNT_TYPES: CompanyAccount["type"][] = ["Current", "Savings", "Cash credit (CC)", "Overdraft (OD)"];
const OTHER_TYPES = ["Credit card", "Payment gateway", "Wallet"] as const;
/** The Account type option that switches the drawer to a cash account. */
const CASH = "cash";

/**
 * Banking → Add account: the type first (bank or cash), then its fields. A bank account: account number (twice),
 * IFSC, then type and opening balance. A cash account: a sub-account under Cash in hand (CashAccountForm).
 */
export function AddAccountDrawer({
  type: initialType,
  bank,
  onClose,
  onConnect,
}: {
  /** Opened from a cash button: Cash is picked; otherwise Current. Either can be changed in Account type. */
  type?: "bank" | "cash";
  /** Started from a bank (Connect a Bank Account): its IFSC prefix is filled in. */
  bank?: BankKey;
  onClose: () => void;
  onConnect: (accountId: string) => void;
}) {
  const [kind, setKind] = useState<"bank" | "cash" | "other">(initialType ?? "bank");
  // OD / CC: the sanctioned limit, optional. With it, Banking shows what's available and warns near the limit.
  const [limit, setLimit] = useState("");
  const hasPrimary = useBankingStore((s) => s.accounts.some((a) => a.active && a.primary));
  const [ifsc, setIfsc] = useState(() => (bank ? (Object.keys(IFSC_BANKS).find((p) => IFSC_BANKS[p].bankKey === bank) ?? "") : ""));
  const [number, setNumber] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [type, setType] = useState<CompanyAccount["type"]>("Current");
  const [primary, setPrimary] = useState(!hasPrimary);
  const [verify, setVerify] = useState(true);
  const [showNumber, setShowNumber] = useState(false);
  const [lookup, setLookup] = useState<{ code: string; result: IfscResult | null }>({ code: "", result: null });
  const [openingAmount, setOpeningAmount] = useState("");
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
  const showConfirm = number.length >= 9 || confirm !== "";
  const opening = openingAmount === "" || openingAmount === "-" ? null : Number(openingAmount);
  const canSave = ifscValid && !notFound && !checking && number.length >= 9 && confirm === number && opening !== null && phase === "form";

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
      opening: { amount: opening!, date: toDMY(openingDate) },
      limit: isCredit({ type }) && limit ? Number(limit) : undefined,
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

  // The account type comes first and decides the fields: a bank type (Current by default), a card, gateway or
  // wallet, or Cash.
  const typePicker = (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="add-type" className="text-xs font-medium">
        Account type
      </label>
      <Select
        id="add-type"
        value={kind === "cash" ? CASH : type}
        onChange={(e) => {
          if (e.target.value === CASH) return setKind("cash");
          const next = e.target.value as CompanyAccount["type"];
          setType(next);
          setKind(groupOf({ type: next }) === "bank" ? "bank" : "other");
        }}
      >
        <optgroup label="Bank">
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </optgroup>
        <optgroup label="Other">
          {OTHER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value={CASH}>Cash account</option>
        </optgroup>
      </Select>
    </div>
  );

  return (
    <>
      <div className={OVERLAY} onClick={phase === "saving" ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add account"
        className="fixed bottom-5 end-5 top-5 z-50 flex w-[440px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg animate-[drawer-in_.4s_cubic-bezier(.4,0,.2,1)]"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="text-base font-semibold">Add account</div>
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
        ) : kind === "cash" ? (
          <CashAccountForm top={typePicker} onClose={onClose} />
        ) : kind === "other" ? (
          <OtherAccountForm key={type} type={type as (typeof OTHER_TYPES)[number]} top={typePicker} onClose={onClose} />
        ) : (
          <>
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
              {typePicker}
              {kind === "bank" && (
              <>
              <div className={cn("grid gap-3", showConfirm && "grid-cols-2")}>
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
                      autoFocus
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
                {showConfirm && (
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
                )}
              </div>
              {mismatch && <p className="-mt-3 text-xs text-destructive">Numbers don't match</p>}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="add-ifsc" className="text-xs font-medium">
                  IFSC code
                </label>
                <Input
                  id="add-ifsc"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
                  placeholder="e.g. INDB0000007"
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
                ) : null}
              </div>


              <div className="flex flex-col gap-1.5">
                <label htmlFor="add-nickname" className="text-xs font-medium">
                  Nickname <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input id="add-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Payroll, Vendor payments" />
              </div>

              {isCredit({ type }) && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="add-limit" className="text-xs font-medium">
                    Sanctioned limit (₹) <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="add-limit"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                    inputMode="decimal"
                    placeholder="e.g. 500000"
                    className="tabular-nums"
                  />
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <div className="text-sm font-medium">Opening balance</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <label htmlFor="add-opening" className="text-xs font-medium">
                      Amount (₹)
                    </label>
                    <Input
                      id="add-opening"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(signedAmount(e.target.value))}
                      inputMode="decimal"
                      placeholder="e.g. 25000 or -15000"
                      className="tabular-nums"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <label htmlFor="add-opening-date" className="text-xs font-medium">
                      As on
                    </label>
                    <Select id="add-opening-date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)}>
                      {FY_STARTS.map((d) => (
                        <option key={d} value={d}>
                          {fmtDate(d)} · {fyLabel(d)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <label className="flex cursor-pointer items-center gap-2.5 text-2sm">
                  <input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} className="size-4 accent-primary" />
                  <span>
                    Verify account now
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 text-2sm">
                  <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} className="size-4 accent-primary" />
                  <span>Set as primary account</span>
                </label>
              </div>
              </>
              )}
            </div>

            {kind === "bank" && (
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
            )}
          </>
        )}
      </div>
    </>
  );
}
