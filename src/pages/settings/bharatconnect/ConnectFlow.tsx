import { useMemo, useState } from "react";
import { useStore } from "../../../store/useStore";
import { baseId, breakdown } from "../../../lib/id-standard";
import { BharatConnectLogo } from "../../../components/layout/BharatConnectLogo";
import type { Business } from "../../../types";

function BusinessSummary({ business }: { business: Business }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="border-b border-gray-100 px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-ink">Your business</h2>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-sm font-medium text-primary hover:text-primary-hover"
        >
          {expanded ? "Show less" : "See everything shared"}
        </button>
      </div>
      <dl className="space-y-2.5 text-sm">
        <Row label="Business" value={business.name} tag="From GST portal" />
        <Row
          label="Identifiers"
          value={`PAN ${business.pan}${business.gstin ? " · GSTIN on file" : ""}`}
          tag="Verified"
        />
        <Row
          label="Contacts"
          value={`${business.contacts.mobileMasked} · ${business.contacts.emailMasked}`}
          tag="Verified"
        />
        {expanded && (
          <>
            <Row
              label="Registered address"
              value={`${business.registeredAddress.line1}, ${business.registeredAddress.city}, ${business.registeredAddress.state} ${business.registeredAddress.pincode}`}
              tag="From GST portal"
            />
            <Row
              label="Settlement account"
              value={
                business.bankAccounts[0]
                  ? `${business.bankAccounts[0].beneficiaryName} · ${business.bankAccounts[0].ifsc} ending ${business.bankAccounts[0].accountEnding}`
                  : "None yet"
              }
              tag="Optional, add later"
            />
            <Row label="Business category" value="Not set" tag="Optional, add later" />
          </>
        )}
      </dl>
    </section>
  );
}

function Row({ label, value, tag }: { label: string; value: string; tag: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-faint">{label}</div>
        <div className="mt-0.5 text-ink">{value}</div>
      </div>
      <span className="mt-3 shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        {tag}
      </span>
    </div>
  );
}

