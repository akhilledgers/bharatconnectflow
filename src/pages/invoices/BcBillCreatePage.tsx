import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Check, Pencil, Settings2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input, Textarea } from "../../components/ui/input";
import { lineThCls } from "../../components/ui/table";
import { normName } from "../../lib/itemMatch";
import { isIncoming } from "../../lib/invoiceStatus";
import { BillStrip } from "./BcStrip";
import { ResponseDialog } from "./BcDialogs";
import { ItemReviewDialog } from "./BillItems";
import { needsReview, useBillItems, type ItemRowState } from "./useBillItems";
import { money } from "./kindConfig";

// An invoice received over Bharat Connect is raw data, not a LEDGERS bill yet. Opening it lands here: LEDGERS'
// Create Purchase Invoice (in.ledgers.cloud/v4/create-purchase-invoice), prefilled from the supplier's invoice.
// Amounts, quantities and taxes are the supplier's (locked); the Item column is the catalog match — "Review"
// where it needs a decision. Creating it is the Accept on Bharat Connect (buyerRemarks required); Reject stays on
// the strip, and a rejected invoice never becomes a LEDGERS bill.

const field = "h-7 w-full rounded-md border border-input bg-muted/60 px-2.5 text-xs text-foreground";

export function BcBillCreatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const bill = useStore((s) => s.invoices.find((i) => i.id === id));
  const createPurchaseFromBc = useStore((s) => s.createPurchaseFromBc);
  const respondToBill = useStore((s) => s.respondToBill);
  const nextBillNo = useStore((s) => `2026-${33 + s.invoices.filter((i) => i.billNo).length}`);
  const connected = business.connectionState === "connected";
  const items = useBillItems(bill);
  const [reviewLine, setReviewLine] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [remark, setRemark] = useState("Accepted");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

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
  const canCreate = items.valid && remark.trim().length > 0 && !saving;

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
                  Invoice {bill.id} from {bill.counterpartyName}
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
            <input className={field} value={nextBillNo} readOnly aria-label="Bill No" />
            <span className="font-medium text-foreground">Date:</span>
            <DateBox value={bill.date} />
            <span className="font-medium text-foreground">Due Date:</span>
            <DateBox value={bill.dueDate ?? bill.date} />
            <div className="col-span-2 my-1.5 border-t border-border" />
            <span className="font-medium text-foreground">Invoice No:</span>
            <input className={field} value={bill.id} readOnly title="Supplier's invoice number" aria-label="Invoice No" />
            <span className="font-medium text-foreground">PO No:</span>
            <Input inputSize="sm" placeholder="PO-0000" aria-label="PO No" />
          </div>
        </div>

        {/* Vendor: the supplier who sent it */}
        <div className="border-b border-border px-6 py-5">
          <div className="inline-flex w-96 items-center gap-2 rounded-md border border-input bg-muted/60 px-3 py-1.5 text-xs">
            <span className="truncate font-medium text-foreground">{bill.counterpartyName}</span>
            {bill.counterpartyB2bId && (
              <span className="ms-auto flex shrink-0 items-center gap-1 text-muted-foreground">
                <BharatConnectMark size={11} />
                <span className="tabular-nums">{bill.counterpartyB2bId}</span>
              </span>
            )}
          </div>
          {bill.counterpartyGstin && <div className="mt-1.5 text-xs text-muted-foreground">GSTIN: {bill.counterpartyGstin}</div>}
        </div>

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

            {/* Creating = accepting on Bharat Connect, which needs a remark for the supplier (buyerRemarks). */}
            <div className="space-y-1.5 border-t border-border pt-3">
              <label className="text-[11px] font-medium text-foreground">
                Remarks to {bill.counterpartyName}
                <span className="text-destructive"> *</span>
              </label>
              <Input inputSize="sm" maxLength={100} value={remark} onChange={(e) => setRemark(e.target.value)} />
              {!items.valid && <p className="text-[11px] text-destructive">Review the items marked Review first.</p>}
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-muted-foreground">Creating it also accepts it on Bharat Connect.</span>
                <Button
                  variant="primary"
                  disabled={!canCreate}
                  onClick={async () => {
                    setSaving(true);
                    await createPurchaseFromBc(bill.id, remark.trim(), items.lines);
                    setSaving(false);
                    navigate(`/expenses/bills/${bill.id}`);
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
  const label = draft.choice === "new" ? draft.name : (chosen?.name ?? "");
  const differs = chosen && normName(chosen.name) !== normName(line.name);

  return (
    <tr className="align-top">
      <td className="space-y-2 py-3 pr-4">
        {/* Our catalog item for this line */}
        <button
          onClick={onReview}
          className={`flex h-7 w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 text-left text-xs ${
            review ? "border-primary/40 bg-primary/5" : "border-input bg-background hover:bg-accent"
          }`}
        >
          <span className={`truncate ${review ? "text-muted-foreground" : "text-foreground"}`}>
            {review ? "Select item…" : label}
            {!review && draft.choice === "new" && <span className="text-muted-foreground"> · new</span>}
          </span>
          {review ? <span className="shrink-0 font-medium text-primary">Review</span> : <Check className="size-3.5 shrink-0 text-green-600" strokeWidth={3} />}
        </button>
        {/* What the supplier called it */}
        <input
          className={field}
          value={line.name}
          readOnly
          title={differs ? `Supplier calls it "${line.name}"` : "Supplier's description"}
          aria-label="Supplier's description"
        />
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
