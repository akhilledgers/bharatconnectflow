import { useState, type ReactNode } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import type { Business } from "../../../../types";
import { useStore } from "../../../../store/useStore";
import { Button } from "../../../../components/ui/button";
import { Input, Label } from "../../../../components/ui/input";

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function Step({ done, title, children }: { done: boolean; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-border py-3 first:pt-0">
      {done ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {children}
      </div>
    </div>
  );
}

/**
 * GST connection (ownership) and bank account, shown above the KYC documents in the Reach Full
 * Verification dialog.
 * - Existing GST-activated customer: GSTIN already connected, nothing to do.
 * - New to LEDGERS: GST portal username + GSTIN → OTP via the GSP to the GSTIN's registered mobile.
 *   That OTP is also the handbook's ownership check (mobile linked with the GSTIN).
 * - Bank: taken from LEDGERS when verified; otherwise verify an existing account or add one inline,
 *   each confirmed with a ₹1 penny-drop.
 */
export function VerificationSteps({ business }: { business: Business }) {
  return (
    <div className="mb-4">
      <GstStep business={business} />
      <BankStep business={business} />
    </div>
  );
}

function GstStep({ business }: { business: Business }) {
  const sendGstOtp = useStore((s) => s.sendGstOtp);
  const verifyGstOtp = useStore((s) => s.verifyGstOtp);
  const [username, setUsername] = useState("");
  const [gstin, setGstin] = useState(business.gstin ?? "");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (business.gstConnected) {
    return (
      <Step done title="GSTIN Connected">
        <p className="text-xs text-muted-foreground">{business.gstin}</p>
      </Step>
    );
  }

  const gstinValid = GSTIN_RE.test(gstin);

  async function send() {
    if (!username.trim()) return setError("Enter your GST portal username.");
    if (!gstinValid) return setError("GSTIN is invalid. Check the 15 characters and try again.");
    setError(null);
    setBusy(true);
    await sendGstOtp(business.id, username.trim(), gstin);
    setBusy(false);
    setOtpSent(true);
  }

  async function verify() {
    setBusy(true);
    const ok = await verifyGstOtp(business.id, otp);
    setBusy(false);
    if (!ok) setError("That code didn't match. Check and try again.");
  }

  return (
    <Step done={false} title="Connect GSTIN">
      <p className="mb-2.5 text-xs text-muted-foreground">We'll send an OTP to the mobile registered on your GSTIN.</p>
      {!otpSent ? (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gst-username">GST Portal Username</Label>
              <Input id="gst-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter Username" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gst-gstin">GSTIN</Label>
              <Input
                id="gst-gstin"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))}
                placeholder="Enter GSTIN"
                aria-invalid={gstin.length === 15 && !gstinValid ? true : undefined}
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={send} disabled={busy}>
            {busy ? "Sending…" : "Send OTP"}
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="gst-otp">OTP</Label>
          <div className="flex items-center gap-2">
            <Input
              id="gst-otp"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError(null);
              }}
              placeholder="6-digit code"
              className="max-w-40"
              aria-invalid={error ? true : undefined}
            />
            <Button variant="outline" onClick={verify} disabled={otp.length !== 6 || busy}>
              {busy ? "Verifying…" : "Verify"}
            </Button>
            <Button variant="link" size="sm" onClick={send} disabled={busy}>
              Resend
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </Step>
  );
}

function BankStep({ business }: { business: Business }) {
  const addBankAccount = useStore((s) => s.addBankAccount);
  const verifyBankAccount = useStore((s) => s.verifyBankAccount);
  const [acNum, setAcNum] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [beneficiary, setBeneficiary] = useState(business.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verified = business.bankAccounts.find((a) => a.verified);
  const unverified = business.bankAccounts.find((a) => !a.verified);

  if (verified) {
    return (
      <Step done title="Bank Details Connected">
        <p className="text-xs text-muted-foreground">
          {verified.beneficiaryName} · {verified.ifsc} ending {verified.accountEnding}
        </p>
      </Step>
    );
  }

  if (unverified) {
    return (
      <Step done={false} title="Verify Bank Account">
        <p className="mb-2.5 text-xs text-muted-foreground">
          {unverified.beneficiaryName} · {unverified.ifsc} ending {unverified.accountEnding}. We'll send ₹1 to confirm it.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await verifyBankAccount(business.id, unverified.id);
            setBusy(false);
          }}
        >
          {busy ? "Verifying…" : "Verify with ₹1"}
        </Button>
      </Step>
    );
  }

  async function add() {
    if (!/^\d{9,18}$/.test(acNum)) return setError("Account number should be 9 to 18 digits.");
    if (!IFSC_RE.test(ifsc)) return setError("IFSC is invalid. Check the 11 characters and try again.");
    if (!beneficiary.trim()) return setError("Enter the beneficiary name.");
    setError(null);
    setBusy(true);
    await addBankAccount(business.id, { acNum, ifsc, beneficiaryName: beneficiary.trim() });
    setBusy(false);
  }

  return (
    <Step done={false} title="Add Bank Account">
      <p className="mb-2.5 text-xs text-muted-foreground">No verified bank account yet. We'll send ₹1 to confirm it.</p>
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bank-ac">Account Number</Label>
            <Input id="bank-ac" value={acNum} onChange={(e) => setAcNum(e.target.value.replace(/\D/g, "").slice(0, 18))} placeholder="Enter Account Number" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bank-ifsc">IFSC</Label>
            <Input id="bank-ifsc" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase().slice(0, 11))} placeholder="Enter IFSC" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bank-name">Beneficiary Name</Label>
          <Input id="bank-name" value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} placeholder="Enter Beneficiary Name" />
        </div>
        <Button variant="outline" size="sm" onClick={add} disabled={busy}>
          {busy ? "Verifying…" : "Verify with ₹1"}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </Step>
  );
}