function IdSection({ business }: { business: Business }) {
  const flow = useStore((s) => s.getConnectFlow(business.id));
  const setConnectBasis = useStore((s) => s.setConnectBasis);
  const toggleChangingBasis = useStore((s) => s.toggleChangingBasis);
  const [proprietorDraft, setProprietorDraft] = useState(business.proprietorName ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  const effectiveBusiness = { ...business, proprietorName: proprietorDraft };
  const id = baseId(effectiveBusiness, flow.basedOn);
  const parts = breakdown(effectiveBusiness, flow.basedOn);

  return (
    <section className="border-b border-gray-100 px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-ink">Your BharatConnect ID</h2>
        <button
          onClick={() => toggleChangingBasis(business.id)}
          className="text-sm font-medium text-primary hover:text-primary-hover"
        >
          {flow.changingBasis ? "Done" : "Change"}
        </button>
      </div>

      {business.businessType === "sole_proprietor" && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-faint">
            Proprietor / Karta name
          </label>
          <input
            value={proprietorDraft}
            onChange={(e) => setProprietorDraft(e.target.value)}
            className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      <div className="rounded-lg bg-gray-50 px-4 py-3.5">
        <div className="font-mono text-xl font-semibold tracking-tight text-ink">{id}</div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-faint">
          {parts.map((p, i) => (
            <span key={i}>
              <span className="font-mono text-body">{p.value}</span> — {p.label}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm text-faint">
        Set by BharatConnect from your {flow.basedOn}. Nothing to type. <span className="font-medium">{visibility === "public" ? "Public." : "Private."}</span>
      </p>

      {flow.changingBasis && (
        <div className="mt-4 space-y-3 rounded-lg border border-gray-200 p-4">
          {business.gstin && business.businessType !== "sole_proprietor" && (
            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">Based on</div>
              <div className="flex gap-2">
                {(["PAN", "GSTIN"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setConnectBasis(business.id, opt)}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      flow.basedOn === opt
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-gray-300 text-body hover:bg-gray-50"
                    }`}
                  >
                    {opt === "PAN" ? `PAN (${business.pan})` : `GSTIN (${business.gstin})`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">Public / Private</div>
            <div className="flex gap-2">
              {(["public", "private"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setVisibility(opt)}
                  className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
                    visibility === opt
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-gray-300 text-body hover:bg-gray-50"
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

function OwnershipSection({ business }: { business: Business }) {
  const flow = useStore((s) => s.getConnectFlow(business.id));
  const setOtpCode = useStore((s) => s.setOtpCode);
  const verifyOwnership = useStore((s) => s.verifyOwnership);
  const [verifying, setVerifying] = useState(false);

  async function handleVerify() {
    setVerifying(true);
    await verifyOwnership(business.id);
    setVerifying(false);
  }

  if (flow.otpVerified) {
    return (
      <section className="border-b border-gray-100 px-6 py-5">
        <h2 className="mb-2 font-medium text-ink">Ownership</h2>
        <div className="flex items-center gap-2 text-sm text-emerald-700">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px]">✓</span>
          Ownership already verified in LEDGERS. Nothing more to do here.
        </div>
      </section>
    );
  }

  const otpSource = business.identifierPath === "pan_only" ? "the Income Tax portal" : "the GST portal";

  return (
    <section className="border-b border-gray-100 px-6 py-5">
      <h2 className="mb-2 font-medium text-ink">Ownership</h2>
      <p className="mb-3 text-sm text-body">
        We sent a 6-digit code through {otpSource} to your registered mobile and email. This is a one-time check.
      </p>
      <div className="flex items-center gap-2">
        <input
          value={flow.otpCode}
          onChange={(e) => setOtpCode(business.id, e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit code"
          className="w-40 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleVerify}
          disabled={flow.otpCode.length !== 6 || verifying}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {verifying ? "Verifying…" : "Verify"}
        </button>
      </div>
      {flow.otpError && <p className="mt-2 text-sm text-red-600">{flow.otpError}</p>}
    </section>
  );
}

function ProgressAndSuccess({ business }: { business: Business }) {
  const flow = useStore((s) => s.getConnectFlow(business.id));

  const steps = [
    { key: "sending", label: "Sending your details" },
    { key: "creating_id", label: "Creating your BharatConnect ID" },
    { key: "waiting_confirmation", label: "Waiting for confirmation" },
  ];
  const order = ["sending", "creating_id", "waiting_confirmation", "success"];
  const currentIdx = order.indexOf(flow.submitPhase);

  if (flow.submitPhase === "success") {
    const id = business.bharatConnectIds[0];
    return (
      <div className="px-6 py-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
          ✓
        </div>
        <h2 className="text-lg font-medium text-ink">You're connected to BharatConnect</h2>
        <div className="mx-auto mt-4 w-fit rounded-lg bg-gray-50 px-5 py-3 font-mono text-xl font-semibold text-ink">
          {id?.id}
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          Verified for invoicing
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <a
            href="#/settings/bharatconnect/profile/settlement_accounts"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-body hover:bg-gray-50"
          >
            Enable payments
          </a>
          <a
            href="#/sales/counterparty-search"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Send your first invoice
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <p className="mb-5 text-sm text-faint">You can leave this page — we'll keep going in the background.</p>
      <div className="space-y-4">
        {steps.map((step, i) => {
          const done = i < currentIdx || (i === currentIdx && flow.submitPhase !== step.key);
          const active = order[currentIdx] === step.key;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                  done
                    ? "bg-emerald-100 text-emerald-600"
                    : active
                      ? "bg-primary-soft text-primary"
                      : "bg-gray-100 text-faint"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={done || active ? "text-ink" : "text-faint"}>{step.label}</span>
              {active && (
                <span className="ml-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConnectFlow({ business }: { business: Business }) {
  const flow = useStore((s) => s.getConnectFlow(business.id));
  const setConsent = useStore((s) => s.setConsent);
  const submitConnect = useStore((s) => s.submitConnect);

  const missing = useMemo(() => {
    const items: string[] = [];
    if (!flow.otpVerified) items.push("verify ownership");
    if (!flow.consentChecked) items.push("tick consent");
    return items;
  }, [flow.otpVerified, flow.consentChecked]);

  const inProgress = flow.submitPhase !== "idle";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Connect to BharatConnect</h1>
        <BharatConnectLogo width={110} />
      </div>
      <p className="mb-6 text-sm text-faint">
        One check and one confirmation. Everything else is already filled in from your GST records.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white">
        {!inProgress ? (
          <>
            <BusinessSummary business={business} />
            <IdSection business={business} />
            <OwnershipSection business={business} />
            <div className="bg-gray-50/60 px-6 py-5">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={flow.consentChecked}
                  onChange={(e) => setConsent(business.id, e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-body">
                  I am an authorised signatory or admin of this business, and I consent to LEDGERS sharing these
                  details with BharatConnect to register my business and ID.{" "}
                  <span className="text-faint">Your name, role and the time are logged.</span>
                </span>
              </label>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => submitConnect(business.id)}
                  disabled={missing.length > 0}
                  className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
                >
                  Connect to BharatConnect
                </button>
                {missing.length > 0 && (
                  <span className="text-sm text-amber-700">
                    {missing[0][0].toUpperCase() + missing[0].slice(1)} to continue.
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <ProgressAndSuccess business={business} />
        )}
      </div>
    </div>
  );
}
