import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { useStore } from "../../store/useStore";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { statusLabel, statusPillClass } from "../../lib/invoiceStatus";
import { inr, money } from "../invoices/kindConfig";

const TABS = ["Information", "Account Statement", "Transaction", "Documents", "Notes", "Activity Log"] as const;

export function ContactViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const contact = useStore((s) => s.contacts.find((c) => c.id === id));
  const invoices = useStore((s) => s.invoices);
  const inviteToBharatConnect = useStore((s) => s.inviteToBharatConnect);
  const requestContactDetails = useStore((s) => s.requestContactDetails);
  const connected = business.connectionState === "connected";
  const [tab, setTab] = useState<(typeof TABS)[number]>("Information");
  const [recentKind, setRecentKind] = useState<"sales" | "purchase">("sales");

  if (!contact) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white px-8 py-16 text-center">
        <div className="text-lg font-medium text-ink">Contact not found</div>
        <button onClick={() => navigate("/contacts")} className="mt-3 text-sm font-medium text-primary hover:text-primary-hover">
          Back to contacts
        </button>
      </div>
    );
  }

  const related = invoices.filter((i) =>
    contact.b2bId ? i.counterpartyB2bId === contact.b2bId : i.counterpartyName === contact.name,
  );
  const salesInvoices = related.filter((i) => i.kind === "sales");
  const purchaseInvoices = related.filter((i) => i.kind === "purchase");
  const receivable = salesInvoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount, 0);
  const payable = purchaseInvoices.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount, 0);

  const sentViaBc = salesInvoices.filter((i) => i.bcSendStatus === "sent").length;
  const acceptedViaBc = salesInvoices.filter((i) => i.bcConfirmationStatus === "accepted").length;
  const receivedViaBc = purchaseInvoices.filter((i) => i.bcConfirmationStatus !== null).length;

  const recentRows = recentKind === "sales" ? salesInvoices : purchaseInvoices;
  const recentBasePath = recentKind === "sales" ? "/sales/invoices" : "/expenses/bills";

  return (
    <div>
      <div className="mb-4 flex items-center gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium ${
              tab === t ? "border-primary text-primary" : "border-transparent text-faint hover:text-body"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab !== "Information" ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm text-faint">
          No data available
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-lg font-semibold text-ink">
                  {contact.salutation} {contact.name}
                </div>
                <button className="text-faint hover:text-body">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1 text-sm">
                <button className="block text-primary hover:text-primary-hover">Update Mobile</button>
                <button className="block text-primary hover:text-primary-hover">Update Email</button>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="text-sm font-medium text-ink">Billing Address</div>
                {contact.billingAddress ? (
                  <div className="mt-1 text-sm text-body">
                    {contact.billingAddress.line1}
                    <br />
                    {contact.billingAddress.city}, {contact.billingAddress.state}
                    <br />
                    {contact.billingAddress.pincode}
                  </div>
                ) : (
                  <button className="mt-1 text-sm text-primary hover:text-primary-hover">Add address</button>
                )}
              </div>

              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="text-sm font-medium text-ink">GSTIN</div>
                <div className="mt-1 text-sm text-body">{contact.gstin ?? "—"}</div>
                <button className="text-sm text-primary hover:text-primary-hover">Update</button>
              </div>

              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="text-sm font-medium text-ink">PAN</div>
                <div className="mt-1 text-sm text-body">{contact.pan ?? "—"}</div>
                <button className="text-sm text-primary hover:text-primary-hover">Update</button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-ink">
                <BharatConnectMark size={14} />
                BharatConnect
              </div>

              {!connected ? (
                <p className="text-sm text-faint">Connect your business to BharatConnect to see this contact's status.</p>
              ) : contact.b2bId ? (
                <>
                  <div className="mb-3 flex items-center gap-1.5 text-sm text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Connected
                  </div>
                  <div className="mb-3 font-mono text-xs text-faint">{contact.b2bId}</div>
                  <div className="grid grid-cols-3 gap-2 rounded-md border border-gray-100 bg-gray-50 p-3 text-center">
                    <div>
                      <div className="text-base font-semibold text-ink">{sentViaBc}</div>
                      <div className="text-[10px] text-faint">Sent</div>
                    </div>
                    <div>
                      <div className="text-base font-semibold text-emerald-600">{acceptedViaBc}</div>
                      <div className="text-[10px] text-faint">Accepted</div>
                    </div>
                    <div>
                      <div className="text-base font-semibold text-ink">{receivedViaBc}</div>
                      <div className="text-[10px] text-faint">Received</div>
                    </div>
                  </div>
                  {!contact.email && !contact.mobile && (
                    <button
                      onClick={() => requestContactDetails(contact.name)}
                      className="mt-3 w-full rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-primary hover:bg-primary-soft"
                    >
                      Request email & mobile
                    </button>
                  )}
                </>
              ) : contact.b2bId === null ? (
                <>
                  <p className="mb-3 text-sm text-faint">{contact.name} hasn't joined BharatConnect yet.</p>
                  <button
                    onClick={() => inviteToBharatConnect(contact.name)}
                    className="w-full rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary-soft"
                  >
                    Invite to BharatConnect
                  </button>
                </>
              ) : (
                <p className="text-sm text-faint">Add a GSTIN or PAN to check their BharatConnect status.</p>
              )}
            </div>
          </div>

          <div className="col-span-2 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="text-sm text-body">Customer Receivables</div>
                <div className={`mt-2 text-xl font-semibold ${receivable > 0 ? "text-red-600" : "text-primary"}`}>
                  {receivable > 0 ? inr(receivable) : "No Due"}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="text-sm text-body">Supplier Payable</div>
                <div className={`mt-2 text-xl font-semibold ${payable > 0 ? "text-red-600" : "text-purple-600"}`}>
                  {payable > 0 ? inr(payable) : "No Due"}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <div className="font-medium text-ink">Recent Invoices</div>
                <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs">
                  {(["sales", "purchase"] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setRecentKind(k)}
                      className={`rounded-md px-3 py-1.5 font-medium ${
                        recentKind === k ? "bg-gray-100 text-ink" : "text-faint hover:text-body"
                      }`}
                    >
                      {k === "sales" ? "Sales" : "Purchase"}
                    </button>
                  ))}
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-faint">
                    <th className="px-5 py-2.5">Invoice Date</th>
                    <th className="px-2 py-2.5">Invoice</th>
                    <th className="px-2 py-2.5">Payment Status</th>
                    <th className="px-5 py-2.5">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentRows.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/60">
                      <td className="px-5 py-3 text-body">{inv.date}</td>
                      <td className="px-2 py-3">
                        <button
                          onClick={() => navigate(`${recentBasePath}/${inv.id}`)}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {inv.id}
                        </button>
                        <div className="text-xs text-faint">INR {money(inv.amount)}</div>
                      </td>
                      <td className="px-2 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusPillClass(inv.status)}`}>
                          {statusLabel(inv.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-body">{inv.dueDate ?? "—"}</td>
                    </tr>
                  ))}
                  {recentRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-faint">
                        No invoices available for this contact
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="flex items-center justify-end border-t border-gray-100 px-5 py-3 text-xs text-faint">
                1 - {recentRows.length} of {recentRows.length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
