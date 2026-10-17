import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Plus, Search } from "lucide-react";
import { useStore } from "../../store/useStore";
import type { CatalogItem, Invoice, InvoiceLineItem } from "../../types";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Checkbox, Input, Label, Select } from "../../components/ui/input";
import { CATALOG_UNITS, EXPENSE_TYPES, GST_RATES } from "../../mock/catalog";
import { normName, rankCatalog, suggestAccount } from "../../lib/itemMatch";
import { isComplete, itemAccount, type Draft, type ItemRowState } from "./useBillItems";

// Bills received over Bharat Connect carry the supplier's item details, not our catalog id. On the Create Purchase
// Invoice page each line shows the supplier's item name with its catalog match underneath; lines that need a decision
// open the Review popup. The popup goes in order: the match we found → pick from the catalog → add as a new item.
// "Remember for future bills" trains the matching for that supplier (saved on Create).

/** After Accept: which catalog item the line was booked against. Not printed. */
export function LinkedFlag({ bill, line }: { bill: Invoice; line: InvoiceLineItem }) {
  const item = useStore((s) => s.catalog.find((c) => c.id === line.catalogId));
  if (!line.catalogId || !item) return null;
  const same = normName(item.name) === normName(line.name);
  return (
    <Link to={`/catalog/${item.id}`} title={item.name} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary">
      <CheckCircle2 className="size-3 text-green-600" />
      {item.addedFromBill === bill.id ? "Added to catalog" : same ? "In catalog" : item.name}
    </Link>
  );
}

/** Why an item is the match, shown under it in the popup. */
function matchReason(row: ItemRowState, itemId: string, supplier: string): string | null {
  const { match } = row;
  if (match.kind === "none" || match.item.id !== itemId) return null;
  if (match.kind === "linked") return `Linked on an earlier bill from ${supplier}`;
  if (match.kind === "match") return "Same name and HSN";
  return "Suggested: same HSN, similar name";
}

type Mode = "chosen" | "pick" | "new";

