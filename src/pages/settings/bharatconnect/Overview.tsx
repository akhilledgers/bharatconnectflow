import { useNavigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, Pencil, Plus } from "lucide-react";
import { useStore } from "../../../store/useStore";
import type { Business } from "../../../types";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../../components/ui/card";
import { tableCls, thCls, tdCls, trCls } from "../../../components/ui/table";
import { CreateIdDrawer } from "./CreateIdDrawer";
import { Callout } from "../../../components/ui/popover";
import { BharatConnectLogo } from "../../../components/layout/BharatConnectLogo";
import { LevelStatus } from "./profile/LevelStatus";

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
      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-foreground"
    >
      {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
    </button>
  );
}

export function Overview({ business }: { business: Business }) {
  const navigate = useNavigate();
  const invoices = useStore((s) => s.invoices);
  const hasOpenInvoices = invoices.some((i) => i.status !== "paid");
  const defaultId = business.bharatConnectIds.find((i) => i.status === "active");
  const settlement = business.bankAccounts[0];
  const address = business.registeredAddress;
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-5">
      {business.connectionState === "needs_attention" && business.lastRejection && (
        <Callout
          tone="destructive"
          icon={<AlertTriangle className="size-4 text-destructive" />}
          title={business.lastRejection.message}
          actions={
            <Button
              variant="destructive"
              size="sm"
              onClick={() => navigate(`/settings/bharatconnect/profile/${business.lastRejection!.tab}`)}
            >
              Fix Now
            </Button>
          }
        >
          Field: {business.lastRejection.field}
        </Callout>
      )}

      {/* Branded header: the one tinted card on the page, so Bharat Connect reads as its own product
          inside LEDGERS rather than another settings screen. */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BharatConnectLogo width={110} />
              <Badge variant="success">Connected</Badge>
              <LevelStatus business={business} />
            </div>
            <Button variant="outline" onClick={() => navigate("/settings/bharatconnect/profile/business_details")}>
              <Pencil />
              Edit Profile
            </Button>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Your Bharat Connect B2B ID</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl font-semibold tracking-tight tabular-nums text-foreground">{defaultId?.id ?? "—"}</span>
              {defaultId && <CopyId id={defaultId.id} />}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Share this ID so buyers and suppliers can send you invoices.</p>
          </div>
        </CardContent>
      </Card>

      {/* Same split as LEDGERS' Basic Settings: narrow stacked details on the left, the list on the right. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Business Details</CardTitle>
            <CardDescription>Shared with businesses you trade with on Bharat Connect.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="space-y-5">
            <Detail label="Business Name">{business.name}</Detail>
            <Detail label="PAN">{business.pan}</Detail>
            <Detail label="GSTIN">{business.gstin ?? "None yet"}</Detail>
            <Detail label="Invoicing">{business.verification.invoicing ? "On" : "Not Set Up"}</Detail>
            <Detail label="Payments">
              {business.verification.payments ? (
                "On"
              ) : (
                <span className="flex items-center gap-2">
                  Not Set Up
                  <a
                    href="#/settings/bharatconnect/profile/settlement_accounts"
                    className="font-medium text-primary hover:text-primary/80"
                  >
                    Set Up
                  </a>
                </span>
              )}
            </Detail>
            <Detail label="Mobile">{formatMobile(business.contacts.mobile)}</Detail>
            <Detail label="Email">{business.contacts.email}</Detail>
            <Detail label="Settlement Account" muted={!settlement}>
              {settlement
                ? `${settlement.beneficiaryName} · ${settlement.ifsc} ending ${settlement.accountEnding}`
                : "None yet. Needed to receive payments."}
            </Detail>
            <Detail label="Registered Address">
              {`${address.line1}, ${address.city}, ${address.state} ${address.pincode}`}
            </Detail>
          </dl>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>B2B IDs</CardTitle>
            <CardDescription>All your IDs reach this business.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            Create B2B ID
          </Button>
        </CardHeader>
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={thCls}>B2B ID</th>
              <th className={thCls}>Visibility</th>
              <th className={thCls}>Linked To</th>
              <th className={thCls}>Status</th>
            </tr>
          </thead>
          <tbody>
            {business.bharatConnectIds.map((id) => (
              <tr key={id.id} className={trCls}>
                <td className={tdCls}>
                  <div className="font-medium tabular-nums text-foreground">{id.id}</div>
                  <Badge
                    className="mt-1"
                    variant={id.legacyFormat ? "warning" : id.label === "Default" ? "primary" : "secondary"}
                  >
                    {id.legacyFormat ? "Legacy Format" : id.label}
                  </Badge>
                </td>
                <td className={`${tdCls} capitalize`}>{id.visibility}</td>
                <td className={tdCls}>{id.basedOn}</td>
                <td className={tdCls}>
                  <Badge variant={id.status === "active" ? "success" : "secondary"}>
                    {id.status === "active" ? "Active" : "Deactivated"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <CardFooter className="justify-end">
          <a href="#/settings/bharatconnect/ids" className="text-sm font-medium text-primary hover:text-primary/80">
            View All
          </a>
        </CardFooter>
      </Card>
      </div>

      {createOpen && <CreateIdDrawer business={business} onClose={() => setCreateOpen(false)} />}

      <div className="flex items-center justify-end gap-4 text-sm text-muted-foreground">
        {business.profileDraft.dirtySinceSend && (
          <a href="#/settings/bharatconnect/profile/review_send" className="font-medium text-primary hover:text-primary/80">
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
  );
}

/** Label above value, as on LEDGERS' Basic Settings detail card. */
function Detail({
  label,
  children,
  muted,
  className,
}: {
  label: string;
  children: ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-2sm ${muted ? "text-muted-foreground" : "font-medium text-foreground"}`}>{children}</dd>
    </div>
  );
}

/** "+919365551182" → "+91 93655 51182" (Indian 5-5 grouping); other formats pass through unchanged. */
function formatMobile(mobile: string): string {
  const m = mobile.replace(/\s/g, "").match(/^(\+91)?(\d{5})(\d{5})$/);
  return m ? `+91 ${m[2]} ${m[3]}` : mobile;
}
