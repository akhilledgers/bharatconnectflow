import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Copy, Download, Edit3, Link2, Printer, Trash2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { statusLabel, statusVariant, confirmationMeta } from "../../lib/invoiceStatus";
import { Badge } from "../../components/ui/badge";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { ConnectBharatConnectCard } from "../../components/ConnectBharatConnectCTA";
import { configFor, money } from "./kindConfig";
import { LedgersLogo } from "../../components/layout/LedgersLogo";
import { ReviewAndSendCallout } from "./ReviewAndSendCallout";

export function InvoiceViewPage({ kind }: { kind: "sales" | "purchase" }) {
  const config = configFor(kind);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const invoice = useStore((s) => s.invoices.find((i) => i.id === id));
  const sendInvoiceViaBharatConnect = useStore((s) => s.sendInvoiceViaBharatConnect);
  const respondToBill = useStore((s) => s.respondToBill);
  const inviteToBharatConnect = useStore((s) => s.inviteToBharatConnect);
  const connected = business.connectionState === "connected";
  // Set by InvoiceCreatePage when it navigates here after Create.
  const justCreated = (useLocation().state as { justCreated?: boolean } | null)?.justCreated === true;
  const [calloutDismissed, setCalloutDismissed] = useState(false);

  if (!invoice) {
    return (
      <div className="rounded-xl border border-dashed border-input bg-card px-8 py-16 text-center">
        <div className="text-lg font-medium text-foreground">{config.singular} not found</div>
        <button
          onClick={() => navigate(config.basePath)}
          className="mt-3 text-sm font-medium text-primary hover:text-primary/80"
        >
          Back to {config.pageTitle.toLowerCase()}
        </button>
      </div>
    );
  }

  const taxable = invoice.lineItems.reduce((s, li) => s + li.price * li.qty, 0);
  const gst = invoice.lineItems.reduce((s, li) => s + li.price * li.qty * (li.gstPercent / 100), 0);
  const account = business.bankAccounts[0];
  const confirmation = confirmationMeta(invoice.bcConfirmationStatus);

  async function handleSend() {
    await sendInvoiceViaBharatConnect(invoice!.id);
  }

  const showCallout = justCreated && kind === "sales" && !calloutDismissed;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">
          View {config.singular} - # {invoice.id}
        </h1>
        <div className="flex items-center gap-1.5">
          {[Link2, Edit3, Copy, Trash2, Printer, Download].map((Icon, i) => (
            <button key={i} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent">
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
          <button className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent">
            TDS
          </button>
        </div>
      </div>

      {showCallout && (
        <div className="mb-5">
          <ReviewAndSendCallout invoice={invoice} onDismiss={() => setCalloutDismissed(true)} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-xl border border-border bg-card p-8">
          <LedgersLogo size={40} />
          <div className="mt-4 flex items-start justify-between border-b border-border pb-4">
            <div>
              <div className="font-semibold text-foreground">{business.name}</div>
              <div className="text-sm text-muted-foreground">
                {business.registeredAddress.line1}, {business.registeredAddress.city}
              </div>
              <div className="text-sm text-muted-foreground">GSTIN: {business.gstin}</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-lg font-semibold text-foreground">{config.singular.toUpperCase()}</div>
              <div className="text-muted-foreground">Number: {invoice.id}</div>
              <div className="text-muted-foreground">Date: {invoice.date}</div>
              {invoice.dueDate && <div className="text-muted-foreground">Due Date: {invoice.dueDate}</div>}
            </div>
          </div>

          <div className="mt-4 border-b border-border pb-4">
            <div className="text-xs font-medium text-muted-foreground">
              {kind === "sales" ? "Customer" : "Supplier"}
            </div>
            <div className="mt-1 font-medium text-foreground">{invoice.counterpartyName}</div>
            {invoice.counterpartyGstin && <div className="text-sm text-muted-foreground">GSTIN: {invoice.counterpartyGstin}</div>}
            {invoice.counterpartyB2bId ? (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <BharatConnectMark size={12} />
                <span className="tabular-nums">{invoice.counterpartyB2bId}</span>
              </div>
            ) : (
              connected && (
                // Status only — the page's single Invite action lives in the callout or the Bharat Connect card.
                <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <BharatConnectMark size={12} className="grayscale opacity-60" />
                  Not on Bharat Connect
                </div>
              )
            )}
          </div>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">GST</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoice.lineItems.map((li) => (
                <tr key={li.id}>
                  <td className="py-2.5">
                    <div className="text-foreground">{li.name}</div>
                    <div className="text-xs text-muted-foreground">
                      GST: {li.gstPercent}% {li.hsnSac && `| HSN: ${li.hsnSac}`}
                    </div>
                  </td>
                  <td className="py-2.5 text-right">{money(li.price)}</td>
                  <td className="py-2.5 text-right">{li.qty}</td>
                  <td className="py-2.5 text-right">{money((li.price * li.qty * li.gstPercent) / 100)}</td>
                  <td className="py-2.5 text-right font-medium text-foreground">
                    {money(li.price * li.qty * (1 + li.gstPercent / 100))}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border font-semibold text-foreground">
                <td className="py-2.5">Grand Total</td>
                <td className="py-2.5 text-right">{money(taxable)}</td>
                <td className="py-2.5" />
                <td className="py-2.5 text-right">{money(gst)}</td>
                <td className="py-2.5 text-right">INR {money(invoice.amount)}</td>
              </tr>
            </tbody>
          </table>

          {account && (
            <div className="mt-4 flex gap-8 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>Bank: {account.beneficiaryName}</span>
              <span>IFSC: {account.ifsc}</span>
              <span>A/C ending: {account.accountEnding}</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-red-700">
                INR {money(invoice.amount)} {invoice.status !== "paid" && "Due"}
              </div>
              <Badge variant={statusVariant(invoice.status)}>
                {statusLabel(invoice.status)}
              </Badge>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 text-sm font-medium text-foreground">GST filings</div>
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">GST eInvoice</span>
              <button className="rounded-md border border-input px-3 py-1 text-xs font-medium text-foreground hover:bg-accent">
                Generate
              </button>
            </div>
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">GST eway bill</span>
              <button className="rounded-md border border-input px-3 py-1 text-xs font-medium text-foreground hover:bg-accent">
                Generate
              </button>
            </div>

            {connected && (
              <div className="mt-2 border-t border-border pt-3">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <BharatConnectMark size={14} />
                  Bharat Connect
                </div>

                {kind === "sales" ? (
                  invoice.bcSendStatus === "not_sent" ? (
                    invoice.counterpartyB2bId ? (
                      // Outline while the review-and-send callout carries the filled Send button,
                      // so the page keeps one filled button.
                      <button
                        onClick={handleSend}
                        className={
                          showCallout
                            ? "w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                            : "w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
                        }
                      >
                        Send via Bharat Connect
                      </button>
                    ) : (
                      <div>
                        <button
                          disabled
                          className="w-full cursor-not-allowed rounded-md bg-secondary px-3 py-2 text-sm font-medium text-muted-foreground opacity-70"
                        >
                          Send via Bharat Connect
                        </button>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {invoice.counterpartyName} hasn't joined Bharat Connect yet.
                        </p>
                        {/* Hidden while the review-and-send callout shows its own Invite button. */}
                        {!showCallout && (
                          <button
                            onClick={() => inviteToBharatConnect(invoice.counterpartyName)}
                            className="mt-2 w-full rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                          >
                            Invite to Bharat Connect
                          </button>
                        )}
                      </div>
                    )
                  ) : invoice.bcSendStatus === "sending" ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CircularSpinner size={14} /> Sending…
                    </div>
                  ) : (
                    <div className="text-sm">
                      <div className="flex items-center justify-between py-1">
                        <span className="text-muted-foreground">Status</span>
                        <span className="font-medium text-foreground">Sent</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-muted-foreground">Confirmation</span>
                        {confirmation ? (
                          <Badge variant={confirmation.variant}>
                            {confirmation.label}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>

                      {invoice.bcConfirmationStatus === "failure" && (
                        <>
                          <p className="mt-1.5 text-xs text-red-600">
                            The buyer couldn't confirm this invoice. You can send it again.
                          </p>
                          <button
                            onClick={handleSend}
                            className="mt-2 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
                          >
                            Send Again
                          </button>
                        </>
                      )}
                    </div>
                  )
                ) : invoice.bcConfirmationStatus === "pending" ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => respondToBill(invoice.id, "accept")}
                      className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respondToBill(invoice.id, "reject")}
                      className="flex-1 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : confirmation ? (
                  <Badge variant={confirmation.variant}>
                    {confirmation.label}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Not received over Bharat Connect.</span>
                )}
              </div>
            )}
          </div>

          {!connected && <ConnectBharatConnectCard kind={kind} />}
        </div>
      </div>
    </div>
  );
}
