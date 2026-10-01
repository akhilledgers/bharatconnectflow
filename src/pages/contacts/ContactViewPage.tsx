import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { useStore } from "../../store/useStore";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { statusLabel, statusVariant } from "../../lib/invoiceStatus";
import { Badge } from "../../components/ui/badge";
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
      <div className="rounded-xl border border-dashed border-input bg-card px-8 py-16 text-center">
        <div className="text-lg font-medium text-foreground">Contact not found</div>
        <button onClick={() => navigate("/contacts")} className="mt-3 text-sm font-medium text-primary hover:text-primary/80">
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

  const recentRows = recentKind === "sales" ? salesInvoices : purchaseInvoices;
  const recentBasePath = recentKind === "sales" ? "/sales/invoices" : "/expenses/bills";

  const pendingToSend = salesInvoices.filter((i) => i.bcSendStatus === "not_sent");
  const pendingToAccept = purchaseInvoices.filter((i) => i.bcConfirmationStatus === "pending");

  return (
    <div>
      <div className="mb-4 flex items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2.5 text-sm font-medium ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab !== "Information" ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
          No data available
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-lg font-semibold text-foreground">
                  {contact.salutation} {contact.name}
                </div>
                <button className="text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1 text-sm">
                <button className="block text-primary hover:text-primary/80">Update Mobile</button>
                <button className="block text-primary hover:text-primary/80">Update Email</button>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <div className="text-sm font-medium text-foreground">Billing Address</div>
                {contact.billingAddress ? (
                  <div className="mt-1 text-sm text-foreground">
                    {contact.billingAddress.line1}
                    <br />
                    {contact.billingAddress.city}, {contact.billingAddress.state}
                    <br />
                    {contact.billingAddress.pincode}
                  </div>
                ) : (
                  <button className="mt-1 text-sm text-primary hover:text-primary/80">Add address</button>
                )}
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <div className="text-sm font-medium text-foreground">GSTIN</div>
                <div className="mt-1 text-sm text-foreground">{contact.gstin ?? "—"}</div>
                <button className="text-sm text-primary hover:text-primary/80">Update</button>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <div className="text-sm font-medium text-foreground">PAN</div>
                <div className="mt-1 text-sm text-foreground">{contact.pan ?? "—"}</div>
                <button className="text-sm text-primary hover:text-primary/80">Update</button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <BharatConnectMark size={14} />
                Bharat Connect
              </div>

              {!connected ? (
                <button
                  onClick={() => navigate("/settings/bharatconnect")}
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
                >
                  Onboard to Bharat Connect
                </button>
              ) : contact.b2bId ? (
                <>
                  <div className="mb-3 flex items-center gap-1.5 text-sm text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Connected
                  </div>
                  <div className="mb-3 tabular-nums text-muted-foreground">{contact.b2bId}</div>

                  <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/50 p-3">
                    <button
                      onClick={() => navigate("/sales/invoices")}
                      className="rounded-md p-1 text-left hover:bg-card"
                    >
                      <div className="text-lg font-semibold text-red-600">{pendingToSend.length}</div>
                      <div className="text-xs text-muted-foreground">Pending to send</div>
                    </button>
                    <button
                      onClick={() => navigate("/expenses/bills")}
                      className="rounded-md p-1 text-left hover:bg-card"
                    >
                      <div className="text-lg font-semibold text-red-600">{pendingToAccept.length}</div>
                      <div className="text-xs text-muted-foreground">Pending to accept</div>
                    </button>
                  </div>

                  {!contact.email && !contact.mobile && (
                    <button
                      onClick={() => requestContactDetails(contact.name)}
                      className="mt-3 w-full rounded-md border border-border px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      Request email & mobile
                    </button>
                  )}
                </>
              ) : contact.b2bId === null ? (
                <>
                  <p className="mb-3 text-sm text-muted-foreground">{contact.name} hasn't joined Bharat Connect yet.</p>
                  <button
                    onClick={() => inviteToBharatConnect(contact.name)}
                    className="w-full rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                  >
                    Invite to Bharat Connect
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Add a GSTIN or PAN to check their Bharat Connect status.</p>
              )}
            </div>
          </div>

          <div className="col-span-2 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="text-sm text-foreground">Customer Receivables</div>
                <div className={`mt-2 text-xl font-semibold ${receivable > 0 ? "text-red-600" : "text-primary"}`}>
                  {receivable > 0 ? inr(receivable) : "No Due"}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="text-sm text-foreground">Supplier Payable</div>
                <div className={`mt-2 text-xl font-semibold ${payable > 0 ? "text-red-600" : "text-purple-600"}`}>
                  {payable > 0 ? inr(payable) : "No Due"}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="font-medium text-foreground">Recent Invoices</div>
                <div className="flex rounded-lg border border-border p-0.5 text-xs">
                  {(["sales", "purchase"] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setRecentKind(k)}
                      className={`rounded-md px-3 py-1.5 font-medium ${
                        recentKind === k ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {k === "sales" ? "Sales" : "Purchase"}
                    </button>
                  ))}
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-sm font-normal text-secondary-foreground/80">
                    <th className="px-5 py-2.5">Invoice Date</th>
                    <th className="px-2 py-2.5">Invoice</th>
                    <th className="px-2 py-2.5">Payment Status</th>
                    <th className="px-5 py-2.5">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentRows.map((inv) => (
                    <tr key={inv.id} className="hover:bg-accent/60">
                      <td className="px-5 py-3 text-foreground">{inv.date}</td>
                      <td className="px-2 py-3">
                        <button
                          onClick={() => navigate(`${recentBasePath}/${inv.id}`)}
                          className="font-medium text-primary hover:underline"
                        >
                          {inv.id}
                        </button>
                        <div className="text-xs text-muted-foreground">INR {money(inv.amount)}</div>
                      </td>
                      <td className="px-2 py-3">
                        <Badge variant={statusVariant(inv.status)}>
                          {statusLabel(inv.status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-foreground">{inv.dueDate ?? "—"}</td>
                    </tr>
                  ))}
                  {recentRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                        No invoices available for this contact
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="flex items-center justify-end border-t border-border px-5 py-3 text-xs text-muted-foreground">
                1 - {recentRows.length} of {recentRows.length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
