import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2 } from "lucide-react";
import { useStore } from "../../../store/useStore";
import { baseId } from "../../../lib/id-standard";
import { BharatConnectLogo } from "../../../components/layout/BharatConnectLogo";
import { CircularSpinner } from "../../../components/layout/CircularSpinner";
import type { Business, ConnectSubmitPhase } from "../../../types";

const SUCCESS_HOLD_MS = 1500;

/** Screen-reader text for the submit button's progress icon — the form stays visible, no overlay or blur. */
const PHASE_LABEL: Partial<Record<ConnectSubmitPhase, string>> = {
  sending: "Sending your details…",
  creating_id: "Creating your B2B ID…",
  waiting_confirmation: "Confirming…",
};

function BusinessSummary({ business, locked }: { business: Business; locked?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="border-b border-border px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-foreground">Your Business</h2>
        <button
          onClick={() => setExpanded((e) => !e)}
          disabled={locked}
          className="text-sm font-medium text-primary hover:text-primary/80 disabled:pointer-events-none disabled:opacity-50"
        >
          {expanded ? "Show Less" : "Show More"}
        </button>
      </div>
      <dl className="space-y-2.5 text-sm">
        <Row label="Business" value={business.name} />
        <Row
          label="Identifiers"
          value={`PAN ${business.pan}${business.gstin ? ` · GSTIN ${business.gstin}` : ""}`}
          verified
        />
        {/* The business's own mobile and email (used for OTPs and notifications) — labelled plainly so
            it isn't confused with the sidebar's Contacts module (customers and suppliers). */}
        <Row
          label="Mobile"
          value={formatMobile(business.contacts.mobile)}
          verified={business.contacts.mobileVerified}
        />
        <Row
          label="Email"
          value={business.contacts.email}
          verified={business.contacts.emailVerified}
        />
        {expanded && (
          <>
            <Row
              label="Registered Address"
              value={`${business.registeredAddress.line1}, ${business.registeredAddress.city}, ${business.registeredAddress.state} ${business.registeredAddress.pincode}`}
            />
            <Row
              label="Settlement Account"
              value={
                business.bankAccounts[0]
                  ? `${business.bankAccounts[0].beneficiaryName} · ${business.bankAccounts[0].ifsc} ending ${business.bankAccounts[0].accountEnding}`
                  : "None yet"
              }
            />
          </>
        )}
      </dl>
    </section>
  );
}

/** Label above value; a verified value gets a small green tick right after it. */
function Row({ label, value, verified }: { label: string; value: string; verified?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-foreground">
        <span>{value}</span>
        {verified && <CheckCircle2 className="size-4 shrink-0 text-green-600" aria-label="Verified" />}
      </div>
    </div>
  );
}

/** "+919365551182" → "+91 93655 51182" (Indian 5-5 grouping); other formats pass through unchanged. */
function formatMobile(mobile: string): string {
  const m = mobile.replace(/\s/g, "").match(/^(\+91)?(\d{5})(\d{5})$/);
  return m ? `+91 ${m[2]} ${m[3]}` : mobile;
}

