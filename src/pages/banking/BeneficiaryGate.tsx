import { useState } from "react";
import { BadgeCheck, Clock, ExternalLink, UserPlus } from "lucide-react";
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
export function BeneficiaryGate({ payFrom, payees }: { payFrom: PayFromAccount; payees: { key: string; name: string }[] }) {
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

  if (missing.length === 0 && pending.length === 0)
    return one ? (
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-success-accent)]">
        <BadgeCheck className="size-3.5" /> In your {payFrom.short} beneficiaries as <span className="font-mono font-medium">{list[payees[0].key]?.code}</span>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-[var(--color-warning-accent)]/30 bg-[var(--color-warning-soft)] px-3 py-2.5 text-xs">
      {step?.kind === "codes" ? (
        <>
          <div className="text-foreground">
            <span className="font-medium">Beneficiary code</span> · the name you'll search for in {payFrom.short} net banking. Letters and digits, up to {max}.
          </div>
          <div className="flex flex-col gap-2">
            {missing.map((p) => {
              const err = codeError(p.key);
              return (
                <div key={p.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {!one && <span className="w-36 truncate text-foreground">{p.name}</span>}
                  <div className={one ? "w-full" : "w-52"}>
                  <Input
                    autoFocus={p.key === missing[0].key}
                    value={codeOf(p.key)}
                    onChange={(e) => setCodes((c) => ({ ...c, [p.key]: cleanCode(e.target.value, max) }))}
                    aria-label={`Beneficiary code for ${p.name}`}
                    aria-invalid={err ? true : undefined}
                    className="h-8 bg-background font-mono uppercase"
                  />
                  </div>
                  {err && <span className="text-destructive">{err}</span>}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" disabled={!codesValid} onClick={submitCodes}>
              {payFrom.approvalMode === "single" ? "Continue" : one ? "Send to checker" : `Send ${missing.length} to checker`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setStep(null)}>
              Cancel
            </Button>
          </div>
        </>
      ) : step?.kind === "otp" ? (
        <>
          <div className="text-foreground">Enter the OTP {payFrom.short} sent to your registered mobile to add {one ? "this payee" : count(missing.length)}.</div>
          <div className="flex gap-2">
            <Input
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="6-digit OTP"
              aria-label="OTP"
              className="h-8 w-36 bg-background tabular-nums tracking-widest"
            />
            <Button size="sm" variant="primary" disabled={otp.length !== 6 || busy} onClick={confirmOtp}>
              {busy ? <CircularSpinner size={12} className="!text-primary-foreground" /> : null}
              Verify
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setStep({ kind: "codes" })}>
              Back
            </Button>
          </div>
        </>
      ) : missing.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-foreground">
            <UserPlus className="size-3.5 text-[var(--color-warning-accent)]" />
            {one ? `Not in your ${payFrom.short} beneficiaries yet` : `${count(missing.length)} not in your ${payFrom.short} beneficiaries yet`}
          </span>
          <Button size="sm" onClick={startAdd}>
            {one ? "Add beneficiary" : `Add all ${missing.length}`}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-foreground">
              <Clock className="size-3.5 shrink-0 text-[var(--color-warning-accent)]" />
              <span>
                {one ? "Waiting for your checker to approve" : `${count(pending.length)} waiting for your checker to approve`} in {payFrom.short} net banking
                {one && (
                  <>
                    {" "}· search <span className="font-mono font-medium">{list[pending[0].key]?.code}</span>
                  </>
                )}
              </span>
            </span>
            <Button size="sm" onClick={check} disabled={busy}>
              {busy ? <CircularSpinner size={12} /> : null}
              Check status
            </Button>
          </div>
          {!one && (
            <div className="text-muted-foreground">
              Search for: <span className="font-mono text-foreground">{pending.map((p) => list[p.key]?.code).join(", ")}</span>
            </div>
          )}
          {netBanking && (
            <a href={netBanking} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start font-medium text-primary hover:underline">
              Open {payFrom.short} net banking <ExternalLink className="size-3" />
            </a>
          )}
          {notYet && <div className="text-[var(--color-warning-accent)]">Not approved yet.</div>}
        </>
      )}
    </div>
  );
}
