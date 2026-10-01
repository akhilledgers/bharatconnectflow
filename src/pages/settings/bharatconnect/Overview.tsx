import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { AlertTriangle, Check, Copy, Pencil } from "lucide-react";
import { useStore } from "../../../store/useStore";
import type { Business } from "../../../types";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    // Icon-only; the tooltip and aria-label carry the text, and the icon flips to a tick once copied.
    <button
      onClick={() => {
        navigator.clipboard?.writeText(id).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={copied ? "Copied" : "Copy B2B ID"}
      aria-label={copied ? "Copied" : "Copy B2B ID"}
      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
    </button>
  );
}

export function Overview({ business }: { business: Business }) {
  const navigate = useNavigate();
  const invoices = useStore((s) => s.invoices);
  const hasOpenInvoices = invoices.some((i) => i.status !== "paid");
  const activeIds = business.bharatConnectIds.filter((i) => i.status === "active");
  const defaultId = activeIds[0];
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
            Fix Now
          </button>
        </div>
      )}

      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Bharat Connect</h1>
          <Badge variant="success">Connected</Badge>
        </div>
        <Button variant="outline" onClick={() => navigate("/settings/bharatconnect/profile/business_details")}>
          <Pencil />
          Edit Profile
        </Button>
      </div>

      <div className="mb-8">
        <div className="text-sm text-muted-foreground">Your Bharat Connect B2B ID</div>
        <div className="mt-1 flex items-center gap-3">
          <span className="tabular-nums text-3xl font-semibold tracking-tight text-foreground">{defaultId?.id ?? "—"}</span>
          {defaultId && <CopyId id={defaultId.id} />}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Share this ID so buyers and suppliers can send you invoices.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-8 border-t border-border pt-6">
        <div>
          <div className="text-sm text-muted-foreground">Invoicing</div>
          <div className="mt-1 font-medium text-foreground">{business.verification.invoicing ? "On" : "Not Set Up"}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Payments</div>
          <div className="mt-1 flex items-center gap-2 font-medium text-foreground">
            {business.verification.payments ? "On" : "Not Set Up"}
            {!business.verification.payments && (
              <a
                href="#/settings/bharatconnect/profile/settlement_accounts"
                className="text-sm font-medium text-primary hover:text-primary/80"
              >
                Set Up
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium text-foreground">Business Details</h2>
          <a
            href="#/settings/bharatconnect/profile/business_details"
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            Edit
          </a>
        </div>
        <dl className="divide-y divide-border">
          <DetailRow label="Business Name" value={business.name} />
          <DetailRow label="PAN" value={business.pan} />
          <DetailRow label="GSTIN" value={business.gstin ?? "None yet."} />
          <DetailRow
            label="Registered Address"
            value={`${business.registeredAddress.line1}, ${business.registeredAddress.city}, ${business.registeredAddress.state} ${business.registeredAddress.pincode}`}
          />
          {/* The business's own mobile and email, in full. */}
          <DetailRow label="Mobile" value={formatMobile(business.contacts.mobile)} />
          <DetailRow label="Email" value={business.contacts.email} />
          <DetailRow
            label="Settlement Account"
            value={
              settlement
                ? `${settlement.beneficiaryName} · ${settlement.ifsc} ending ${settlement.accountEnding}`
                : "None yet. Needed to receive payments."
            }
            muted={!settlement}
          />
        </dl>
      </div>

      <div className="mt-8 flex items-center justify-end border-t border-border pt-5 text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          {business.profileDraft.dirtySinceSend && (
            <a
              href="#/settings/bharatconnect/profile/review_send"
              className="font-medium text-primary hover:text-primary/80"
            >
              Unsent draft, changes to review
            </a>
          )}
          <span
            title={hasOpenInvoices ? "Disconnect is blocked while any invoice is unpaid or partly paid." : undefined}
            className={hasOpenInvoices ? "cursor-not-allowed text-muted-foreground/70" : "cursor-pointer hover:text-foreground"}
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
      <span className="text-muted-foreground">{label}</span>
      <span className={muted ? "text-muted-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}

/** "+919365551182" → "+91 93655 51182" (Indian 5-5 grouping); other formats pass through unchanged. */
function formatMobile(mobile: string): string {
  const m = mobile.replace(/\s/g, "").match(/^(\+91)?(\d{5})(\d{5})$/);
  return m ? `+91 ${m[2]} ${m[3]}` : mobile;
}
