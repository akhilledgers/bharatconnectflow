import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MoreHorizontal, Plus } from "lucide-react";
import { useStore } from "../../store/useStore";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { statusLabel, statusVariant } from "../../lib/invoiceStatus";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { Tabs } from "../../components/ui/tabs";
import { tableCls, thCls, tdCls, trCls } from "../../components/ui/table";
import type { Address, LedgerContact } from "../../types";

// Copied from LEDGERS' live contact dashboard (in.ledgers.cloud/v4/contacts/contact-dashboard/:id): line tabs, a
// 1:3 grid — the contact card on the left (name, mobile, email, then every field as a small label + value), two
// tiles and Recent Invoices on the right. Bharat Connect adds one row to the card.

const TABS = ["Information", "Account Statement", "Transaction", "Documents", "Notes", "Activity Log"] as const;
type Tab = (typeof TABS)[number];

/** "INR 1.30 Lakh", as LEDGERS shows the tiles. */
function lakh(n: number): string {
  if (n >= 1e7) return `INR ${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `INR ${(n / 1e5).toFixed(2)} Lakh`;
  return `INR ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ContactViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const contact = useStore((s) => s.contacts.find((c) => c.id === id));
  const invoices = useStore((s) => s.invoices).filter((i) => !i.deletedAt);
  const connected = business.connectionState === "connected";
  const [tab, setTab] = useState<Tab>("Information");
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

  const related = invoices.filter((i) => (contact.b2bId ? i.counterpartyB2bId === contact.b2bId : i.counterpartyName === contact.name));
  const sales = related.filter((i) => i.kind === "sales");
  const purchases = related.filter((i) => i.kind === "purchase");
  const receivable = sales.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount, 0);
  const payable = purchases.filter((i) => i.status !== "paid").reduce((s, i) => s + i.amount, 0);
  const recentRows = recentKind === "sales" ? sales : purchases;
  const recentBase = recentKind === "sales" ? "/sales/invoices" : "/expenses/bills";

  return (
    <div className="space-y-6">
      <Tabs variant="line" className="!px-0" value={tab} onChange={setTab} items={TABS.map((t) => ({ value: t, label: t }))} />

      {tab !== "Information" ? (
        <Card className="flex h-48 items-center justify-center text-sm text-muted-foreground">No data available</Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4">
          <ContactCard contact={contact} connected={connected} />

          <div className="space-y-6 lg:col-span-3">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Tile label="Customer Receivables" value={receivable > 0 ? lakh(receivable) : "No Due"} className="text-primary" />
              <Tile label="Supplier Payable" value={payable > 0 ? lakh(payable) : "No Due"} className="text-purple-600" />
            </div>

            <Card className="overflow-hidden">
              <div className="flex min-h-14 items-center justify-between gap-2.5 border-b border-border px-3 py-3">
                <h3 className="text-base font-semibold text-foreground">Recent Invoices</h3>
                <Tabs
                  value={recentKind}
                  onChange={setRecentKind}
                  className="!gap-1 !p-0.5"
                  items={[
                    { value: "sales", label: "Sales" },
                    { value: "purchase", label: "Purchase" },
                  ]}
                />
              </div>
              <table className={tableCls}>
                <thead>
                  <tr className="bg-muted/40">
                    <th className={thCls}>Invoice Date</th>
                    <th className={thCls}>Invoice</th>
                    <th className={thCls}>Payment Status</th>
                    <th className={thCls}>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((inv) => (
                    <tr key={inv.id} className={trCls}>
                      <td className={tdCls}>
                        <div className="text-sm font-normal text-gray-600">{inv.date}</div>
                      </td>
                      <td className={tdCls}>
                        <button onClick={() => navigate(`${recentBase}/${inv.id}`)} className="cursor-pointer text-[0.8125rem] font-medium text-primary hover:underline">
                          #{inv.id}
                        </button>
                      </td>
                      <td className={tdCls}>
                        <Badge variant={statusVariant(inv.status)}>{statusLabel(inv.status)}</Badge>
                      </td>
                      <td className={tdCls}>
                        <div className="text-sm font-normal text-gray-600">{inv.dueDate ?? "-"}</div>
                      </td>
                    </tr>
                  ))}
                  {recentRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No invoices available for this contact
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="flex min-h-12 items-center justify-end px-5 text-sm text-muted-foreground tabular-nums">
                {recentRows.length ? `1 - ${recentRows.length} of ${recentRows.length}` : "0 - 0 of 0"}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className={`text-xl font-medium tracking-tight ${className}`}>{value}</p>
      </div>
    </div>
  );
}

const update = <button className="cursor-pointer text-xs font-medium text-primary hover:underline">Update</button>;

/** LEDGERS' field row: small muted label, small value (or an Update link when empty). */
function Field({ label, children, add }: { label: string; children?: ReactNode; add?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-muted-foreground">{label}</span>
        {add && (
          <button aria-label={`Add ${label}`} className="flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-accent">
            <Plus className="size-4 opacity-60" />
          </button>
        )}
      </div>
      <div className="text-xs font-medium text-foreground">{children ?? update}</div>
    </div>
  );
}

function AddressLines({ address, gstin }: { address: Address; gstin?: string }) {
  return (
    <div className="whitespace-pre-line">
      {[address.line1, address.line2, address.city, address.state.toUpperCase(), "INDIA", address.pincode].filter(Boolean).join("\n")}
      {gstin && (
        <div className="mt-0.5">
          <span className="text-muted-foreground">GSTIN: </span>
          {gstin}
        </div>
      )}
    </div>
  );
}

function ContactCard({ contact, connected }: { contact: LedgerContact; connected: boolean }) {
  const navigate = useNavigate();
  const inviteToBharatConnect = useStore((s) => s.inviteToBharatConnect);
  const requestContactDetails = useStore((s) => s.requestContactDetails);
  const addr = contact.billingAddress;

  return (
    <Card className="lg:col-span-1">
      <div className="flex min-h-14 items-start justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
          <span className="truncate text-sm font-medium text-gray-800" title={`${contact.salutation} ${contact.name}`}>
            {contact.salutation} {contact.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">{contact.mobile ? `+91-${contact.mobile}` : "Add mobile"}</span>
          <span className="truncate text-xs text-muted-foreground" title={contact.email}>
            {contact.email ?? "Add email"}
          </span>
        </div>
        <button aria-label="More" className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-accent">
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      <div className="max-h-[470px] space-y-4 overflow-y-auto p-4">
        {/* Bharat Connect: one row, in the same style as LEDGERS' own fields. */}
        {connected && (
          <Field label="Bharat Connect">
            {contact.b2bId ? (
              <div className="space-y-1">
                <span className="flex items-center gap-1.5">
                  <BharatConnectMark size={12} />
                  <span className="tabular-nums">{contact.b2bId}</span>
                </span>
                {!contact.email && !contact.mobile && (
                  <button onClick={() => requestContactDetails(contact.name)} className="cursor-pointer text-xs font-medium text-primary hover:underline">
                    Request email & mobile
                  </button>
                )}
              </div>
            ) : contact.b2bId === null ? (
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Not on Bharat Connect ·</span>
                <button onClick={() => inviteToBharatConnect(contact.name)} className="cursor-pointer text-primary hover:underline">
                  Invite
                </button>
              </span>
            ) : (
              <span className="text-muted-foreground">No GSTIN or PAN linked</span>
            )}
          </Field>
        )}
        {!connected && (
          <Field label="Bharat Connect">
            <button onClick={() => navigate("/settings/bharatconnect")} className="cursor-pointer text-primary hover:underline">
              Onboard to Bharat Connect
            </button>
          </Field>
        )}

        <Field label="Billing Address" add={!addr}>
          {addr ? <AddressLines address={addr} gstin={contact.gstin} /> : <span className="text-muted-foreground">-</span>}
        </Field>
        <Field label="Shipping Address" add={!addr}>
          {addr ? <AddressLines address={addr} gstin={contact.gstin} /> : <span className="text-muted-foreground">-</span>}
        </Field>
        <Field label="GSTIN">{contact.gstin}</Field>
        <Field label="PAN">{contact.pan}</Field>
        <Field label="Opening Customer Receivable" />
        <Field label="Opening Supplier Payable" />
        <Field label="Business Name">{contact.businessName}</Field>
        <Field label="Business Country">{contact.region || "INDIA"}</Field>
        <Field label="Entity">{contact.businessName ? "Private Limited Company" : "Individual"}</Field>
        <Field label="TDS Slab Rate">TDS Not Applicable</Field>
        <Field label="Bank">
          <button className="cursor-pointer text-xs font-medium text-primary hover:underline">Add bank</button>
        </Field>
        <Field label="TAN" />
        <Field label="MSME Number" />
        <Field label="Reverse Charge">No</Field>
        <div className="border-t border-border pt-4">
          <Field label="Created By">Akhil Manoj on 12-08-2026</Field>
        </div>
      </div>
    </Card>
  );
}
