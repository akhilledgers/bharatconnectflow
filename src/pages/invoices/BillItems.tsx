import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckCircle2, Plus, Search } from "lucide-react";
import { useStore } from "../../store/useStore";
import type { Invoice, InvoiceLineItem } from "../../types";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Checkbox, Input, Label, Select } from "../../components/ui/input";
import { CATALOG_UNITS, GST_RATES } from "../../mock/catalog";
import { normName } from "../../lib/itemMatch";
import { isComplete, needsReview, type Draft, type ItemRowState } from "./useBillItems";

// Bills received over Bharat Connect carry the supplier's item details, not our catalog id. Each line on the printed
// bill gets a flag next to its name: a blue "Review" link when it needs a decision (new item, missing details,
// a similar item exists), a quiet ✓ when it matched. Review opens one popup per line — link it to a catalog item or
// add it as new — and "Remember for future bills" trains the matching for that supplier (saved on Accept).

/** Next to an item name on the bill, while the bill waits for a response. Not printed. */
export function LineFlag({ row, onReview }: { row: ItemRowState; onReview: () => void }) {
  const catalog = useStore((s) => s.catalog);
  if (needsReview(row)) {
    return (
      <button onClick={onReview} className="cursor-pointer text-[11px] font-medium text-primary hover:underline">
        Review
      </button>
    );
  }
  const chosen = catalog.find((c) => c.id === row.draft.choice);
  const label = row.draft.choice === "new" ? `New item: ${row.draft.name}` : chosen ? chosen.name : "In catalog";
  const same = chosen && normName(chosen.name) === normName(row.line.name);
  return (
    <button onClick={onReview} title={`${label} · click to change`} className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
      <Check className="size-3 text-green-600" strokeWidth={3} />
      {row.draft.choice === "new" ? "New item" : same ? "In catalog" : chosen?.name}
    </button>
  );
}

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

/** One line's review: link to a catalog item (same HSN first, then search) or add it as a new item. */
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
  const { line, match } = row;
  const [d, setD] = useState<Draft>(row.draft);
  const [q, setQ] = useState("");
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const supplier = bill.counterpartyName;

  const lists = useMemo(() => {
    const active = catalog.filter((c) => c.status === "active");
    const same = line.hsnSac ? active.filter((c) => c.hsn === line.hsnSac) : [];
    const query = q.trim().toLowerCase();
    const rest = active
      .filter((c) => !same.includes(c) && (!query || c.name.toLowerCase().includes(query) || c.hsn.includes(query)))
      .sort((a, b) => Number(!!b.purchase) - Number(!!a.purchase) || a.name.localeCompare(b.name));
    return { same: query ? same.filter((c) => c.name.toLowerCase().includes(query)) : same, rest };
  }, [catalog, line.hsnSac, q]);

  const isNew = d.choice === "new";
  const chosen = catalog.find((c) => c.id === d.choice);
  const meta = [
    line.itemCode && `Code ${line.itemCode}`,
    line.hsnSac ? `HSN ${line.hsnSac}` : "No HSN sent",
    `${line.qty} ${line.unit ?? ""} × ${line.price.toLocaleString("en-IN")}`,
    line.gstMissing ? "No GST rate sent" : `GST ${line.gstPercent}%`,
  ].filter(Boolean);
  const row_ = (active: boolean) =>
    `flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-xs ${
      active ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-accent"
    }`;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Review item"
      description={`From ${supplier}. Link it to an item in your catalog, or add it as a new one.`}
      className="!max-w-xl"
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
            Save
          </Button>
        </>
      }
    >
      {/* What the supplier sent */}
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
        <div className="text-sm font-medium text-foreground">{line.name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{meta.join(" · ")}</div>
      </div>

      {/* Where it goes */}
      <div className="space-y-2">
        <Label>Match to your catalog</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input inputSize="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search catalog by name or HSN..." className="ps-8" />
        </div>
        <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-md border border-border p-1">
          <button onClick={() => set({ choice: "new" })} className={row_(isNew)}>
            <span className="flex items-center gap-1.5 font-medium text-primary">
              <Plus className="size-3.5" /> Add as new item
            </span>
            {isNew && <Check className="size-3.5 text-primary" />}
          </button>
          {lists.same.length > 0 && <div className="px-2.5 pb-0.5 pt-2 text-[11px] text-muted-foreground">Same HSN · suggested</div>}
          {lists.same.map((c) => (
            <button key={c.id} onClick={() => set({ choice: c.id })} className={row_(d.choice === c.id)}>
              <span className="truncate text-foreground">{c.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                {c.hsn} · {c.gstRate}%{d.choice === c.id && <Check className="size-3.5 text-primary" />}
              </span>
            </button>
          ))}
          {lists.rest.length > 0 && <div className="px-2.5 pb-0.5 pt-2 text-[11px] text-muted-foreground">Catalog</div>}
          {lists.rest.map((c) => (
            <button key={c.id} onClick={() => set({ choice: c.id })} className={row_(d.choice === c.id)}>
              <span className="truncate text-foreground">{c.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                {c.hsn} · {c.gstRate}%{d.choice === c.id && <Check className="size-3.5 text-primary" />}
              </span>
            </button>
          ))}
        </div>
        {match.kind === "linked" && match.item.id === d.choice && (
          <p className="text-[11px] text-muted-foreground">Linked on an earlier bill from {supplier}.</p>
        )}
        {!isNew && chosen && !chosen.purchase && <p className="text-[11px] text-muted-foreground">Purchase will be turned on for {chosen.name}.</p>}
      </div>

      {/* New item details (LEDGERS requires HSN/SAC, GST rate and units) */}
      {isNew && (
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
        </div>
      )}

      {/* Train the matching */}
      <label className="flex cursor-pointer items-start gap-2 text-xs">
        <Checkbox checked={d.remember} onChange={(e) => set({ remember: e.target.checked })} className="mt-0.5" />
        <span>
          <span className="font-medium text-foreground">Remember for future bills from {supplier}</span>
          <span className="block text-muted-foreground">
            Next time "{line.itemCode ?? line.name}" is matched automatically. Saved when you accept the bill.
          </span>
        </span>
      </label>
    </Dialog>
  );
}
