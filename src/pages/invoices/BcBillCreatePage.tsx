import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Check, Pencil, Plus, Settings2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input, Select, Textarea } from "../../components/ui/input";
import { lineThCls } from "../../components/ui/table";
import { normName } from "../../lib/itemMatch";
import { isIncoming } from "../../lib/invoiceStatus";
import { BillStrip } from "./BcStrip";
import { ResponseDialog } from "./BcDialogs";
import { ItemReviewDialog } from "./BillItems";
import { needsReview, useBillItems, type ItemRowState } from "./useBillItems";
import { money } from "./kindConfig";
import { stateFromGstin } from "./invoiceDoc";
import { nextBillNo, supplierInvoiceNo } from "../../lib/billNo";
import { CreateContactModal } from "../contacts/CreateContactModal";
import { matchVendor, type VendorMatch } from "../../lib/vendorMatch";
import type { Invoice, LedgerContact } from "../../types";

// An invoice received over Bharat Connect is raw data, not a LEDGERS bill yet. Opening it lands here: LEDGERS'
// Create Purchase Invoice (in.ledgers.cloud/v4/create-purchase-invoice), prefilled from the supplier's invoice.
// Amounts, quantities and taxes are the supplier's (locked); the Item column shows the supplier's item name with
// its catalog match underneath — "Review" where it needs a decision. Creating it is the Accept on Bharat Connect (buyerRemarks required); Reject stays on
// the strip, and a rejected invoice never becomes a LEDGERS bill.

/** buyerRemarks: 1–100 characters (reqConfirmInvoice). */
const REMARKS_MAX = 100;

const field = "h-7 w-full rounded-md border border-input bg-muted/60 px-2.5 text-xs text-foreground";

export function BcBillCreatePage() {
  const { id } = useParams<{ id: string }>();
  // Keyed by bill: going from one bill's Create page to another's starts clean (vendor, items, remarks).
  return <BcBillCreate key={id} id={id} />;
}

