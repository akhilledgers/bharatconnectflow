import { useState } from "react";
import { BadgeCheck, Clock, ExternalLink, UserPlus } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { BANK_CONNECTORS } from "./bankConnectors";
import { cleanCode, suggestCode } from "./beneficiaries";
import { bankKeyFromName, type PayFromAccount } from "./data";

type Step = { kind: "codes" } | { kind: "otp" };

/**
 * For banks that only pay people on the customer's beneficiary list (IndusInd): shows whether the payee(s) are
 * on it, and adds them. Adding asks for a beneficiary code per payee (the name to search by in net banking,
 * suggested from the payee's name); then a single user confirms with an OTP and they're active at once, while
 * under maker & checker they wait for the checker to approve in net banking.
 */
export function BeneficiaryGate({ payFrom, payees, embedded }: { payFrom: PayFromAccount; payees: { key: string; name: string }[]; embedded?: boolean }) {
  const list = useBankingStore((s) => s.beneficiaries[payFrom.id]) ?? {};
  const [step, setStep] = useState<Step | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [notYet, setNotYet] = useState(false);
  if (!payFrom.needsBeneficiary || payees.length === 0) return null;

  const store = useBankingStore.getState;
  const toast = useStore.getState().pushToast;
  const bankKey = bankKeyFromName(payFrom.bank);
  const connector = bankKey ? BANK_CONNECTORS[bankKey] : undefined;
  const max = connector?.beneficiaryList?.codeMax ?? 20;
  const netBanking = connector?.netBankingApproval?.url;
  const missing = payees.filter((p) => !list[p.key]);
  const pending = payees.filter((p) => list[p.key]?.status === "pending");
  const one = payees.length === 1;
  const count = (n: number) => `${n} payee${n === 1 ? "" : "s"}`;

  // Codes already used on this customer ID can't be reused.
  const takenOnBank = new Set(Object.values(list).map((b) => b.code));
  const codeOf = (key: string) => codes[key] ?? "";
  const codeError = (key: string) => {
    const c = codeOf(key);
    if (!c) return "Enter a code";
    if (takenOnBank.has(c)) return "Already used for another beneficiary";
    if (missing.some((p) => p.key !== key && codeOf(p.key) === c)) return "Use a different code for each payee";
    return null;
  };
  const codesValid = missing.every((p) => !codeError(p.key));

  const startAdd = () => {
    const taken = new Set(takenOnBank);
    const next: Record<string, string> = {};
    for (const p of missing) {
      const c = suggestCode(p.name, taken, max);
      taken.add(c);
      next[p.key] = c;
    }
    setCodes(next);
    setStep({ kind: "codes" });
  };

  const submitCodes = () => {
    const entries = missing.map((p) => ({ key: p.key, code: codeOf(p.key) }));
    if (payFrom.approvalMode === "single") {
      setOtp("");
      setStep({ kind: "otp" });
      return;
    }
    store().requestBeneficiaries(payFrom.id, entries);
    setStep(null);
    toast(`Sent to ${payFrom.short}. Your checker approves ${one ? "it" : "them"} in net banking.`);
  };

  const confirmOtp = async () => {
    setBusy(true);
    await store().addBeneficiariesWithOtp(
      payFrom.id,
      missing.map((p) => ({ key: p.key, code: codeOf(p.key) })),
    );
    setBusy(false);
    setStep(null);
    toast(`Added to your ${payFrom.short} beneficiaries`);
  };

  const check = async () => {
    setBusy(true);
    setNotYet(false);
    const n = await store().checkBeneficiaries(
      payFrom.id,
      pending.map((p) => p.key),
    );
    setBusy(false);
    if (n) toast(`${n === 1 ? "Beneficiary" : `${n} beneficiaries`} approved`);
    else setNotYet(true);
  };

  const shell = cn("text-xs", embedded ? "mt-3 border-t border-border pt-3" : "rounded-md border border-border px-3.5 py-3");
  const active = missing.length === 0 && pending.length === 0;
  if (active && !one) return null;

  const inputRow = (props: { value: string; onChange: (v: string) => void; label: string; error?: string | null; mono?: boolean; numeric?: boolean; autoFocus?: boolean; placeholder?: string }) => (
    <div className="min-w-0 flex-1">
      <Input
        autoFocus={props.autoFocus}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-label={props.label}
        aria-invalid={props.error ? true : undefined}
        inputMode={props.numeric ? "numeric" : undefined}
        placeholder={props.placeholder}
        className={cn(props.mono && "font-mono uppercase", props.numeric && "tabular-nums tracking-widest")}
      />
      {props.error && <div className="mt-1 text-destructive">{props.error}</div>}
    </div>
  );

  return (
    <div className={shell}>
      {active ? (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <BadgeCheck className="size-3.5 text-[var(--color-success-accent)]" />
          {payFrom.short} beneficiary · <span className="font-mono text-foreground">{list[payees[0].key]?.code}</span>
        </div>
      ) : step?.kind === "codes" ? (
        <div className="flex flex-col gap-2">
          <div className="font-medium text-foreground">Beneficiary code</div>
          {one ? (
            <div className="flex items-start gap-2">
              {inputRow({
                autoFocus: true,
                value: codeOf(missing[0].key),
                onChange: (v) => setCodes((c) => ({ ...c, [missing[0].key]: cleanCode(v, max) })),
                label: `Beneficiary code for ${missing[0].name}`,
                error: codes[missing[0].key] !== undefined ? codeError(missing[0].key) : null,
                mono: true,
              })}
              <Button variant="primary" disabled={!codesValid} onClick={submitCodes}>
                {payFrom.approvalMode === "single" ? "Continue" : "Send to checker"}
              </Button>
              <Button variant="ghost" onClick={() => setStep(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-start gap-x-3 gap-y-2">
                {missing.map((p, i) => (
                  <div key={p.key} className="contents">
                    <div className="truncate pt-2 text-2sm text-foreground">{p.name}</div>
                    {inputRow({
                      autoFocus: i === 0,
                      value: codeOf(p.key),
                      onChange: (v) => setCodes((c) => ({ ...c, [p.key]: cleanCode(v, max) })),
                      label: `Beneficiary code for ${p.name}`,
                      error: codeError(p.key),
                      mono: true,
                    })}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setStep(null)}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={!codesValid} onClick={submitCodes}>
                  {payFrom.approvalMode === "single" ? "Continue" : `Send ${missing.length} to checker`}
                </Button>
              </div>
            </>
          )}
          <div className="text-muted-foreground">You'll find {one ? "this payee" : "them"} by this in {payFrom.short} net banking.</div>
        </div>
      ) : step?.kind === "otp" ? (
        <div className="flex flex-col gap-2">
          <div className="font-medium text-foreground">OTP sent to your registered mobile</div>
          <div className="flex items-start gap-2">
            {inputRow({ autoFocus: true, value: otp, onChange: (v) => setOtp(v.replace(/\D/g, "").slice(0, 6)), label: "OTP", numeric: true, placeholder: "6-digit OTP" })}
            <Button variant="primary" disabled={otp.length !== 6 || busy} onClick={confirmOtp}>
              {busy ? <CircularSpinner size={12} className="!text-primary-foreground" /> : null}
              Verify
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setStep({ kind: "codes" })}>
              Back
            </Button>
          </div>
        </div>
      ) : missing.length > 0 ? (
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <UserPlus className="size-3.5" />
            {one ? `Not in your ${payFrom.short} beneficiaries` : `${count(missing.length)} not in your ${payFrom.short} beneficiaries`}
          </span>
          <Button size="sm" onClick={startAdd}>
            {one ? "Add beneficiary" : `Add all ${missing.length}`}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5 shrink-0 text-[var(--color-warning-accent)]" />
              <span className="min-w-0">
                Waiting for checker approval{!one && ` · ${count(pending.length)}`} · search{" "}
                <span className="font-mono text-foreground">{pending.map((p) => list[p.key]?.code).join(", ")}</span>
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={check} disabled={busy} className="shrink-0">
              {busy ? <CircularSpinner size={12} /> : null}
              Check status
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {netBanking && (
              <a href={netBanking} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                Open {payFrom.short} net banking <ExternalLink className="size-3" />
              </a>
            )}
            {notYet && <span className="text-[var(--color-warning-accent)]">Not approved yet</span>}
          </div>
        </div>
      )}
    </div>
  );
}
