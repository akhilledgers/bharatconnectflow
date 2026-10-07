import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Lock, Pencil, Settings2, SquarePen, TableProperties } from "lucide-react";
import { useStore } from "../../store/useStore";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input, Select, Textarea } from "../../components/ui/input";
import { lineThCls } from "../../components/ui/table";
import { COUNTERPARTY_DIRECTORY } from "../../mock/seed";
import { configFor, money } from "./kindConfig";
import type { Invoice } from "../../types";
import { editRule } from "../../lib/editRules";
import { Callout } from "../../components/ui/popover";

const EXPENSE_CATEGORIES = ["Professional Fees", "Raw Materials", "Freight & Logistics", "Office Supplies", "Rent", "Utilities", "Other Expenses"];

/** Route wrapper: /sales/invoices/:id/edit and /expenses/bills/:id/edit open the editor in edit mode. */
export function InvoiceEditPage({ kind }: { kind: "sales" | "purchase" }) {
  const { id } = useParams<{ id: string }>();
  return <InvoiceCreatePage key={id} kind={kind} editId={id} />;
}

const TERMS =
  "Payment is due within 30 days from the invoice date. Interest may apply on overdue amounts. All taxes are charged as applicable. Goods/services remain the property of the seller until full payment is received. Discrepancies must be reported within 7 days. Goods once sold are not returnable. All disputes are subject to your jurisdiction.";

const GST_RATES = [0, 5, 12, 18, 28];

