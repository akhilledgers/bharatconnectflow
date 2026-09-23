import { useNavigate, useParams } from "react-router-dom";
import { Copy, Download, Edit3, Link2, Printer, Trash2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { statusLabel, statusClass, confirmationMeta } from "../../lib/invoiceStatus";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { ConnectBharatConnectCard } from "../../components/ConnectBharatConnectCTA";
import { configFor, money } from "./kindConfig";
import { LedgersLogo } from "../../components/layout/LedgersLogo";

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

  if (!invoice) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white px-8 py-16 text-center">
        <div className="text-lg font-medium text-ink">{config.singular} not found</div>
        <button
          onClick={() => navigate(config.basePath)}
          className="mt-3 text-sm font-medium text-primary hover:text-primary-hover"
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">
          View {config.singular} - # {invoice.id}
        </h1>
        <div className="flex items-center gap-1.5">
          {[Link2, Edit3, Copy, Trash2, Printer, Download].map((Icon, i) => (
            <button key={i} className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-body hover:bg-gray-50">
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
          <button className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-body hover:bg-gray-50">
            TDS
          </button>
          {connected && (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200"
              title="Sent over BharatConnect"
            >
              <BharatConnectMark size={16} />
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-8">
          <LedgersLogo size={40} />
          <div className="mt-4 flex items-start justify-between border-b border-gray-100 pb-4">
            <div>
              <div className="font-semibold text-ink">{business.name}</div>
              <div className="text-sm text-faint">
                {business.registeredAddress.line1}, {business.registeredAddress.city}
              </div>
              <div className="text-sm text-faint">GSTIN: {business.gstin}</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-lg font-semibold text-ink">{config.singular.toUpperCase()}</div>
              <div className="text-faint">Number: {invoice.id}</div>
              <div className="text-faint">Date: {invoice.date}</div>
              {invoice.dueDate && <div className="text-faint">Due Date: {invoice.dueDate}</div>}
            </div>
          </div>

          <div className="mt-4 border-b border-gray-100 pb-4">
            <div className="text-xs font-medium uppercase tracking-wide text-faint">
              {kind === "sales" ? "Customer" : "Supplier"}
            </div>
            <div className="mt-1 font-medium text-ink">{invoice.counterpartyName}</div>
            {invoice.counterpartyGstin && <div className="text-sm text-faint">GSTIN: {invoice.counterpartyGstin}</div>}
            {invoice.counterpartyB2bId ? (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-faint">
                <BharatConnectMark size={12} />
                <span className="font-mono">{invoice.counterpartyB2bId}</span>
              </div>
            ) : (
              connected && (
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1.5 text-faint">
                    <BharatConnectMark size={12} className="grayscale opacity-60" />
                    Not on BharatConnect
                  </span>
                  <button
                    onClick={() => inviteToBharatConnect(invoice.counterpartyName)}
                    className="font-medium text-primary hover:text-primary-hover"
                  >
                    Invite
                  </button>
                </div>
              )
            )}
          </div>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-faint">
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">GST</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.lineItems.map((li) => (
                <tr key={li.id}>
                  <td className="py-2.5">
                    <div className="text-ink">{li.name}</div>
                    <div className="text-xs text-faint">
                      GST: {li.gstPercent}% {li.hsnSac && `| HSN: ${li.hsnSac}`}
                    </div>
                  </td>
                  <td className="py-2.5 text-right">{money(li.price)}</td>
                  <td className="py-2.5 text-right">{li.qty}</td>
                  <td className="py-2.5 text-right">{money((li.price * li.qty * li.gstPercent) / 100)}</td>
                  <td className="py-2.5 text-right font-medium text-ink">
                    {money(li.price * li.qty * (1 + li.gstPercent / 100))}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-gray-200 font-semibold text-ink">
                <td className="py-2.5">Grand Total</td>
                <td className="py-2.5 text-right">{money(taxable)}</td>
                <td className="py-2.5" />
                <td className="py-2.5 text-right">{money(gst)}</td>
                <td className="py-2.5 text-right">INR {money(invoice.amount)}</td>
              </tr>
            </tbody>
          </table>

          {account && (
            <div className="mt-4 flex gap-8 border-t border-gray-100 pt-3 text-xs text-faint">
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
              <span className={`rounded-full bg-white px-2.5 py-1 text-xs font-medium ${statusClass(invoice.status)}`}>
                {statusLabel(invoice.status)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-3 text-sm font-medium text-ink">GST filings</div>
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-faint">GST eInvoice</span>
              <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-body hover:bg-gray-50">
                Generate
              </button>
            </div>
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-faint">GST eway bill</span>
              <button className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-body hover:bg-gray-50">
                Generate
              </button>
            </div>

            {connected && (
              <div className="mt-2 border-t border-gray-100 pt-3">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">
                  <BharatConnectMark size={14} />
                  BharatConnect
                </div>

                {kind === "sales" ? (
                  invoice.bcSendStatus === "not_sent" ? (
                    invoice.counterpartyB2bId ? (
                      <button
                        onClick={handleSend}
                        className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover"
                      >
                        Send via BharatConnect
                      </button>
                    ) : (
                      <div>
                        <button
                          disabled
                          className="w-full cursor-not-allowed rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-faint opacity-70"
                        >
                          Send via BharatConnect
                        </button>
                        <p className="mt-1.5 text-xs text-faint">
                          {invoice.counterpartyName} hasn't joined BharatConnect yet.
                        </p>
                        <button
                          onClick={() => inviteToBharatConnect(invoice.counterpartyName)}
                          className="mt-2 w-full rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary-soft"
                        >
                          Invite to BharatConnect
                        </button>
                      </div>
                    )
                  ) : invoice.bcSendStatus === "sending" ? (
                    <div className="flex items-center gap-2 text-sm text-faint">
                      <CircularSpinner size={14} /> Sending…
                    </div>
                  ) : (
                    <div className="text-sm">
                      <div className="flex items-center justify-between py-1">
                        <span className="text-faint">Status</span>
                        <span className="font-medium text-ink">Sent</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-faint">Confirmation</span>
                        {confirmation ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confirmation.className}`}>
                            {confirmation.label}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </div>

                      {invoice.bcConfirmationStatus === "failure" && (
                        <>
                          <p className="mt-1.5 text-xs text-red-600">
                            The buyer couldn't confirm this invoice. You can send it again.
                          </p>
                          <button
                            onClick={handleSend}
                            className="mt-2 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover"
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
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confirmation.className}`}>
                    {confirmation.label}
                  </span>
                ) : (
                  <span className="text-sm text-faint">Not received over BharatConnect.</span>
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