/** One line's review: confirm the match, or pick another catalog item, or add it as a new item. */
export function ItemReviewDialog({
  bill,
  row,
  onClose,
  onSave,
}: {
  bill: Invoice;
  row: ItemRowState;
  onClose: () => void;
  onSave: (patch: Partial<Draft>) => void;
}) {
  const catalog = useStore((s) => s.catalog);
  const { line } = row;
  const [d, setD] = useState<Draft>(row.draft);
  const [mode, setMode] = useState<Mode>(d.choice === "new" ? "new" : d.choice ? "chosen" : "pick");
  const [q, setQ] = useState("");
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const supplier = bill.counterpartyName;

  const options = useMemo(() => rankCatalog(line, catalog, q).slice(0, 5), [line, catalog, q]);
  const chosen = catalog.find((c) => c.id === d.choice);

  const meta = [
    line.itemCode && `Code ${line.itemCode}`,
    line.hsnSac ? `HSN ${line.hsnSac}` : "No HSN sent",
    `${line.qty} ${line.unit ?? ""} × ${line.price.toLocaleString("en-IN")}`,
    line.gstMissing ? "No GST rate sent" : `GST ${line.gstPercent}%`,
  ].filter(Boolean);

  // An existing item is mapped to its own account type; a new item gets one chosen below (preselected).
  const pick = (c: CatalogItem) => {
    set({ choice: c.id, account: itemAccount(c) || suggestAccount(line, catalog) });
    setMode("chosen");
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Review item"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!isComplete(d)}
            onClick={() => {
              onSave({ ...d, reviewed: true });
              onClose();
            }}
          >
            {mode === "new" ? "Add as new item" : "Use this item"}
          </Button>
        </>
      }
    >
      {/* What the supplier sent */}
      <div>
        <div className="mb-1 text-[11px] text-muted-foreground">On {supplier}'s bill</div>
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <div className="text-sm font-medium text-foreground">{line.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{meta.join(" · ")}</div>
        </div>
      </div>

      {/* 1. The match */}
      {mode === "chosen" && chosen && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">In your catalog</span>
            <button onClick={() => setMode("pick")} className="cursor-pointer text-[11px] font-medium text-primary hover:underline">
              Change
            </button>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{chosen.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                HSN {chosen.hsn} · GST {chosen.gstRate}% · {chosen.unit}
              </div>
              {matchReason(row, chosen.id, supplier) && <div className="mt-1 text-[11px] text-muted-foreground">{matchReason(row, chosen.id, supplier)}</div>}
              {!chosen.purchase && <div className="mt-1 text-[11px] text-muted-foreground">Purchase will be turned on for this item.</div>}
            </div>
          </div>
        </div>
      )}

      {/* 2. Not matched (or changing it): a short, ranked catalog search */}
      {mode === "pick" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Find it in your catalog</span>
            {/* Not in the catalog: a new item */}
            <button
              onClick={() => {
                set({ choice: "new", account: suggestAccount(line, catalog) });
                setMode("new");
              }}
              className="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <Plus className="size-3" /> Add new item
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input inputSize="sm" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or HSN..." className="ps-8" />
          </div>
          {options.length > 0 ? (
            <div className="space-y-0.5">
              {options.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pick(c)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-xs ${
                    d.choice === c.id ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-accent"
                  }`}
                >
                  <span className="truncate text-foreground">{c.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {c.hsn} · {c.gstRate}%
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-0.5 text-xs text-muted-foreground">{q.trim() ? "Nothing in your catalog matches that." : "No similar items in your catalog. Search by name or HSN."}</p>
          )}
        </div>
      )}

      {/* New item details (LEDGERS requires HSN/SAC, GST rate and units) */}
      {mode === "new" && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">New catalog item</span>
            <button
              onClick={() => {
                set({ choice: row.draft.choice === "new" ? "" : row.draft.choice, account: row.draft.account });
                setMode("pick");
              }}
              className="cursor-pointer text-[11px] font-medium text-primary hover:underline"
            >
              Search catalog instead
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
            <div className="col-span-2 space-y-1.5">
              <Label required>Item Name</Label>
              <Input inputSize="sm" value={d.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label required>HSN/SAC</Label>
              <Input
                inputSize="sm"
                value={d.hsn}
                onChange={(e) => set({ hsn: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                placeholder={line.hsnSac ? undefined : "Not sent by supplier"}
                aria-invalid={d.hsn.length < 4}
              />
            </div>
            <div className="space-y-1.5">
              <Label required>GST Rate</Label>
              <Select selectSize="sm" value={d.gst} onChange={(e) => set({ gst: e.target.value })} aria-invalid={d.gst === ""}>
                <option value="">Select</option>
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label required>Units</Label>
              <Select selectSize="sm" value={d.unit} onChange={(e) => set({ unit: e.target.value })}>
                {CATALOG_UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Input inputSize="sm" value={line.isService ? "Services" : "Goods"} readOnly />
            </div>
            {/* LEDGERS needs an account type to post the purchase; saved as the new item's Purchase Expense Type. */}
            <div className="col-span-2 space-y-1.5">
              <Label required>Account Type</Label>
              <Select selectSize="sm" value={d.account} onChange={(e) => set({ account: e.target.value })} aria-invalid={d.account === ""}>
                <option value="">Select Account Type</option>
                {EXPENSE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Train the matching */}
      {mode !== "pick" && (
        <label className="flex cursor-pointer items-start gap-2 text-xs">
          <Checkbox checked={d.remember} onChange={(e) => set({ remember: e.target.checked })} className="mt-0.5" />
          <span>
            <span className="font-medium text-foreground">Remember for future bills from {supplier}</span>
            <span className="block text-muted-foreground">Next time "{line.itemCode ?? line.name}" is matched automatically.</span>
          </span>
        </label>
      )}
    </Dialog>
  );
}
