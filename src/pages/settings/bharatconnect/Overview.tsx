import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { AlertTriangle, Check, Copy, Pencil } from "lucide-react";
import { useStore } from "../../../store/useStore";
import type { Business } from "../../../types";

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(id).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-body hover:bg-gray-50"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function Overview({ business }: { business: Business }) {
  const navigate = useNavigate();
  const invoices = useStore((s) => s.invoices);
  const hasOpenInvoices = invoices.some((i) => i.status !== "paid");
  const activeIds = business.bharatConnectIds.filter((i) => i.status === "active");
  const defaultId = activeIds[0];
  const extraCount = Math.max(0, activeIds.length - 1);
  const settlement = business.bankAccounts[0];

  return (
    <div>
      {business.connectionState === "needs_attention" && business.lastRejection && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div className="flex-1 text-sm">
            <div className="font-medium text-red-800">{business.lastRejection.message}</div>
            <div className="mt-0.5 text-red-700">Field: {business.lastRejection.field}</div>
          </div>
          <button
            onClick={() => navigate(`/settings/bharatconnect/profile/${business.lastRejection!.tab}`)}
            className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Fix now
          </button>
        </div>
      )}

      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold text-ink">BharatConnect</h1>
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
          </span>
        </div>
        <button
          onClick={() => navigate("/settings/bharatconnect/profile/business_details")}
          className="flex items-center gap-1.5 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit profile
        </button>
      </div>

      <div className="mb-8">
        <div className="text-sm text-faint">Your BharatConnect ID</div>
        <div className="mt-1 flex items-center gap-3">
          <span className="font-mono text-3xl font-semibold tracking-tight text-ink">{defaultId?.id ?? "—"}</span>
          {defaultId && <CopyId id={defaultId.id} />}
        </div>
        <p className="mt-2 text-sm text-faint">
          Share this ID so buyers and suppliers can send you invoices.{" "}
          {extraCount > 0 && (
            <a
              href="#/settings/bharatconnect/ids"
              className="font-medium text-primary hover:text-primary-hover"
            >
              {extraCount} more ID{extraCount === 1 ? "" : "s"}
            </a>
          )}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-8 border-t border-gray-100 pt-6">
        <div>
          <div className="text-sm text-faint">Invoicing</div>
          <div className="mt-1 font-medium text-ink">{business.verification.invoicing ? "On" : "Not set up"}</div>
        </div>
        <div>
          <div className="text-sm text-faint">Payments</div>
          <div className="mt-1 flex items-center gap-2 font-medium text-ink">
            {business.verification.payments ? "On" : "Not set up"}
            <a
              href="#/settings/bharatconnect/profile/settlement_accounts"
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              Set up
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium text-ink">Business details</h2>
          <a
            href="#/settings/bharatconnect/profile/business_details"
            className="text-sm font-medium text-primary hover:text-primary-hover"
          >
            Edit
          </a>
        </div>
        <dl className="divide-y divide-gray-100">
          <DetailRow label="Business name" value={business.name} />
          <DetailRow label="PAN" value={business.pan} />
          <DetailRow label="GSTIN" value={business.gstin ?? "None yet."} />
          <DetailRow
            label="Registered address"
            value={`${business.registeredAddress.line1}, ${business.registeredAddress.city}, ${business.registeredAddress.state} ${business.registeredAddress.pincode}`}
          />
          <DetailRow label="Contact" value={`${business.contacts.mobileMasked} · ${business.contacts.emailMasked}`} />
          <DetailRow
            label="Settlement account"
            value={
              settlement
                ? `${settlement.beneficiaryName} · ${settlement.ifsc} ending ${settlement.accountEnding}`
                : "None yet. Needed to receive payments."
            }
            muted={!settlement}
          />
        </dl>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-5 text-sm text-faint">
        <span>Details come from your GST records. Last synced {business.lastSyncedAt ?? "never"}.</span>
        <div className="flex items-center gap-4">
          {business.profileDraft.dirtySinceSend && (
            <a
              href="#/settings/bharatconnect/profile/review_send"
              className="font-medium text-primary hover:text-primary-hover"
            >
              Unsent draft, changes to review
            </a>
          )}
          <span
            title={hasOpenInvoices ? "Disconnect is blocked while any invoice is unpaid or partly paid." : undefined}
            className={hasOpenInvoices ? "cursor-not-allowed text-faint/70" : "cursor-pointer hover:text-body"}
          >
            Disconnect
          </span>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <span className="text-faint">{label}</span>
      <span className={muted ? "text-faint" : "text-ink"}>{value}</span>
    </div>
  );
}
