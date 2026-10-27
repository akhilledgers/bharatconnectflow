import { Fragment, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowDownToLine, ChevronDown, Copy, Link, Printer, SquarePen, Trash2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { statusLabel } from "../../lib/invoiceStatus";
import type { Business, BuyerResponse, Invoice } from "../../types";
import { supplierInvoiceNo } from "../../lib/billNo";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { configFor, money } from "./kindConfig";
import { LedgersLogo } from "../../components/layout/LedgersLogo";
import { ReviewAndSendCallout } from "./ReviewAndSendCallout";
import { NotesSection } from "./NotesCard";
import { CancelDialog, ResponseDialog } from "./BcDialogs";
import { CANCEL_PICKS, deleteRule, editRule } from "../../lib/editRules";
import { Dialog } from "../../components/ui/dialog";
import { BcStrip, BillStrip } from "./BcStrip";
import type { InvoiceLineItem } from "../../types";
import { LinkedFlag } from "./BillItems";
import { useBillItems, type BillItems } from "./useBillItems";
import { useDocPaid } from "../banking/PayDocs";
import { PayDocButton, PayDocStatus } from "../banking/PayDocSection";
import { billDoc, billNumber, isPayableBill } from "./payBill";
import { amountInWords, bankFromIfsc, longDate, stateFromGstin } from "./invoiceDoc";
import { QuickReceipt } from "./QuickReceipt";
import { receiptValue } from "../../lib/receipts";

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
  // Received bills: each line's catalog item (see BillItems). Item review happens on the Create Purchase Invoice page.
  const items = useBillItems(invoice);
  // The list's row menu can arrive here with Cancel & Delete already open.
  const [deleteOpen, setDeleteOpen] = useState<"delete" | "cancel-delete" | null>(navState?.cancel ? "cancel-delete" : null);
  // Cancel & Delete is confirmed inside the strip; the list's row menu can open it on arrival.
  const deleteInvoice = useStore((s) => s.deleteInvoice);
  const respondToBill = useStore((s) => s.respondToBill);
  // Bills: Accept / Reject from the strip open a popup for the required comment.
  const [respond, setRespond] = useState<BuyerResponse | null>(null);
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
  const del = deleteRule(invoice, connected);
  const mapping = connected && kind === "purchase" && invoice.bcSendStatus === "sent" && invoice.bcConfirmationStatus === "pending";
  const linked = connected && kind === "purchase" && invoice.bcConfirmationStatus === "accepted" && invoice.lineItems.some((l) => l.catalogId);
  // Next to each item name on the bill: Review / ✓ while waiting, the booked catalog item after Accept.
  const lineExtra = linked
      ? (line: InvoiceLineItem) => <LinkedFlag bill={invoice} line={line} />
      : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          View {config.singular} - <span># {kind === "purchase" ? invoice.billNo ?? supplierInvoiceNo(invoice) : invoice.id}</span>
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


      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_350px]">
        {/* LEDGERS renders the template in an iframe whose body is #f6f6f6 around a white card. */}
        <div className="space-y-3">
          {/* Sales: Bharat Connect strip (or, right after Create, the review-and-send strip), as wide as the invoice. */}
          {showCallout && <ReviewAndSendCallout invoice={invoice} onDismiss={() => setCalloutDismissed(true)} />}
          {sales && !showCallout && <BcStrip invoice={invoice} connected={connected} onCancelDelete={del?.mode === "cancel-delete" ? () => setDeleteOpen("cancel-delete") : undefined} />}
          {/* Bills: the same strip, with Accept / Reject while the bill waits for a response. */}
          {!sales && (
            <BillStrip
              invoice={invoice}
              connected={connected}
              onRespond={(d) => (d === "accept" ? navigate(`/expenses/bills/${invoice.id}/create`) : setRespond(d))}
              itemsCue={mapping ? <ItemsCue items={items} /> : null}
            />
          )}
          <div className="relative overflow-hidden rounded-lg border border-border bg-white shadow-xs shadow-black/5">
            <PrintedInvoice invoice={invoice} business={business} kind={kind} lineExtra={lineExtra} />
          </div>
        </div>

        <div className="space-y-4">
          {/* LEDGERS' own card, as on the live View Invoice: amount due, reconciliation, e-way bill, notes. */}
          <Card>
            <DueHeader invoice={invoice} />
            <div className="space-y-5 p-4">
              {kind === "purchase" && <PayDocStatus doc={billDoc(invoice)} />}
              {/* As on live LEDGERS: record a receipt (or a bill payment made outside LEDGERS) right here. */}
              {!invoice.deletedAt && (sales ? invoice.status !== "paid" : isPayableBill(invoice)) && (
                <>
                  <QuickReceipt key={`${invoice.id}-${invoice.receipts?.length ?? 0}`} invoice={invoice} businessType={business.businessType} />
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

      <ResponseDialog
        key={`respond-${invoice.id}-${respond}`}
        decision={respond}
        supplier={invoice.counterpartyName}
        onClose={() => setRespond(null)}
        canSubmit={respond !== "accept" || items.valid}
        onSubmit={(d, c) => respondToBill(invoice.id, d, c, d === "accept" ? items.lines : undefined)}
      >
        {respond === "accept" && !items.valid && <p className="text-xs text-destructive">Some items are missing details. Review the items marked Review first.</p>}
      </ResponseDialog>
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
  lineExtra,
}: {
  invoice: Invoice;
  business: Business;
  kind: "sales" | "purchase";
  /** Shown next to each item name (catalog matching: Review / ✓); hidden when printed. */
  lineExtra?: (line: InvoiceLineItem) => ReactNode;
}) {
  const config = configFor(kind);
  const contact = useStore((s) => s.contacts.find((c) => c.name === invoice.counterpartyName));
  const taxable = invoice.lineItems.reduce((s, li) => s + li.price * li.qty, 0);
  const gst = invoice.lineItems.reduce((s, li) => s + li.price * li.qty * (li.gstPercent / 100), 0);
  const addr = business.registeredAddress;

  // The issuer is whoever raised the document: us on a sales invoice, the supplier on a bill.
  // B2B ID prints under GSTIN when the document went over Bharat Connect.
  const viaBc = invoice.bcSendStatus === "sent";
  const ours = {
    name: business.name,
    lines: [addr.line1, addr.city, `${addr.city} - ${addr.pincode}`, `${addr.state}, INDIA`],
    email: business.contacts.email,
    mobile: business.contacts.mobile.replace(/^\+91/, ""),
    gstin: business.gstin,
    b2bId: viaBc ? business.bharatConnectIds.find((i) => i.status === "active")?.id : undefined,
    state: addr.state,
  };
  const theirState = contact?.billingAddress?.state?.toUpperCase() ?? stateFromGstin(invoice.counterpartyGstin);
  const theirs = {
    name: invoice.counterpartyName,
    lines: contact?.billingAddress ? [contact.billingAddress.line1, contact.billingAddress.city] : [],
    email: invoice.counterpartyEmail,
    gstin: invoice.counterpartyGstin,
    b2bId: viaBc ? (invoice.counterpartyB2bId ?? undefined) : undefined,
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
        {issuer.b2bId && <p>B2B ID: {issuer.b2bId}</p>}
      </div>

      <div className="flex flex-col items-end py-[5px] text-right">
        <h5 className="font-bold uppercase leading-[1.5]">{config.singular}</h5>
        <p>Number: {invoice.kind === "purchase" ? supplierInvoiceNo(invoice) : invoice.id}</p>
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
            const td = TD;
            return (
              <Fragment key={li.id}>
                <tr>
                  <td className={`${td} text-left`}>{i + 1}</td>
                  <td className={`${td} text-left`}>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span>{li.name}</span>
                      {lineExtra && <span className="font-sans print:hidden">{lineExtra(li)}</span>}
                    </div>
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
  const received = (invoice.receipts ?? []).reduce((s, r) => s + receiptValue(r), 0);
  const due = Math.max(0, invoice.amount - received);
  const paid = useDocPaid(billNumber(invoice)) || invoice.status === "paid";
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
      <div className="flex items-center gap-2">
        {invoice.kind === "purchase" && <PayDocButton key={invoice.id} doc={billDoc(invoice)} payable={isPayableBill(invoice)} />}
        <span className={`rounded-md px-3 py-1 text-xs text-white ${paid ? "bg-green-600" : invoice.status === "partly_paid" ? "bg-amber-500" : "bg-red-500"}`}>
          {statusLabel(paid ? "paid" : invoice.status)}
        </span>
      </div>
    </div>
  );
}

function reconciliationRows(invoice: Invoice, kind: "sales" | "purchase") {
  if (invoice.receipts?.length)
    return invoice.receipts.map((r) => ({
      id: `# ${r.id}`,
      date: r.date,
      amount: r.amount,
      // What the customer held back, under the amount: "TDS 2,000 · Packing charges 8,000".
      held: [...(r.tds ? [`TDS ${money(r.tds)}`] : []), ...(r.deductions ?? []).map((d) => `${d.head ?? d.kind} ${money(d.amount)}`)].join(" · "),
    }));
  // Seeded paid documents have no receipt records; show the one that settled them.
  return invoice.status === "paid" ? [{ id: kind === "sales" ? "# 2026-65" : "# PV-12", date: invoice.date, amount: invoice.amount, held: "" }] : [];
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
                  <td className="py-3 pl-0 text-right text-xs font-semibold text-slate-800">
                    INR {money(r.amount)}
                    {r.held && <div className="font-normal text-slate-400">{r.held}</div>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** On the bill strip: just how many lines still need a look; the Review links sit next to the items. */
function ItemsCue({ items }: { items: BillItems }) {
  const n = items.toReview.length;
  if (n === 0) return null;
  return <p className="text-xs text-muted-foreground">{n} item{n > 1 ? "s" : ""} to review</p>;
}
