import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Plus, Search } from "lucide-react";
import { useStore } from "../../store/useStore";
import type { CatalogItem, Invoice, InvoiceLineItem } from "../../types";
import { Input, Select } from "../../components/ui/input";
import { popoverCls } from "../../components/ui/popover";
import { tableCls, thCls, tdCls } from "../../components/ui/table";
import { CATALOG_UNITS, GST_RATES } from "../../mock/catalog";
import { normName } from "../../lib/itemMatch";
import { summary, type BillItems, type Draft, type ItemRowState } from "./useBillItems";

// Every purchase line in LEDGERS is booked against a catalog item, but a bill received over Bharat Connect
// carries the supplier's item details, not our catalog id. useBillItems() works out a match per line and
// holds the user's changes; three layouts render it (dev panel → Purchase → Items layout):
//   card   — an "Items:" section in the LEDGERS card
//   inline — (A) a row under each line of the bill itself, not printed
//   tabs   — (B) a "Bill | Items" switch above the bill, Items being a full-width table
// Accept (Bharat Connect card) books the bill with these links. Return / Reject add nothing.

const sectionTitle = "text-sm font-semibold text-gray-700";

// ---------- One line's mapping: status, Change, hint, missing fields ----------

export function MappingCell({ row, onChange, align = "end" }: { row: ItemRowState; onChange: (patch: Partial<Draft>) => void; align?: "start" | "end" }) {
  const catalog = useStore((s) => s.catalog);
  const [picking, setPicking] = useState(false);
  const { line, match, draft } = row;
  const isNew = draft.choice === "new";
  const chosen = catalog.find((c) => c.id === draft.choice);
  const similar = match.kind === "new" ? match.similar : [];
  const linkedBefore = match.kind === "linked" && match.item.id === draft.choice;
  const label = isNew
    ? "New item"
    : chosen && normName(chosen.name) === normName(line.name)
      ? linkedBefore
        ? "Linked before"
        : "In catalog"
      : chosen?.name;
  const newDetails = `Will be added as ${line.isService ? "Services" : "Goods"} · ${draft.unit} · ${draft.gst ? `${draft.gst}%` : "GST –"} · HSN ${draft.hsn || "–"}`;

  const hint =
    isNew && similar[0] ? (
      <>
        Same HSN as {similar[0].name} ·{" "}
        <button onClick={() => onChange({ choice: similar[0].id })} className="cursor-pointer font-medium text-primary hover:text-primary/80">
          Use it
        </button>
      </>
    ) : !isNew && chosen && !chosen.purchase ? (
      "Purchase will be turned on for this item"
    ) : null;

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 text-xs ${align === "end" ? "justify-end" : ""}`}>
        <span title={isNew ? newDetails : chosen?.name} className="flex min-w-0 items-center gap-1.5">
          {isNew ? <Plus className="size-3.5 shrink-0 text-primary" strokeWidth={2.5} /> : <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />}
          <span className="truncate text-slate-500">{label}</span>
        </span>
        <button onClick={() => setPicking((p) => !p)} className="shrink-0 cursor-pointer font-medium text-primary hover:text-primary/80">
          Change
        </button>
      </div>
      {hint && <p className={`mt-1 text-[11px] text-slate-400 ${align === "end" ? "text-right" : ""}`}>{hint}</p>}
      <MissingFields row={row} onChange={onChange} align={align} />
      {picking && (
        <CatalogPicker
          hsn={line.hsnSac}
          catalog={catalog}
          onPick={(choice) => {
            onChange({ choice });
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

function MissingFields({ row, onChange, align }: { row: ItemRowState; onChange: (patch: Partial<Draft>) => void; align: "start" | "end" }) {
  const { line, draft } = row;
  if (draft.choice !== "new") return null;
  const needsHsn = !line.hsnSac;
  const needsGst = !!line.gstMissing;
  const needsUnit = !line.unit;
  if (!needsHsn && !needsGst && !needsUnit) return null;
  return (
    <div className={`mt-2 flex flex-wrap gap-2 ${align === "end" ? "justify-end" : ""}`}>
      {needsHsn && (
        <Input
          inputSize="sm"
          value={draft.hsn}
          onChange={(e) => onChange({ hsn: e.target.value.replace(/\D/g, "").slice(0, 8) })}
          placeholder="HSN/SAC *"
          aria-label="HSN/SAC"
          aria-invalid={draft.hsn.length < 4}
          className="!w-28"
        />
      )}
      {needsGst && (
        <Select selectSize="sm" value={draft.gst} onChange={(e) => onChange({ gst: e.target.value })} aria-label="GST rate" aria-invalid={draft.gst === ""} wrapperClassName="w-28">
          <option value="">GST Rate *</option>
          {GST_RATES.map((r) => (
            <option key={r} value={r}>
              {r}%
            </option>
          ))}
        </Select>
      )}
      {needsUnit && (
        <Select selectSize="sm" value={draft.unit} onChange={(e) => onChange({ unit: e.target.value })} aria-label="Unit" wrapperClassName="w-36">
          {CATALOG_UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </Select>
      )}
    </div>
  );
}

/** Small searchable list: "Add as new item", then same-HSN items, then the rest of the catalog. */
function CatalogPicker({
  hsn,
  catalog,
  onPick,
  onClose,
}: {
  hsn?: string;
  catalog: CatalogItem[];
  onPick: (choice: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const items = useMemo(() => {
    const active = catalog.filter((c) => c.status === "active" && (!q || c.name.toLowerCase().includes(q.toLowerCase())));
    const same = active.filter((c) => hsn && c.hsn === hsn);
    const rest = active.filter((c) => !same.includes(c)).sort((a, b) => Number(!!b.purchase) - Number(!!a.purchase) || a.name.localeCompare(b.name));
    return { same, rest };
  }, [catalog, q, hsn]);
  const row = "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent";

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className={`absolute right-0 z-20 mt-1 w-72 p-1 text-left font-sans ${popoverCls}`}>
        <div className="relative mb-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input ref={ref} inputSize="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search catalog..." className="ps-7" />
        </div>
        <div className="max-h-56 overflow-y-auto">
          <button onClick={() => onPick("new")} className={`${row} font-medium text-primary`}>
            <span className="flex items-center gap-1.5">
              <Plus className="size-3.5" /> Add as new item
            </span>
          </button>
          {items.same.length > 0 && <div className="px-2 pb-0.5 pt-1.5 text-[11px] text-muted-foreground">Same HSN</div>}
          {items.same.map((c) => (
            <button key={c.id} onClick={() => onPick(c.id)} className={row}>
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 text-muted-foreground">{c.hsn}</span>
            </button>
          ))}
          {items.rest.length > 0 && <div className="px-2 pb-0.5 pt-1.5 text-[11px] text-muted-foreground">Catalog</div>}
          {items.rest.map((c) => (
            <button key={c.id} onClick={() => onPick(c.id)} className={row}>
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 text-muted-foreground">{c.hsn}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/** After Accept: the catalog item a line was booked against. */
export function LinkedCell({ bill, line, align = "end" }: { bill: Invoice; line: InvoiceLineItem; align?: "start" | "end" }) {
  const item = useStore((s) => s.catalog.find((c) => c.id === line.catalogId));
  if (!line.catalogId) return null;
  return (
    <span className={`flex items-center gap-1.5 text-xs ${align === "end" ? "justify-end" : ""}`}>
      <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
      {item ? (
        <Link to={`/catalog/${item.id}`} className="truncate text-primary hover:underline" title={item.name}>
          {normName(item.name) === normName(line.name) ? (item.addedFromBill === bill.id ? "Added to catalog" : "In catalog") : item.name}
        </Link>
      ) : (
        <span className="text-slate-400">Removed</span>
      )}
    </span>
  );
}

// ---------- Layout "card": section in the LEDGERS card ----------

export function ItemsReview({ items }: { items: BillItems }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className={sectionTitle}>Items:</h3>
        <span className="text-xs text-slate-400">{summary(items)}</span>
      </div>
      <ul className="divide-y divide-dashed divide-slate-200">
        {items.rows.map((row) => (
          <li key={row.line.id} className="flex items-start gap-3 py-2.5">
            <span className="min-w-0 flex-1 truncate pt-px text-xs font-medium text-slate-800" title={row.line.name}>
              {row.line.name}
            </span>
            <div className="max-w-[60%] shrink-0">
              <MappingCell row={row} onChange={(p) => items.set(row.line.id, p)} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LinkedItems({ bill }: { bill: Invoice }) {
  const catalog = useStore((s) => s.catalog);
  const lines = bill.lineItems.filter((l) => l.catalogId);
  if (lines.length === 0) return null;
  const added = lines.filter((l) => catalog.find((c) => c.id === l.catalogId)?.addedFromBill === bill.id).length;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className={sectionTitle}>Items:</h3>
        {added > 0 && <span className="text-xs text-slate-400">{added} added to catalog</span>}
      </div>
      <ul className="divide-y divide-dashed divide-slate-200">
        {lines.map((l) => (
          <li key={l.id} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800" title={l.name}>
              {l.name}
            </span>
            <span className="max-w-[55%] shrink-0">
              <LinkedCell bill={bill} line={l} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Layout "tabs" (B): full-width Items table beside the bill ----------

export function ItemsTable({ bill, items }: { bill: Invoice; items?: BillItems }) {
  const catalog = useStore((s) => s.catalog);
  const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className={sectionTitle}>Items from {bill.counterpartyName}</h3>
        {items && <span className="text-xs text-slate-400">{summary(items)}</span>}
      </div>
      <table className={tableCls}>
        <thead className="bg-muted/40">
          <tr>
            <th className={`${thCls} !text-xs`}>Supplier's item</th>
            <th className={`${thCls} !text-xs`}>Qty</th>
            <th className={`${thCls} !text-xs text-right`}>Rate</th>
            <th className={`${thCls} !text-xs`}>HSN</th>
            <th className={`${thCls} !text-xs w-[38%] text-right`}>Catalog item</th>
          </tr>
        </thead>
        <tbody>
          {bill.lineItems.map((line) => {
            const row = items?.rows.find((r) => r.line.id === line.id);
            return (
              <tr key={line.id} className="align-top">
                <td className={`${tdCls} text-xs`}>
                  <div className="font-medium text-slate-800">{line.name}</div>
                  {line.itemCode && <div className="text-[11px] text-slate-400">Code {line.itemCode}</div>}
                </td>
                <td className={`${tdCls} whitespace-nowrap text-xs`}>
                  {line.qty} {line.unit ?? ""}
                </td>
                <td className={`${tdCls} text-right text-xs tabular-nums`}>{money(line.price)}</td>
                <td className={`${tdCls} text-xs`}>
                  {line.hsnSac ?? catalog.find((c) => c.id === line.catalogId)?.hsn ?? <span className="text-destructive">Not sent</span>}
                </td>
                <td className={`${tdCls} text-right`}>
                  {row ? <MappingCell row={row} onChange={(p) => items!.set(line.id, p)} /> : <LinkedCell bill={bill} line={line} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