function IdSection({ business, locked }: { business: Business; locked?: boolean }) {
  const flow = useStore((s) => s.getConnectFlow(business.id));
  const setConnectBasis = useStore((s) => s.setConnectBasis);
  const toggleChangingBasis = useStore((s) => s.toggleChangingBasis);
  const [proprietorDraft, setProprietorDraft] = useState(business.proprietorName ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  const effectiveBusiness = { ...business, proprietorName: proprietorDraft };
  const id = baseId(effectiveBusiness, flow.basedOn);

  return (
    <section className="border-b border-border px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-foreground">Your Bharat Connect B2B ID</h2>
        <button
          onClick={() => toggleChangingBasis(business.id)}
          disabled={locked}
          className="text-sm font-medium text-primary hover:text-primary/80 disabled:pointer-events-none disabled:opacity-50"
        >
          {flow.changingBasis ? "Done" : "Change"}
        </button>
      </div>

      {business.businessType === "sole_proprietor" && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-foreground">
            Proprietor / Karta Name
          </label>
          <input
            value={proprietorDraft}
            onChange={(e) => setProprietorDraft(e.target.value)}
            className="w-full max-w-sm rounded-md border border-input px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      <div className="rounded-lg bg-muted/50 px-4 py-3.5">
        <div className="tabular-nums text-xl font-semibold tracking-tight text-foreground">{id}</div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {visibility === "public"
          ? `Created from your ${flow.basedOn}. It's public, so buyers and suppliers can find you.`
          : `Created from your ${flow.basedOn}. It's private, so only businesses you share it with can use it.`}
      </p>

      {flow.changingBasis && (
        <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
          {business.gstin && business.businessType !== "sole_proprietor" && (
            <div>
              <div className="mb-1.5 text-xs font-medium text-foreground">Based On</div>
              <div className="flex gap-2">
                {(["PAN", "GSTIN"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setConnectBasis(business.id, opt)}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      flow.basedOn === opt
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-foreground hover:bg-accent"
                    }`}
                  >
                    {opt === "PAN" ? `PAN (${business.pan})` : `GSTIN (${business.gstin})`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="mb-1.5 text-xs font-medium text-foreground">Public / Private</div>
            <div className="flex gap-2">
              {(["public", "private"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setVisibility(opt)}
                  className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
                    visibility === opt
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-foreground hover:bg-accent"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function ConnectFlow({ business }: { business: Business }) {
  const flow = useStore((s) => s.getConnectFlow(business.id));
  const submitConnect = useStore((s) => s.submitConnect);
  const resetConnectFlow = useStore((s) => s.resetConnectFlow);
  const pushToast = useStore((s) => s.pushToast);

  // Brief success beat on the button, then hand off to the connected overview.
  useEffect(() => {
    if (flow.submitPhase !== "success") return;
    const timer = setTimeout(() => {
      const id = business.bharatConnectIds[0];
      pushToast(id ? `Onboarded to Bharat Connect. Your B2B ID is ${id.id}.` : "Onboarded to Bharat Connect.");
      resetConnectFlow(business.id);
    }, SUCCESS_HOLD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.submitPhase]);

  const missing = useMemo(() => {
    const items: string[] = [];
    // Ownership isn't checked here: onboarding is Level 1 (consent, OTP-verified contacts, name
    // match). The ownership OTP is part of the Level 2 upgrade on the profile page.
    if (!flow.consentChecked) items.push("tick consent");
    return items;
  }, [flow.consentChecked]);

  const inProgress = flow.submitPhase !== "idle";
  const success = flow.submitPhase === "success";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Onboard to Bharat Connect</h1>
        <BharatConnectLogo width={110} />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">We've filled in your details from LEDGERS. Just confirm and you're done.</p>

      <div className="relative rounded-xl border border-border bg-card">
        <BusinessSummary business={business} locked={inProgress} />
        <IdSection business={business} locked={inProgress} />
        <div className="bg-muted/50 px-6 py-5">
          <div className="flex items-start gap-3 text-sm" title="Confirmed by signing in as an admin of this business">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary text-white">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="text-foreground">
              I authorise LEDGERS to share my business details with Bharat Connect and create a B2B ID.
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => submitConnect(business.id)}
              disabled={missing.length > 0 || inProgress}
              aria-label={success ? "Onboarded" : inProgress ? PHASE_LABEL[flow.submitPhase] : undefined}
              className={`inline-flex min-w-56 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium text-white transition-colors ${
                success ? "bg-green-600" : "bg-primary hover:bg-primary/90"
              } ${inProgress ? "cursor-default" : "disabled:opacity-40"}`}
            >
              {/* Icon only while working: spinner, then a tick. The step names stay as the aria-label. */}
              {success ? (
                <Check className="size-5" strokeWidth={3} />
              ) : inProgress ? (
                <CircularSpinner size={18} className="!text-white" />
              ) : (
                "Onboard to Bharat Connect"
              )}
            </button>
            {missing.length > 0 && !inProgress && (
              <span className="text-sm text-amber-700">
                {missing[0][0].toUpperCase() + missing[0].slice(1)} to continue.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
