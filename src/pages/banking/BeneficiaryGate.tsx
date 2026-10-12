import { useState } from "react";
import { BadgeCheck, Clock, ExternalLink, UserPlus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { BANK_CONNECTORS } from "./bankConnectors";
import { bankKeyFromName, type PayFromAccount } from "./data";

/**
 * For banks that only pay people on the customer's beneficiary list (IndusInd): shows whether the payee(s) are
 * on it, and adds them — a single user confirms with an OTP and they're active at once; under maker & checker
 * they wait for the checker to approve in net banking.
 */
export function BeneficiaryGate({ payFrom, keys, label }: { payFrom: PayFromAccount; keys: string[]; label?: string }) {
  const list = useBankingStore((s) => s.beneficiaries[payFrom.id]) ?? {};
  const [otpFor, setOtpFor] = useState<string[] | null>(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [notYet, setNotYet] = useState(false);
  if (!payFrom.needsBeneficiary || keys.length === 0) return null;

  const store = useBankingStore.getState;
  const toast = useStore.getState().pushToast;
  const bankKey = bankKeyFromName(payFrom.bank);
  const netBanking = bankKey ? BANK_CONNECTORS[bankKey].netBankingApproval?.url : undefined;
  const missing = keys.filter((k) => !list[k]);
  const pending = keys.filter((k) => list[k] === "pending");
  const one = keys.length === 1;
  const who = one ? (label ?? "This payee") : `${missing.length || pending.length} payee${(missing.length || pending.length) === 1 ? "" : "s"}`;

  if (missing.length === 0 && pending.length === 0)
    return one ? (
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-success-accent)]">
        <BadgeCheck className="size-3.5" /> In your {payFrom.short} beneficiaries
      </div>
    ) : null;

  const add = () => {
    if (payFrom.approvalMode === "single") {
      setOtpFor(missing);
      setOtp("");
      return;
    }
    store().requestBeneficiaries(payFrom.id, missing);
    toast(`Sent to ${payFrom.short}. Your checker approves ${one ? "it" : "them"} in net banking.`);
  };

  const confirmOtp = async () => {
    setBusy(true);
    await store().addBeneficiariesWithOtp(payFrom.id, otpFor!);
    setBusy(false);
    setOtpFor(null);
    toast(`Added to your ${payFrom.short} beneficiaries`);
  };

  const check = async () => {
    setBusy(true);
    setNotYet(false);
    const n = await store().checkBeneficiaries(payFrom.id, pending);
    setBusy(false);
    if (n) toast(`${n === 1 ? "Beneficiary" : `${n} beneficiaries`} approved`);
    else setNotYet(true);
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-[var(--color-warning-accent)]/30 bg-[var(--color-warning-soft)] px-3 py-2.5 text-xs">
      {otpFor ? (
        <>
          <div className="text-foreground">Enter the OTP {payFrom.short} sent to your registered mobile to add {one ? "this payee" : `${otpFor.length} payees`}.</div>
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
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOtpFor(null)}>
              Cancel
            </Button>
          </div>
        </>
      ) : missing.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-foreground">
            <UserPlus className="size-3.5 text-[var(--color-warning-accent)]" />
            {one ? `Not in your ${payFrom.short} beneficiaries yet` : `${who} not in your ${payFrom.short} beneficiaries yet`}
          </span>
          <Button size="sm" onClick={add}>
            {one ? "Add beneficiary" : `Add all ${missing.length}`}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-foreground">
              <Clock className="size-3.5 text-[var(--color-warning-accent)]" />
              {one ? "Waiting for your checker to approve" : `${who} waiting for your checker to approve`} in {payFrom.short} net banking
            </span>
            <Button size="sm" onClick={check} disabled={busy}>
              {busy ? <CircularSpinner size={12} /> : null}
              Check status
            </Button>
          </div>
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