// Layout follows LEDGERS' Create Invoice (design system → Document editor): one card laid out like the
// printed document — parties and meta, customer search, line items, terms and totals, then Create.
export function InvoiceCreatePage({ kind, editId }: { kind: "sales" | "purchase"; editId?: string }) {
  const config = configFor(kind);
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const createInvoice = useStore((s) => s.createInvoice);
  const pushToast = useStore((s) => s.pushToast);
  const connected = business.connectionState === "connected";
  const updateInvoice = useStore((s) => s.updateInvoice);
  const resendInvoice = useStore((s) => s.resendInvoice);
  const existing = useStore((s) => (editId ? s.invoices.find((i) => i.id === editId) : undefined));
  const rule = existing ? editRule(existing, connected) : ({ mode: "free" } as const);
  // Bills received over Bharat Connect: amounts and items are the supplier's, so they're read-only.
  const locked = rule.mode === "local-only";
  const first = existing?.lineItems[0];

  const [query, setQuery] = useState(existing?.counterpartyName ?? "");
  const [counterparty, setCounterparty] = useState<{ name: string; bcId: string | null } | null>(
    existing ? { name: existing.counterpartyName, bcId: existing.counterpartyB2bId ?? null } : null,
  );
  const [itemName, setItemName] = useState(first?.name ?? "");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(first ? String(first.price) : "");
  const [qty, setQty] = useState(first ? String(first.qty) : "1");
  const [gstPercent, setGstPercent] = useState(first ? String(first.gstPercent) : "0");
  const [hsnSac, setHsnSac] = useState(first?.hsnSac ?? "");
  const [adjustment, setAdjustment] = useState("0");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const today = new Date().toLocaleDateString("en-GB").split("/").join("-");
  const series = kind === "sales" ? "LP" : "BILL";

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return COUNTERPARTY_DIRECTORY.filter((c) => c.registeredName.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  }, [query]);

  function selectCounterparty(name: string, bcId: string | null) {
    setCounterparty({ name, bcId });
    setQuery(name);
  }

  const priceNum = parseFloat(price) || 0;
  const qtyNum = parseFloat(qty) || 0;
  const gstNum = parseFloat(gstPercent) || 0;
  const subtotal = priceNum * qtyNum;
  const gstAmount = subtotal * (gstNum / 100);
  const adjustmentNum = parseFloat(adjustment) || 0;
  const lineTotal = subtotal + gstAmount;
  const total = lineTotal + adjustmentNum;

  async function handleCreate() {
    if (!counterparty || !itemName) return;
    setSaving(true);
    const invoice: Invoice = {
      id: `${series}-${Math.floor(Math.random() * 90000 + 10000)}`,
      kind,
      counterpartyName: counterparty.name,
      counterpartyB2bId: counterparty.bcId,
      amount: total,
      status: "unpaid",
      date: today,
      lineItems: [{ id: "li-1", name: itemName, price: priceNum, qty: qtyNum, gstPercent: gstNum, hsnSac }],
      bcSendStatus: "not_sent",
      bcConfirmationStatus: null,
    };
    await createInvoice(invoice);
    setSaving(false);
    pushToast(`${config.singular} ${invoice.id} created`);
    // Creating never sends. The user lands on the new document to review it, and sends it
    // via Bharat Connect from there (InvoiceViewPage shows a review-and-send callout for it).
    navigate(`${config.basePath}/${invoice.id}`, { state: { justCreated: true } });
  }

  async function handleSave() {
    if (!existing || !counterparty || !itemName) return;
    setSaving(true);
    if (locked) {
      await updateInvoice(existing.id, { category: category || undefined });
    } else {
      await updateInvoice(existing.id, {
        counterpartyName: counterparty.name,
        counterpartyB2bId: counterparty.bcId,
        amount: total,
        lineItems: [{ id: first?.id ?? "li-1", name: itemName, price: priceNum, qty: qtyNum, gstPercent: gstNum, hsnSac }],
      });
      // Sent To Buyer / Returned: the edit goes to the buyer as a new version (reqEditInvoice).
      if (rule.mode === "resend") await resendInvoice(existing.id, changeNote.trim());
    }
    setSaving(false);
    if (rule.mode !== "resend") pushToast(`${config.singular} ${existing.id} updated`);
    navigate(`${config.basePath}/${existing.id}`);
  }

  // Opened by URL on a document that can't be edited.
  if (editId && (!existing || rule.mode === "blocked")) {
    return (
      <div className="rounded-xl border border-dashed border-input bg-card px-8 py-16 text-center">
        <div className="text-lg font-medium text-foreground">
          {existing ? `This ${config.singular.toLowerCase()} can't be edited` : `${config.singular} not found`}
        </div>
        {rule.mode === "blocked" && <p className="mt-1 text-sm text-muted-foreground">{rule.reason}</p>}
        <button
          onClick={() => navigate(existing ? `${config.basePath}/${existing.id}` : config.basePath)}
          className="mt-3 text-sm font-medium text-primary hover:text-primary/80"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-sm font-medium text-foreground">
          {existing ? `Edit ${config.singular} - # ${existing.id}` : `Create ${config.singular}`}
        </h1>
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="md">
            <TableProperties />
            Custom Fields
          </Button>
          <Button variant="outline" size="icon" title="Settings" aria-label="Settings">
            <Settings2 />
          </Button>
        </div>
      </div>

      {rule.mode === "resend" && existing && (
        <Callout
          tone="primary"
          className="mb-4"
          icon={<BharatConnectMark size={18} />}
          title={`This invoice is with ${existing.counterpartyName} on Bharat Connect`}
        >
          Saving sends them a revised version (v{rule.nextVersion}).
        </Callout>
      )}
      {rule.mode === "local-only" && (
        <Callout tone="neutral" className="mb-4" icon={<Lock className="size-4 text-muted-foreground" />} title="Amounts and items are locked">
          {rule.reason} You can still change the expense category for your books.
        </Callout>
      )}

      <Card className="py-6">
        {/* Parties and meta */}
        <div className="flex items-start justify-between gap-6 border-b border-border px-6 pb-6">
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-foreground">
              {business.name}
              <Pencil className="size-3 text-muted-foreground" />
            </div>
            <div>
              {business.registeredAddress.city}, {business.registeredAddress.state} - {business.registeredAddress.pincode}
            </div>
            <div>INDIA</div>
            <div>Email: {business.contacts.email}</div>
            <div>Mobile: {business.contacts.mobile.replace(/^\+91/, "")}</div>
            {business.gstin && <div>GSTIN: {business.gstin}</div>}
          </div>
          <div className="grid grid-cols-[80px_200px] items-center gap-x-2 gap-y-2.5 text-xs">
            <Select selectSize="sm" defaultValue={series} aria-label="Series">
              <option value={series}>{series}</option>
            </Select>
            <Input inputSize="sm" defaultValue={existing?.id ?? `${series}-${kind === "sales" ? 46 : 2029}`} aria-label="Number" disabled={!!existing} />
            <span className="font-medium text-foreground">Date:</span>
            <DateField value={existing?.date ?? today} />
            <span className="font-medium text-foreground">Due Date:</span>
            <DateField value="" placeholder="DD-MM-YYYY" />
            {kind === "purchase" && (
              <>
                {/* LEDGERS-only field: editable even when the bill came over Bharat Connect. */}
                <span className="font-medium text-foreground">Category:</span>
                <Select selectSize="sm" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Expense category">
                  <option value="">Select category</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </>
            )}
            {kind === "sales" && (
              <>
                <span className="font-medium text-foreground">Sales By:</span>
                <Select selectSize="sm" defaultValue="akhil" aria-label="Sales by">
                  <option value="akhil">Akhil Manoj</option>
                </Select>
              </>
            )}
          </div>
        </div>

        {/* Customer / supplier */}
        <div className="relative border-b border-border px-6 py-6">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCounterparty(null);
            }}
            placeholder={`Search ${kind === "sales" ? "customer" : "supplier"}...`}
            disabled={locked}
            className="!w-72"
          />
          {matches.length > 0 && !counterparty && (
            <div className="absolute z-10 mt-1 w-96 space-y-0.5 rounded-md border border-border bg-popover p-1 shadow-md shadow-black/5">
              {matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => selectCounterparty(m.registeredName, m.legacyFormat ? null : m.bcId)}
                  className="flex w-full cursor-pointer flex-col items-start rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="text-foreground">{m.registeredName}</span>
                  {!m.legacyFormat && <span className="text-xs tabular-nums text-muted-foreground">{m.bcId}</span>}
                </button>
              ))}
            </div>
          )}
          {counterparty?.bcId && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <BharatConnectMark size={12} />
              <span className="tabular-nums">{counterparty.bcId}</span>
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="border-b border-border px-6 pb-6 pt-2">
          <table className="w-full">
            <thead>
              <tr>
                <th className={`${lineThCls} !px-0`}>Item</th>
                <th className={`${lineThCls} w-36`}>Price</th>
                <th className={`${lineThCls} w-28`}>Qty</th>
                <th className={`${lineThCls} w-56`}>GST</th>
                <th className={`${lineThCls} w-32`}>HSN/SAC</th>
                <th className={`${lineThCls} w-36 !pr-0 text-right`}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="align-top">
                <td className="space-y-2 py-3 pr-4">
                  <Input inputSize="sm" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Item name" disabled={locked} />
                  <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" disabled={locked} />
                </td>
                <td className="px-4 py-3">
                  <Input inputSize="sm" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" disabled={locked} />
                </td>
                <td className="px-4 py-3">
                  <Input inputSize="sm" value={qty} onChange={(e) => setQty(e.target.value)} disabled={locked} />
                </td>
                <td className="px-4 py-3">
                  {/* GST rate selector + the computed tax, read-only, as on LEDGERS. */}
                  <div className="flex items-center gap-1.5">
                    <Select selectSize="sm" wrapperClassName="w-24 shrink-0" value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} disabled={locked}>
                      {GST_RATES.map((g) => (
                        <option key={g} value={g}>
                          {g}%
                        </option>
                      ))}
                    </Select>
                    <Input inputSize="sm" readOnly value={money(gstAmount)} className="!w-24" aria-label="GST amount" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Input inputSize="sm" value={hsnSac} onChange={(e) => setHsnSac(e.target.value)} placeholder="Item code" disabled={locked} />
                </td>
                <td className="py-3 pl-4">
                  <div className="flex h-7 items-center justify-end gap-2 text-sm font-medium tabular-nums text-foreground">
                    INR {money(lineTotal)}
                    <SquarePen className="size-4 text-muted-foreground" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {!existing && connected && kind === "sales" && counterparty?.bcId && (
          <div className="flex items-center gap-2 border-b border-border px-6 py-4 text-xs text-muted-foreground">
            <BharatConnectMark size={13} />
            After you create it, you can review this invoice and send it to {counterparty.name} via Bharat Connect.
          </div>
        )}

        {/* Terms and totals */}
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-8 px-6 py-6">
          <Textarea defaultValue={TERMS} rows={5} className="text-foreground" />
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-foreground">Subtotal</span>
              <span className="font-medium tabular-nums text-foreground">INR {money(subtotal + gstAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-foreground">Adjustment</span>
              <Input inputSize="sm" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} className="!w-36 text-right" disabled={locked} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Select selectSize="sm" wrapperClassName="w-52" defaultValue="">
                <option value="">Select Additional Charges</option>
                <option value="freight">Freight</option>
                <option value="packing">Packing</option>
              </Select>
              <Input inputSize="sm" readOnly value="0" className="!w-36 text-right" aria-label="Additional charges" />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2.5">
              <span className="text-sm font-medium text-foreground">Total</span>
              <span className="text-base font-semibold tabular-nums text-foreground">INR {money(total)}</span>
            </div>
          </div>
        </div>

        {existing ? (
          <div className="flex items-center justify-end gap-2 px-6">
            {rule.mode === "resend" && (
              // Optional note that travels with the revised invoice (invoiceRemarks, up to 256).
              <Input
                inputSize="sm"
                maxLength={256}
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="What changed? (optional)"
                className="!w-80"
              />
            )}
            <Button variant="outline" size="sm" onClick={() => navigate(`${config.basePath}/${existing.id}`)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!counterparty || !itemName || saving}>
              {saving ? "Saving…" : rule.mode === "resend" ? `Save & Resend (v${rule.nextVersion})` : "Save"}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end px-6">
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={!counterparty || !itemName || saving}>
              {saving ? "Creating…" : config.createLabel}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function DateField({ value, placeholder }: { value: string; placeholder?: string }) {
  return (
    <div className="relative">
      <Input inputSize="sm" defaultValue={value} placeholder={placeholder} className="pe-8" />
      <CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
