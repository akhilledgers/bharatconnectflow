import { Fragment, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowDownToLine, ChevronDown, Copy, Link, Printer, SquarePen, Trash2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { statusLabel, confirmationMeta, latestBcComment } from "../../lib/invoiceStatus";
import type { Business, BuyerResponse, Invoice } from "../../types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Checkbox, Textarea } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { ConnectBharatConnectCard } from "../../components/ConnectBharatConnectCTA";
import { configFor, money } from "./kindConfig";
import { LedgersLogo } from "../../components/layout/LedgersLogo";
import { ReviewAndSendCallout } from "./ReviewAndSendCallout";
import { NotesSection } from "./NotesCard";
import { CancelDialog, InlineResponse } from "./BcDialogs";
import { CANCEL_PICKS, deleteRule, editRule } from "../../lib/editRules";
import { Dialog } from "../../components/ui/dialog";
import { BcStrip } from "./BcStrip";
import { PHASE2 } from "../../lib/phase";
import type { LineResolution } from "../../lib/itemMatch";
import type { InvoiceLineItem } from "../../types";
import { ItemsReview, ItemsTable, LinkedCell, LinkedItems, MappingCell } from "./BillItems";
import { summary, useBillItems, type BillItems } from "./useBillItems";
import { Tabs } from "../../components/ui/tabs";
import { amountInWords, bankFromIfsc, longDate, stateFromGstin } from "./invoiceDoc";

// Copied from LEDGERS' live View Invoice (in.ledgers.cloud/v4/invoice/view-invoice): a text-sm header with
// Create ▾ and icon actions; the printed invoice (LEDGERS' "Formal" template) on the left and LEDGERS' card
// on the right — amount due, reconciliation, e-way bill, notes.
// Sales invoices leave that layout untouched: Bharat Connect is a strip above the invoice (BcStrip), activity
// sits behind 🕘 next to Edit, and Delete becomes Cancel & Delete while the invoice is on Bharat Connect.
// Bills still use a Bharat Connect card on the right (420px column) until their design is settled.

export function InvoiceViewPage({ kind }: { kind: "sales" | "purchase" }) {
  const config = configFor(kind);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const invoice = useStore((s) => s.invoices.find((i) => i.id === id));
  const connected = business.connectionState === "connected";
  // Set by InvoiceCreatePage when it navigates here after Create.
  const navState = useLocation().state as { justCreated?: boolean; cancel?: boolean } | null;
  const justCreated = navState?.justCreated === true;
  const [calloutDismissed, setCalloutDismissed] = useState(false);
  // Received bills: each line's catalog item (see BillItems). Shown in one of three layouts (dev panel).
  const items = useBillItems(invoice);
  const layout = useStore((s) => s.devItemsLayout);
  const [leftTab, setLeftTab] = useState<"bill" | "items">("bill");
  // The list's row menu can arrive here with Cancel & Delete already open.
  const [deleteOpen, setDeleteOpen] = useState<"delete" | "cancel-delete" | null>(navState?.cancel ? "cancel-delete" : null);
  // Cancel & Delete is confirmed inside the strip; the list's row menu can open it on arrival.
  const deleteInvoice = useStore((s) => s.deleteInvoice);
  const cancelAndDeleteInvoice = useStore((s) => s.cancelAndDeleteInvoice);

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

  const showCallout = justCreated && kind === "sales" && !calloutDismissed;
  const sales = kind === "sales";
  const del = sales ? deleteRule(invoice, connected) : null;
  const mapping = connected && kind === "purchase" && invoice.bcSendStatus === "sent" && invoice.bcConfirmationStatus === "pending";
  const linked = connected && kind === "purchase" && invoice.bcConfirmationStatus === "accepted" && invoice.lineItems.some((l) => l.catalogId);
  const showItems = mapping || linked;
  // (A) inside the bill: a not-printed row under each line.
  const annotate =
    layout === "inline" && showItems
      ? (line: InvoiceLineItem) => {
          const row = items.rows.find((r) => r.line.id === line.id);
          return mapping && row ? <MappingCell row={row} onChange={(p) => items.set(line.id, p)} align="start" /> : <LinkedCell bill={invoice} line={line} align="start" />;
        }
      : undefined;
  const reviewItems = () => {
    if (layout === "tabs") setLeftTab("items");
    else document.getElementById("bill-items")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          View {config.singular} - <span># {invoice.id}</span>
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <CreateMenu kind={kind} />
          {(() => {
            // Edit follows handbook Annexure H (see lib/editRules): disabled with the reason when not allowed.
            const rule = editRule(invoice, connected);
            const blocked = rule.mode === "blocked";
            const label = blocked ? rule.reason : rule.mode === "resend" ? `Edit and resend (v${rule.nextVersion})` : `Edit ${config.singular}`;
            return (
              <span title={label}>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={label}
                  disabled={blocked}
                  onClick={() => navigate(`${config.basePath}/${invoice.id}/edit`)}
                >
                  <SquarePen />
                </Button>
              </span>
            );
          })()}
          {(
            [
              [Link, "Copy link"],
              [Copy, `Copy ${config.singular}`],
            ] as const
          ).map(([Icon, label]) => (
            <Button key={label} variant="outline" size="icon" title={label} aria-label={label}>
              <Icon />
            </Button>
          ))}
          {/* On Bharat Connect, Delete = Cancel & Delete; blocked (with the reason) when GST or Annexure H says no. */}
          {(() => {
            const label = !del ? "Delete" : del.mode === "blocked" ? del.reason : del.mode === "cancel-delete" ? "Cancel & Delete" : "Delete";
            return (
              <span title={label}>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={label}
                  disabled={del?.mode === "blocked"}
                  onClick={() => {
                    if (del && del.mode !== "blocked") setDeleteOpen(del.mode);
                  }}
                >
                  <Trash2 />
                </Button>
              </span>
            );
          })()}
          {(
            [
              [Printer, "Print"],
              [ArrowDownToLine, "Download"],
            ] as const
          ).map(([Icon, label]) => (
            <Button key={label} variant="outline" size="icon" title={label} aria-label={label}>
              <Icon />
            </Button>
          ))}
          <Button variant="outline" className="!text-sm">
            TDS
          </Button>
        </div>
      </div>


      <div className={`grid grid-cols-1 items-start gap-6 ${sales ? "lg:grid-cols-[1fr_350px]" : "lg:grid-cols-[1fr_420px]"}`}>
        {/* LEDGERS renders the template in an iframe whose body is #f6f6f6 around a white card. */}
        <div className="space-y-3">
          {/* Sales: Bharat Connect strip (or, right after Create, the review-and-send strip), as wide as the invoice. */}
          {showCallout && <ReviewAndSendCallout invoice={invoice} onDismiss={() => setCalloutDismissed(true)} />}
          {sales && !showCallout && <BcStrip invoice={invoice} connected={connected} onCancelDelete={del?.mode === "cancel-delete" ? () => setDeleteOpen("cancel-delete") : undefined} />}
          {/* (B) Bill | Items switch: the supplier's document stays untouched; Items is a full-width table. */}
          {layout === "tabs" && showItems && (
            <Tabs
              value={leftTab}
              onChange={setLeftTab}
              items={[
                { value: "bill", label: "Bill" },
                {
                  value: "items",
                  label: (
                    <span className="flex items-center gap-1.5">
                      Items
                      {mapping && items.newCount > 0 && (
                        <span className="rounded-full bg-primary/10 px-1.5 text-[11px] font-medium text-primary">{items.newCount} new</span>
                      )}
                    </span>
                  ),
                },
              ]}
            />
          )}
          <div className="relative overflow-hidden rounded-lg border border-border bg-white shadow-xs shadow-black/5">
            {layout === "tabs" && showItems && leftTab === "items" ? (
              <ItemsTable bill={invoice} items={mapping ? items : undefined} />
            ) : (
              <PrintedInvoice invoice={invoice} business={business} kind={kind} annotate={annotate} />
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Bills: Bharat Connect card on top (status, actions, activity). Sales use the strip instead. */}
          {sales ? null : connected ? (
            <Card key={`bc-${invoice.id}`}>
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <BharatConnectMark size={14} />
                  Bharat Connect
                </span>
                <BcSummary invoice={invoice} />
              </div>
              <div className="space-y-4 p-5">
                <BharatConnectSection
                  invoice={invoice}
                  kind={kind}
                  showCallout={showCallout}
                  itemLines={items.lines}
                  itemsValid={items.valid}
                  itemsCue={layout !== "card" && mapping ? <ItemsCue items={items} onReview={reviewItems} /> : null}
                />
                <NotesSection invoice={invoice} connected={connected} mode="bc" />
              </div>
            </Card>
          ) : (
            <ConnectBharatConnectCard kind={kind} />
          )}

          {/* LEDGERS' own card, as on the live View Invoice: amount due, reconciliation, e-way bill, notes. */}
          <Card>
            <DueHeader invoice={invoice} />
            <div className="space-y-5 p-4">
              {/* Bills received over Bharat Connect: how each line goes into the books (catalog items). */}
              {layout === "card" && mapping && (
                <>
                  <ItemsReview items={items} />
                  <hr className="border-dashed" />
                </>
              )}
              {layout === "card" && linked && (
                <>
                  <LinkedItems bill={invoice} />
                  <hr className="border-dashed" />
                </>
              )}
              <ReconciliationSection invoice={invoice} kind={kind} />
              {!invoice.deletedAt && (
                <>
                  <hr className="border-dashed" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs">GST eway bill:</span>
                    <Button variant="secondary" size="sm">
                      Generate
                    </Button>
                  </div>
                </>
              )}
              <NotesSection invoice={invoice} connected={connected} mode="internal" />
            </div>
          </Card>
        </div>
      </div>

      <CancelDialog
        key={`cancel-${invoice.id}`}
        open={deleteOpen === "cancel-delete"}
        onClose={() => setDeleteOpen(null)}
        title="Cancel and delete invoice?"
        description="It's cancelled on Bharat Connect and deleted from LEDGERS. This can't be revoked."
        confirmLabel="Cancel & Delete"
        picks={CANCEL_PICKS}
        onSubmit={(reason) => cancelAndDeleteInvoice(invoice.id, reason)}
      />
      <Dialog
        open={deleteOpen === "delete"}
        onClose={() => setDeleteOpen(null)}
        title={`Delete ${config.singular.toLowerCase()}?`}
        description="This can't be revoked."
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(null)}>
              Keep {config.singular}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setDeleteOpen(null);
                await deleteInvoice(invoice.id);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground">
          {config.singular} {invoice.id} for {invoice.counterpartyName} will be removed.
        </p>
      </Dialog>
    </div>
  );
}

function CreateMenu({ kind }: { kind: "sales" | "purchase" }) {
  const [open, setOpen] = useState(false);
  const items = kind === "sales" ? ["Receipt", "Credit Note", "Delivery Challan"] : ["Payment Voucher", "Debit Note"];
  return (
    <div className="relative">
      <Button variant="outline" className="h-8.5 w-22 !gap-1.25 !px-5 !text-xs" onClick={() => setOpen((o) => !o)}>
        Create
        <ChevronDown className="size-3.5" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 z-20 mt-1 w-44 space-y-0.5 p-1 ${popoverCls}`}>
            {items.map((item) => (
              <button key={item} onClick={() => setOpen(false)} className={menuItemCls}>
                {item}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Printed invoice: LEDGERS "Formal" template ----------
// Inter, 10pt body / 11pt section heads, #b6b4b4 hairlines, lightgray item header, padding 24px 27px.

const LINE = "border-[#b6b4b4]";
const TH = "bg-[lightgray] px-[5px] py-[3px] font-normal";
const TD = `border-b ${LINE} px-[5px] py-[3px]`;

function PrintedInvoice({
  invoice,
  business,
  kind,
  annotate,
}: {
  invoice: Invoice;
  business: Business;
  kind: "sales" | "purchase";
  /** (A) Renders a row under each line (catalog mapping); hidden when printed. */
  annotate?: (line: InvoiceLineItem) => ReactNode;
}) {
  const config = configFor(kind);
  const contact = useStore((s) => s.contacts.find((c) => c.name === invoice.counterpartyName));
  const taxable = invoice.lineItems.reduce((s, li) => s + li.price * li.qty, 0);
  const gst = invoice.lineItems.reduce((s, li) => s + li.price * li.qty * (li.gstPercent / 100), 0);
  const addr = business.registeredAddress;

  // The issuer is whoever raised the document: us on a sales invoice, the supplier on a bill.
  const ours = {
    name: business.name,
    lines: [addr.line1, addr.city, `${addr.city} - ${addr.pincode}`, `${addr.state}, INDIA`],
    email: business.contacts.email,
    mobile: business.contacts.mobile.replace(/^\+91/, ""),
    gstin: business.gstin,
    state: addr.state,
  };
  const theirState = contact?.billingAddress?.state?.toUpperCase() ?? stateFromGstin(invoice.counterpartyGstin);
  const theirs = {
    name: invoice.counterpartyName,
    lines: contact?.billingAddress ? [contact.billingAddress.line1, contact.billingAddress.city] : [],
    email: invoice.counterpartyEmail,
    gstin: invoice.counterpartyGstin,
    state: theirState,
  };
  const issuer = kind === "sales" ? ours : { ...theirs, mobile: undefined };
  const party = kind === "sales" ? theirs : ours;
  const sameState = !party.state || !issuer.state || party.state.toUpperCase() === issuer.state.toUpperCase();
  const account = kind === "sales" ? business.bankAccounts[0] : undefined;
  const stamp = invoice.deletedAt
    ? "border-gray-400 text-gray-500"
    : invoice.status === "paid"
      ? "border-green-600 text-green-700"
      : invoice.status === "partly_paid"
        ? "border-amber-500 text-amber-700"
        : "border-red-600 text-red-600";

  return (
    <div className="px-[27px] py-6 text-[10pt] leading-[1.2] text-gray-800">
      <div className="py-2.5">
        {kind === "sales" ? (
          <LedgersLogo size={80} />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-md bg-muted text-2xl font-semibold text-muted-foreground">
            {issuer.name.charAt(0)}
          </div>
        )}
      </div>

      <div className="py-[5px]">
        <div className="font-bold uppercase">{issuer.name}</div>
        {issuer.lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
        {issuer.email && <p>Email: {issuer.email}</p>}
        {"mobile" in issuer && issuer.mobile && <p>Mobile: {issuer.mobile}</p>}
        {issuer.gstin && <p>GSTIN: {issuer.gstin}</p>}
      </div>

      <div className="flex flex-col items-end py-[5px] text-right">
        <h5 className="font-bold uppercase leading-[1.5]">{config.singular}</h5>
        <p>Number: {invoice.id}</p>
        <p>Date: {invoice.date}</p>
        {invoice.dueDate && <p>Due Date: {invoice.dueDate}</p>}
        {/* LEDGERS prints this as an image stamp. */}
        <span className={`my-[5px] w-[100px] border-2 py-0.5 text-center text-[9pt] font-bold tracking-wide ${stamp}`}>
          {invoice.deletedAt ? "DELETED" : statusLabel(invoice.status).toUpperCase()}
        </span>
      </div>

      <div className={`border-t ${LINE} py-[5px]`}>
        <h5 className="text-[11pt] font-bold">{kind === "sales" ? "Customer" : "Bill To"}</h5>
        <p>{party.name}</p>
        {party.state && <p>POS: {party.state.toUpperCase()}</p>}
        <h5 className="text-[11pt] font-bold">Billing Address</h5>
        {party.state ? (
          <>
            <p>{party.state.toUpperCase()}</p>
            <p>INDIA</p>
          </>
        ) : (
          <p>INDIA</p>
        )}
        <h5 className="text-[11pt] font-bold">Shipping Address</h5>
        {party.state && <p>{party.state.toUpperCase()}</p>}
        <p>INDIA</p>
      </div>

      <table id="bill-items" className={`w-full border-collapse border-y ${LINE}`}>
        <thead>
          <tr>
            <th className={`${TH} w-5 text-left`}><small className="text-[10pt]">Sno.</small></th>
            <th className={`${TH} text-left`}><small className="text-[10pt]">Description</small></th>
            <th className={`${TH} text-center`}><small className="text-[10pt]">Rate</small></th>
            <th className={`${TH} text-center`}><small className="text-[10pt]">Qty</small></th>
            <th className={`${TH} text-center`}><small className="text-[10pt]">Taxable</small></th>
            <th className={`${TH} text-center`}><small className="text-[10pt]">GST</small></th>
            <th className={`${TH} text-right`}><small className="text-[10pt]">Total</small></th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((li, i) => {
            const lineTaxable = li.price * li.qty;
            const lineGst = (lineTaxable * li.gstPercent) / 100;
            // With an annotation the line's bottom rule moves below the annotation row.
            const td = annotate ? "px-[5px] py-[3px]" : TD;
            return (
              <Fragment key={li.id}>
                <tr>
                  <td className={`${td} text-left`}>{i + 1}</td>
                  <td className={`${td} text-left`}>
                    <div>{li.name}</div>
                    <small className="text-[10px] italic leading-[1.1]">
                      GST: {li.gstPercent}%{li.hsnSac && <> | HSN: {li.hsnSac}</>}
                    </small>
                  </td>
                  <td className={`${td} text-center`}>{li.price.toFixed(2)}</td>
                  <td className={`${td} text-center`}>
                    {li.qty} {li.unit ?? "UNT"}
                  </td>
                  <td className={`${td} text-center`}>{lineTaxable.toFixed(2)}</td>
                  <td className={`${td} text-center`}>{lineGst.toFixed(2)}</td>
                  <td className={`${td} text-right`}>{money2(lineTaxable + lineGst)}</td>
                </tr>
                {annotate && (
                  <tr className="print:hidden">
                    <td className={TD} />
                    <td colSpan={6} className={`${TD} pb-2`}>
                      <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-2.5 py-1.5 font-sans">{annotate(li)}</div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {account && (
        <div className="space-y-0">
          {[
            `Bank Name: ${bankFromIfsc(account.ifsc)}`,
            `Account Name: ${account.beneficiaryName}`,
            `Account Number: XXXXXXXX${account.accountEnding}`,
            `IFSC Code: ${account.ifsc}`,
          ].map((l) => (
            <p key={l} className="px-[5px] pt-[5px]">
              <small className="text-[10pt]">{l}</small>
            </p>
          ))}
        </div>
      )}

      <table className="w-full border-collapse">
        <tbody>
          <TotalRow label="Taxable" value={taxable} />
          {sameState ? (
            <>
              <TotalRow label="CGST" value={gst / 2} />
              <TotalRow label="SGST" value={gst / 2} />
            </>
          ) : (
            <TotalRow label="IGST" value={gst} />
          )}
          <TotalRow label="Total" value={invoice.amount} />
        </tbody>
      </table>

      <div className={`mt-[5px] border-t ${LINE} p-[5px] text-right font-bold`}>
        <small className="text-[10pt]">Total in Words: {amountInWords(invoice.amount)}</small>
      </div>

      <div className={`border-t ${LINE}`}>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="w-1/2 p-[5px] align-top text-[13px]">
                <p className="font-bold">
                  <small className="text-[13px]">Terms &amp; Conditions</small>
                </p>
                <p className="mb-[5px] min-h-[75px]">
                  <small className="text-[13px]">
                    Payment is due within 30 days from the invoice date. Interest may apply on overdue amounts. All taxes
                    are charged as applicable.
                  </small>
                </p>
              </td>
              <td className="p-[5px] text-right align-bottom">
                <div className="font-bold">
                  <small className="text-[10pt]">For {issuer.name}</small>
                </div>
                <div className="h-16" />
                <small className="text-[10pt]">Authorised Signatory</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function money2(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <tr>
      <td className="px-[5px] pt-[5px] text-left">
        <small className="text-[10pt]">{label}</small>
      </td>
      <td className="px-[5px] pt-[5px] text-right font-bold">
        <small className="text-[10pt]">INR {money2(value)}</small>
      </td>
    </tr>
  );
}

// ---------- Right card ----------

function DueHeader({ invoice }: { invoice: Invoice }) {
  const received = (invoice.receipts ?? []).reduce((s, r) => s + r.amount + (r.tds ?? 0), 0);
  const due = Math.max(0, invoice.amount - received);
  const paid = invoice.status === "paid";
  if (invoice.deletedAt) {
    return (
      <div className="flex items-center justify-between rounded-t-xl bg-muted px-4 py-4">
        <h2 className="text-base font-semibold text-gray-500">INR {money2(invoice.amount)}</h2>
        <span className="rounded-md bg-gray-400 px-3 py-1 text-xs text-white">Deleted</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-t-xl px-4 py-4" style={{ backgroundColor: paid ? "#EBFAF2" : "rgb(255, 238, 243)" }}>
      <h2 className="text-base font-semibold text-gray-800">
        INR {money2(paid ? invoice.amount : due)} {paid ? "Paid" : "Due"}
      </h2>
      <span className={`rounded-md px-3 py-1 text-xs text-white ${paid ? "bg-green-600" : invoice.status === "partly_paid" ? "bg-amber-500" : "bg-red-500"}`}>
        {statusLabel(invoice.status)}
      </span>
    </div>
  );
}

function BcSummary({ invoice }: { invoice: Invoice }) {
  const meta = confirmationMeta(invoice.bcConfirmationStatus, invoice.kind);
  if (meta) return <Badge variant={meta.variant}>{meta.label}</Badge>;
  if (invoice.kind === "sales" && invoice.bcSendStatus === "not_sent") return <span>Not sent</span>;
  return <span>Not via Bharat Connect</span>;
}

function reconciliationRows(invoice: Invoice, kind: "sales" | "purchase") {
  if (invoice.receipts?.length) return invoice.receipts.map((r) => ({ id: `# ${r.id}`, date: r.date, amount: r.amount }));
  // Seeded paid documents have no receipt records; show the one that settled them.
  return invoice.status === "paid" ? [{ id: kind === "sales" ? "# 2026-65" : "# PV-12", date: invoice.date, amount: invoice.amount }] : [];
}

function ReconciliationSection({ invoice, kind }: { invoice: Invoice; kind: "sales" | "purchase" }) {
  const rows = reconciliationRows(invoice, kind);
  const th = "h-12 pl-0 text-left text-xs font-semibold text-slate-400";
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Reconciliation:</h3>
      <div className="max-h-[250px] overflow-y-auto pr-1">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-dashed border-slate-200">
              <th className={`${th} w-[120px]`}>{kind === "sales" ? "Receipt #" : "Payment #"}</th>
              <th className={th}>Date</th>
              <th className={`${th} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-3 text-xs text-slate-400">
                  No {kind === "sales" ? "receipts" : "payments"} yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-dashed border-slate-200 last:border-b-0">
                  <td className="w-[120px] py-3 pl-0 text-xs font-medium text-slate-400">
                    <label className="flex cursor-pointer items-center gap-2">
                      <Checkbox className="!size-5 border-slate-200" />
                      {r.id}
                    </label>
                  </td>
                  <td className="py-3 pl-0 text-xs font-semibold text-slate-800">{longDate(r.date)}</td>
                  <td className="py-3 pl-0 text-right text-xs font-semibold text-slate-800">INR {money(r.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Bharat Connect state and actions for this document. Statuses and the actions allowed from each one
 * follow handbook Annexure H; the buyer's comment is required on every response (buyerRemarks).
 */
function BharatConnectSection({
  invoice,
  kind,
  showCallout,
  itemLines,
  itemsValid,
  itemsCue,
}: {
  invoice: Invoice;
  kind: "sales" | "purchase";
  showCallout: boolean;
  itemLines: LineResolution[];
  itemsValid: boolean;
  /** Layouts A / B: one line pointing at the items, which live with the bill. */
  itemsCue?: ReactNode;
}) {
  const sendInvoiceViaBharatConnect = useStore((s) => s.sendInvoiceViaBharatConnect);
  const respondToBill = useStore((s) => s.respondToBill);
  const navigate = useNavigate();
  const cancelInvoice = useStore((s) => s.cancelInvoice);
  const inviteToBharatConnect = useStore((s) => s.inviteToBharatConnect);
  const [response, setResponse] = useState<BuyerResponse | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [noteToBuyer, setNoteToBuyer] = useState("");
  const status = invoice.bcConfirmationStatus;
  const confirmation = confirmationMeta(status, kind);
  const comment = latestBcComment(invoice);
  const send = () => sendInvoiceViaBharatConnect(invoice.id);
  const who = invoice.counterpartyName;

  // The status badge itself sits in the section header (BcSummary); only the revision tag shows here.
  const statusLine = PHASE2.editAndResend && confirmation && (invoice.version ?? 1) > 1 && (
    <span className="text-xs text-muted-foreground">Revised · v{invoice.version}</span>
  );
  const quote = (label: string) =>
    comment && (
      <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-foreground">
        <span className="text-muted-foreground">{label}: </span>
        {comment}
      </p>
    );

  let body: ReactNode = null;
  if (kind === "sales") {
    if (invoice.bcSendStatus === "not_sent") {
      body = invoice.counterpartyB2bId ? (
        <div className="space-y-2.5">
          {/* Optional note that travels with the invoice (invoiceRemarks, up to 256 characters). */}
          <Textarea
            rows={2}
            maxLength={256}
            placeholder={`Note to ${who} (optional)`}
            value={noteToBuyer}
            onChange={(e) => setNoteToBuyer(e.target.value)}
            className="!text-xs"
          />
          {/* Outline while the review-and-send callout carries the filled Send button, so the page keeps one. */}
          <Button variant={showCallout ? "outline" : "primary"} className="w-full" onClick={() => sendInvoiceViaBharatConnect(invoice.id, noteToBuyer)}>
            Send via Bharat Connect
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="secondary" className="w-full" disabled>
            Send via Bharat Connect
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">{who} hasn't joined Bharat Connect yet.</p>
          {/* Hidden while the review-and-send callout shows its own Invite button. */}
          {!showCallout && (
            <Button variant="outline" className="mt-2 w-full" onClick={() => inviteToBharatConnect(who)}>
              Invite
            </Button>
          )}
        </div>
      );
    } else if (invoice.bcSendStatus === "sending") {
      body = (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CircularSpinner size={14} /> Sending…
        </div>
      );
    } else if (status === "pending") {
      body = (
        <div className="space-y-2.5">
          {statusLine}
          <p className="text-xs text-muted-foreground">Waiting for {who} to respond.</p>
          <Button variant="link" className="text-xs !text-destructive" onClick={() => setCancelOpen(true)}>
            Cancel Invoice
          </Button>
        </div>
      );
    } else if (status === "accepted") {
      body = (
        <div className="space-y-2.5">
          {statusLine}
          {quote(who)}
        </div>
      );
    } else if (status === "returned") {
      body = (
        <div className="space-y-2.5">
          {statusLine}
          {quote(`${who} says`)}
          {!PHASE2.editAndResend ? (
            <p className="text-xs text-muted-foreground">Cancel this invoice and create a corrected one.</p>
          ) : invoice.isEInvoice ? (
            <p className="text-xs text-muted-foreground">E-invoices can't be edited.</p>
          ) : (
            <Button variant="primary" className="w-full" onClick={() => navigate(`/sales/invoices/${invoice.id}/edit`)}>
              Edit &amp; Resend
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={() => setCancelOpen(true)}>
            Cancel Invoice
          </Button>
        </div>
      );
    } else if (status === "rejected") {
      body = (
        <div className="space-y-2.5">
          {statusLine}
          <p className="text-xs text-foreground">{who} rejected this invoice.</p>
          {quote("Reason")}
          <p className="text-xs text-muted-foreground">Cancel this invoice and create a new one if needed.</p>
          <Button variant="outline" className="w-full" onClick={() => setCancelOpen(true)}>
            Cancel Invoice
          </Button>
        </div>
      );
    } else if (status === "failure") {
      body = (
        <div className="space-y-2.5">
          {statusLine}
          <p className="text-xs text-destructive">Couldn't send. Please try again.</p>
          <Button variant="primary" className="w-full" onClick={send}>
            Resend
          </Button>
        </div>
      );
    } else {
      body = statusLine;
    }
  } else if (status === "pending") {
    body = (
      <div className="space-y-2.5">
        {statusLine}
        <p className="text-xs text-muted-foreground">{who} is waiting for your response.</p>
        {itemsCue}
        {/* The comment form opens right here in the card, not in a popup. */}
        {response ? (
          <InlineResponse
            key={response}
            decision={response}
            supplier={who}
            onCancel={() => setResponse(null)}
            canSubmit={response !== "accept" || itemsValid}
            onSubmit={async (d, c) => {
              await respondToBill(invoice.id, d, c, d === "accept" ? itemLines : undefined);
              setResponse(null);
            }}
          >
            {response === "accept" && !itemsValid && (
              <p className="text-xs text-destructive">Fill the missing details in Items.</p>
            )}
          </InlineResponse>
        ) : (
          <div className={`grid gap-2 ${PHASE2.buyerReturn ? "grid-cols-3" : "grid-cols-2"}`}>
            <Button variant="success" onClick={() => setResponse("accept")}>
              Accept
            </Button>
            {PHASE2.buyerReturn && (
              <Button variant="outline" onClick={() => setResponse("return")}>
                Return
              </Button>
            )}
            <Button variant="outline" className="!text-destructive" onClick={() => setResponse("reject")}>
              Reject
            </Button>
          </div>
        )}
      </div>
    );
  } else if (confirmation && (statusLine || status === "returned")) {
    body = (
      <div className="space-y-2.5">
        {statusLine}
        {status === "returned" && <p className="text-xs text-muted-foreground">Waiting for {who} to correct and resend it.</p>}
      </div>
    );
  } else if (!confirmation) {
    body = <span className="text-xs text-muted-foreground">Not received over Bharat Connect.</span>;
  }

  // Nothing to say (e.g. a bill you've accepted), or a deleted document: the Activity list carries it.
  if (!body || invoice.deletedAt) return null;
  return (
    <div className="space-y-3">
      {body}
      <CancelDialog open={cancelOpen} onClose={() => setCancelOpen(false)} onSubmit={(reason) => cancelInvoice(invoice.id, reason)} />
    </div>
  );
}

/** Layouts A / B: "Items: 2 matched · 2 new · Review" in the Bharat Connect card. */
function ItemsCue({ items, onReview }: { items: BillItems; onReview: () => void }) {
  return (
    <p className="text-xs text-muted-foreground">
      Items: {summary(items)}
      {" · "}
      <button onClick={onReview} className="cursor-pointer font-medium text-primary hover:text-primary/80">
        Review
      </button>
      {!items.valid && <span className="text-destructive"> · details missing</span>}
    </p>
  );
}