function BcBillCreate({ id }: { id?: string }) {
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const bill = useStore((s) => s.invoices.find((i) => i.id === id));
  const createPurchaseFromBc = useStore((s) => s.createPurchaseFromBc);
  const respondToBill = useStore((s) => s.respondToBill);
  const billNo = useStore((s) => nextBillNo(s.invoices));
  const connected = business.connectionState === "connected";
  const items = useBillItems(bill);
  const [reviewLine, setReviewLine] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [remark, setRemark] = useState("Accepted");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingVendor, setAddingVendor] = useState(false);
  const contacts = useStore((s) => s.contacts);
  // The vendor contact: a sure match is mapped on its own; otherwise the user confirms a suggestion, picks an
  // existing contact, or creates one. undefined = follow the match, null = cleared with Change.
  const [vendorId, setVendorId] = useState<string | null | undefined>(undefined);
  const match: VendorMatch = bill ? matchVendor(bill, contacts) : { kind: "none" };
  const vendor =
    vendorId === undefined ? (match.kind === "exact" ? match.contact : undefined) : contacts.find((c) => c.id === vendorId);

  if (!bill || !isIncoming(bill) || bill.bcConfirmationStatus !== "pending") {
    return (
      <div className="rounded-xl border border-dashed border-input bg-card px-8 py-16 text-center">
        <div className="text-lg font-medium text-foreground">{bill ? "This invoice has already been handled" : "Invoice not found"}</div>
        <button onClick={() => navigate(bill ? `/expenses/bills/${bill.id}` : "/expenses/bills")} className="mt-3 text-sm font-medium text-primary hover:text-primary/80">
          {bill ? "View it" : "Back to bills"}
        </button>
      </div>
    );
  }

  const addr = business.registeredAddress;
  const taxable = bill.lineItems.reduce((s, l) => s + l.price * l.qty, 0);
  const gst = bill.lineItems.reduce((s, l) => s + (l.price * l.qty * l.gstPercent) / 100, 0);
  const reviewRow = items.rows.find((r) => r.line.id === reviewLine);
  // LEDGERS books a purchase invoice against a vendor contact, so a supplier who isn't one yet is added first.
  const canCreate = items.valid && remark.trim().length > 0 && !!vendor && !saving;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground">Purchase Invoice</h1>
        <Button variant="outline" size="icon" title="Settings" aria-label="Settings">
          <Settings2 />
        </Button>
      </div>

      <div className="mb-4">
        <BillStrip invoice={bill} connected={connected} creating onRespond={(d) => d === "reject" && setRejecting(true)} />
      </div>

      <Card className="py-6">
        {/* Parties and meta */}
        <div className="flex items-start justify-between gap-6 border-b border-border px-6 pb-6">
          <div className="space-y-4">
            <div className="flex w-80 items-center gap-2.5 rounded-lg border border-dashed border-blue-500/30 bg-blue-50/70 px-3 py-2.5">
              <BharatConnectMark size={16} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">Filled from Bharat Connect</div>
                <div className="truncate text-xs text-muted-foreground">
                  Invoice {supplierInvoiceNo(bill)} from {bill.counterpartyName}
                </div>
              </div>
            </div>
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-foreground">
                {business.name}
                <Pencil className="size-3 opacity-60" />
              </div>
              <div>
                {addr.city}, {addr.state} - {addr.pincode}
              </div>
              <div>INDIA</div>
              <div>Email: {business.contacts.email}</div>
              <div>Mobile: {business.contacts.mobile.replace(/^\+91/, "")}</div>
              {business.gstin && <div>GSTIN: {business.gstin}</div>}
            </div>
          </div>
          <div className="grid w-80 shrink-0 grid-cols-[90px_1fr] items-center gap-x-3 gap-y-2.5 text-xs">
            <span className="font-medium text-foreground">Bill No:</span>
            <input className={field} value={billNo} readOnly aria-label="Bill No" />
            <span className="font-medium text-foreground">Date:</span>
            <DateBox value={bill.date} />
            <span className="font-medium text-foreground">Due Date:</span>
            <DateBox value={bill.dueDate ?? bill.date} />
            <div className="col-span-2 my-1.5 border-t border-border" />
            <span className="font-medium text-foreground">Invoice No:</span>
            <input className={field} value={supplierInvoiceNo(bill)} readOnly title="Supplier's invoice number" aria-label="Invoice No" />
            <span className="font-medium text-foreground">PO No:</span>
            <Input inputSize="sm" placeholder="PO-0000" aria-label="PO No" />
          </div>
        </div>

        {/* Vendor, as on LEDGERS' Create Purchase Invoice: the supplier who sent it (fixed), with their addresses */}
        <VendorBlock
          bill={bill}
          contact={vendor}
          match={match}
          mappedBy={vendorId === undefined && match.kind === "exact" ? match.by : undefined}
          onPick={setVendorId}
          onCreateContact={() => setAddingVendor(true)}
        />

        {/* Line items: the supplier's figures, locked; the Item column is our catalog match */}
        <div className="border-b border-border px-6 pb-4 pt-2">
          <table className="w-full table-fixed">
            <thead>
              <tr>
                <th className={`${lineThCls} !px-0`}>Item</th>
                <th className={`${lineThCls} w-28`}>Price</th>
                <th className={`${lineThCls} w-24`}>Qty</th>
                <th className={`${lineThCls} w-40`}>GST</th>
                <th className={`${lineThCls} w-28`}>HSN/SAC</th>
                <th className={`${lineThCls} w-32 !pr-0 text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.rows.map((row) => (
                <ItemRow key={row.line.id} row={row} onReview={() => setReviewLine(row.line.id)} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Terms and totals */}
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-8 px-6 py-6">
          <Textarea rows={5} placeholder="Terms and conditions" />
          <div className="space-y-2.5 text-xs">
            <Row label="Subtotal" value={`INR ${money(taxable)}`} />
            <Row label="Discount" value="INR 0.00" />
            <Row label="GST" value={`INR ${money(gst)}`} />
            <Row label="Additional charges" value="INR 0.00" />
            <Row label="Adjustment" value="INR 0.00" />
            <div className="flex items-center justify-between border-t border-border pt-2.5 text-sm font-semibold text-foreground">
              <span>Total</span>
              <span className="tabular-nums">INR {money(bill.amount)}</span>
            </div>

            {/* Creating = accepting on Bharat Connect, which needs a remark for the supplier: buyerRemarks in
                reqConfirmInvoice, required, 1–100 characters, no double quotes (API spec). */}
            <div className="space-y-1.5 border-t border-border pt-3">
              <div className="flex items-start justify-between gap-3">
                <label htmlFor="bc-remarks" className="shrink-0 pt-1.5 text-foreground" title={`Sent to ${bill.counterpartyName} with the acceptance`}>
                  Remarks<span className="text-destructive"> *</span>
                </label>
                {/* Half the column wide; grows a line at a time as the remark gets longer. No line breaks: it's one string. */}
                <Textarea
                  id="bc-remarks"
                  rows={1}
                  maxLength={REMARKS_MAX}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value.replace(/["\r\n]/g, ""))}
                  aria-invalid={remark.trim().length === 0}
                  className="min-h-7 !w-1/2 [field-sizing:content] !py-1.5 text-right"
                />
              </div>
              {!vendor && <p className="text-[11px] text-destructive">Map {bill.counterpartyName} to a contact, or create one, first.</p>}
              {!items.valid && <p className="text-[11px] text-destructive">Review the items marked Review first.</p>}
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-muted-foreground">Creating it also accepts it on Bharat Connect.</span>
                <Button
                  variant="primary"
                  disabled={!canCreate}
                  onClick={async () => {
                    setSaving(true);
                    await createPurchaseFromBc(bill.id, remark.trim(), items.lines, vendor!.id);
                    setSaving(false);
                    // Back to LEDGERS' own Purchase Invoices list, where the new invoice sits on top.
                    navigate("/expenses/bills", { state: { createdId: bill.id } });
                  }}
                >
                  {saving ? "Creating…" : "Create Purchase Invoice"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 px-6">
          <span className="text-xs font-medium text-foreground">Notes</span>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Thanks for your business" />
        </div>
      </Card>

      {addingVendor && (
        <CreateContactModal
          onClose={() => setAddingVendor(false)}
          onCreated={(c) => {
            setVendorId(c.id);
            setAddingVendor(false);
          }}
          initial={{
            type: "supplier",
            name: bill.counterpartyName,
            gstin: bill.counterpartyGstin ?? undefined,
            email: bill.counterpartyEmail ?? undefined,
            b2bId: bill.counterpartyB2bId ?? undefined,
          }}
        />
      )}
      {reviewRow && (
        <ItemReviewDialog key={reviewRow.line.id} bill={bill} row={reviewRow} onClose={() => setReviewLine(null)} onSave={(patch) => items.set(reviewRow.line.id, patch)} />
      )}
      <ResponseDialog
        key={`reject-${rejecting}`}
        decision={rejecting ? "reject" : null}
        supplier={bill.counterpartyName}
        onClose={() => setRejecting(false)}
        onSubmit={async (d, c) => {
          await respondToBill(bill.id, d, c);
          navigate(`/expenses/bills/${bill.id}`);
        }}
      />
    </div>
  );
}

/**
 * LEDGERS shows the picked vendor as three columns: Vendor, Billing Address, Shipping Address. The vendor is the
 * supplier who sent the invoice; details come from the LEDGERS contact it's mapped to (lib/vendorMatch), else
 * from the invoice itself until the user confirms, picks or creates the contact.
 */
function VendorBlock({
  bill,
  contact,
  match,
  mappedBy,
  onPick,
  onCreateContact,
}: {
  bill: Invoice;
  contact?: LedgerContact;
  match: VendorMatch;
  mappedBy?: string;
  onPick: (contactId: string | null) => void;
  onCreateContact: () => void;
}) {
  const contacts = useStore((s) => s.contacts);
  // Suppliers first, as LEDGERS' vendor picker lists them.
  const choices = [...contacts].sort((a, b) => Number(b.type === "supplier") - Number(a.type === "supplier") || a.name.localeCompare(b.name));
  const suggestion = match.kind === "suggest" ? match : undefined;
  const addr = contact?.billingAddress;
  const state = addr?.state ?? titleCase(stateFromGstin(bill.counterpartyGstin));
  const address = [addr?.city, state, addr?.pincode].filter(Boolean) as string[];
  const lines = [
    contact ? (contact.businessName !== contact.name ? contact.businessName : undefined) : bill.counterpartyName,
    contact?.email ?? bill.counterpartyEmail,
    contact?.mobile,
  ].filter(Boolean) as string[];

  return (
    <div className="grid grid-cols-3 gap-6 border-b border-border px-6 py-5 text-xs leading-[19.5px] text-muted-foreground">
      <div>
        <div className="mb-0.5 text-xs font-medium leading-4 text-foreground">Vendor</div>
        {contact && <div className="font-medium">{contact.name}</div>}
        {lines.map((l) => (
          <div key={l}>{l}</div>
        ))}
        {bill.counterpartyGstin && <div>GSTIN: {bill.counterpartyGstin}</div>}
        {bill.counterpartyB2bId && <div>B2B ID: {bill.counterpartyB2bId}</div>}
        {contact ? (
          // Mapped: the details above are the contact's. Change undoes it.
          <button
            onClick={() => onPick(null)}
            title={mappedBy ? `Matched to your contact by ${mappedBy}` : undefined}
            className="mt-1 cursor-pointer text-[11px] font-medium text-primary hover:text-primary/80"
          >
            Change contact
          </button>
        ) : (
          // Not mapped: pick the contact (a likely one is offered first), or create it.
          <div className="mt-2 space-y-1.5">
            {suggestion && (
              <div className="text-foreground">
                Is this your contact <span className="font-medium">{suggestion.contact.name}</span>?{" "}
                <button onClick={() => onPick(suggestion.contact.id)} className="cursor-pointer font-medium text-primary hover:text-primary/80">
                  Use it
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Select
                selectSize="sm"
                value=""
                onChange={(e) => e.target.value && onPick(e.target.value)}
                wrapperClassName="w-48"
                aria-label="Select contact"
              >
                <option value="">Select contact</option>
                {choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.gstin ? ` · ${c.gstin}` : ""}
                  </option>
                ))}
              </Select>
              <button onClick={onCreateContact} className="flex shrink-0 cursor-pointer items-center gap-1 font-medium text-primary hover:text-primary/80">
                <Plus className="size-3" />
                Create Contact
              </button>
            </div>
          </div>
        )}
      </div>
      {(["Billing Address", "Shipping Address"] as const).map((label) => (
        <div key={label}>
          <div className="mb-0.5 flex items-center gap-1 text-xs font-medium leading-4 text-foreground">
            {label}
            <Pencil className="size-3 text-muted-foreground hover:text-foreground" />
          </div>
          {address.length ? address.map((l) => <div key={l}>{l}</div>) : <div>—</div>}
        </div>
      ))}
    </div>
  );
}

const titleCase = (s?: string) => s?.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function DateBox({ value }: { value: string }) {
  return (
    <div className="relative">
      <input className={field} value={value} readOnly />
      <CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function ItemRow({ row, onReview }: { row: ItemRowState; onReview: () => void }) {
  const catalog = useStore((s) => s.catalog);
  const { line, draft } = row;
  const chosen = catalog.find((c) => c.id === draft.choice);
  const lineTaxable = line.price * line.qty;
  const lineGst = (lineTaxable * line.gstPercent) / 100;
  const review = needsReview(row);
  const same = chosen && normName(chosen.name) === normName(line.name);

  // Under the item name: where it goes in the catalog, or what still needs deciding.
  const status = review
    ? draft.choice === "new"
      ? { tone: "warn", text: "New item · details missing" }
      : chosen
        ? { tone: "warn", text: `Possible match: ${chosen.name}` }
        : { tone: "warn", text: "Not found in catalog" }
    : draft.choice === "new"
      ? { tone: "ok", text: "Will be added to catalog" }
      : { tone: "ok", text: same ? "In catalog" : `Catalog: ${chosen?.name}` };

  return (
    <tr className="align-top">
      <td className="py-3 pr-4">
        {/* The supplier's item: this is the item on the bill */}
        <input className={field} value={line.name} readOnly title={line.name} aria-label="Item" />
        <button
          onClick={onReview}
          className="mt-1.5 flex w-full cursor-pointer items-center gap-1.5 text-left text-[11px] hover:underline"
        >
          {status.tone === "ok" ? (
            <Check className="size-3 shrink-0 text-green-600" strokeWidth={3} />
          ) : (
            <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
          )}
          <span className={`truncate ${status.tone === "ok" ? "text-muted-foreground" : "text-foreground"}`}>{status.text}</span>
          <span className="shrink-0 font-medium text-primary">{review ? "Review" : "Change"}</span>
        </button>
      </td>
      <td className="py-3 pr-3">
        <input className={field} value={line.price.toFixed(2)} readOnly aria-label="Price" />
      </td>
      <td className="py-3 pr-3">
        <input className={field} value={`${line.qty}${line.unit ? ` ${line.unit}` : ""}`} readOnly aria-label="Qty" />
      </td>
      <td className="py-3 pr-3">
        <div className="flex">
          <input className={`${field} !w-16 rounded-e-none`} value={draft.gst ? `${draft.gst}%` : "–"} readOnly aria-label="GST rate" />
          <input className={`${field} rounded-s-none border-s-0`} value={money(lineGst)} readOnly aria-label="GST amount" />
        </div>
      </td>
      <td className="py-3 pr-3">
        <input className={field} value={draft.hsn || "–"} readOnly aria-label="HSN/SAC" />
      </td>
      <td className="py-3 text-right text-sm font-semibold tabular-nums text-foreground">INR {money(lineTaxable + lineGst)}</td>
    </tr>
  );
}
