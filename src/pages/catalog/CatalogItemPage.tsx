import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MoreHorizontal, Plus, SquarePlus, Upload } from "lucide-react";
import { useStore } from "../../store/useStore";
import type { CatalogItem, Invoice } from "../../types";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Tabs } from "../../components/ui/tabs";
import { tableCls, thCls, tdCls, trCls } from "../../components/ui/table";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { priceLabel } from "../../lib/catalogFormat";

// LEDGERS' catalog item page (/v4/catalog/catalog-dashboard/:id): line tabs, a details card on the left,
// Total Sales / Total Purchase tiles and recent documents on the right.

type Tab = "info" | "variants" | "documents" | "transactions" | "activity";

const inr = (n: number) => `INR ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Documents with a line booked against this item, and that line's taxable value. */
function documentsFor(invoices: Invoice[], id: string) {
  return invoices.flatMap((inv) =>
    inv.lineItems.filter((l) => l.catalogId === id).map((l) => ({ inv, value: l.price * l.qty })),
  );
}

export function CatalogItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const item = useStore((s) => s.catalog.find((c) => c.id === id));
  const invoices = useStore((s) => s.invoices).filter((i) => !i.deletedAt);
  const [tab, setTab] = useState<Tab>("info");

  if (!item) {
    return (
      <div className="rounded-xl border border-dashed border-input bg-card px-8 py-16 text-center">
        <div className="text-lg font-medium text-foreground">Catalog not found</div>
        <button onClick={() => navigate("/catalog")} className="mt-3 text-sm font-medium text-primary hover:text-primary/80">
          Back to catalog
        </button>
      </div>
    );
  }

  const docs = documentsFor(invoices, item.id);
  const salesDocs = docs.filter((d) => d.inv.kind === "sales");
  const purchaseDocs = docs.filter((d) => d.inv.kind === "purchase");

  return (
    <div className="space-y-5">
      <Tabs
        variant="line"
        className="!px-0"
        value={tab}
        onChange={setTab}
        items={[
          { value: "info", label: "Information" },
          { value: "variants", label: "Variants" },
          { value: "documents", label: "Documents" },
          { value: "transactions", label: "Transactions" },
          { value: "activity", label: "Activity Log" },
        ]}
      />

      {tab === "info" && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[280px_1fr]">
          <DetailsCard item={item} />
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <Tile label="Total Sales" value={inr(salesDocs.reduce((s, d) => s + d.value, 0))} className="text-primary" />
              <Tile label="Total Purchase" value={inr(purchaseDocs.reduce((s, d) => s + d.value, 0))} className="text-purple-600" />
            </div>
            <RecentDocuments sales={salesDocs} purchase={purchaseDocs} />
          </div>
        </div>
      )}
      {tab === "variants" && <Variants item={item} />}
      {tab === "documents" && (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">No documents uploaded.</p>
          <Button variant="outline">
            <Upload />
            Upload Document
          </Button>
        </Card>
      )}
      {tab === "transactions" && <DocTable rows={docs} kind="all" />}
      {tab === "activity" && <ActivityLog item={item} />}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xs font-medium text-foreground">{children}</div>
    </div>
  );
}

const update = <button className="cursor-pointer font-normal text-primary hover:underline">Update</button>;

function DetailsCard({ item }: { item: CatalogItem }) {
  const sides = [item.sales && "Sales", item.purchase && "Purchase"].filter(Boolean).join(" & ");
  const side = item.purchase ?? item.sales;
  return (
    <Card>
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{item.name}</div>
          <div className="text-xs text-muted-foreground">
            {sides} - {item.type === "goods" ? "Goods" : "Services"}
          </div>
        </div>
        <button aria-label="More" className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-accent">
          <MoreHorizontal className="size-4" />
        </button>
      </div>
      <div className="space-y-3.5 px-4 py-4">
        <Row label="GST">{item.gstRate}%</Row>
        <Row label="Units">{item.unit}</Row>
        <Row label="Price">{priceLabel(item, item.purchase ? "purchase" : "sales")}</Row>
        <Row label="Description">{side?.description || update}</Row>
        <Row label="HSN">{item.hsn}</Row>
        <Row label="CESS">{item.cess ? `${item.cess}${item.cessType === "percent" ? "%" : ""}` : update}</Row>
        <Row label="Expense Type">{side?.expenseType || update}</Row>
        {item.purchase?.sku && <Row label="SKU">{item.purchase.sku}</Row>}
        {item.addedFromBill && (
          <Row label="Added From">
            <span className="inline-flex items-center gap-1.5">
              <BharatConnectMark size={12} />
              <Link to={`/expenses/bills/${item.addedFromBill}`} className="text-primary hover:underline">
                {item.addedFromBill}
              </Link>
            </span>
          </Row>
        )}
        <div className="border-t border-border pt-3.5">
          <Row label="Created By">
            {item.createdBy} on {item.createdAt}
          </Row>
        </div>
      </div>
    </Card>
  );
}

function Tile({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs shadow-black/5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tracking-tight tabular-nums ${className}`}>{value}</p>
    </div>
  );
}

type DocRow = { inv: Invoice; value: number };

function RecentDocuments({ sales, purchase }: { sales: DocRow[]; purchase: DocRow[] }) {
  const [kind, setKind] = useState<"sales" | "purchase">("sales");
  return (
    <Card>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Recent {kind === "sales" ? "Sales Invoices" : "Purchase Invoices"}</span>
        <Tabs
          value={kind}
          onChange={setKind}
          className="!gap-1 !p-0.5"
          items={[
            { value: "sales", label: "Sales" },
            { value: "purchase", label: "Purchase" },
          ]}
        />
      </div>
      <DocTable rows={kind === "sales" ? sales : purchase} kind={kind} bare />
    </Card>
  );
}

function DocTable({ rows, kind, bare }: { rows: DocRow[]; kind: "sales" | "purchase" | "all"; bare?: boolean }) {
  const navigate = useNavigate();
  const table = (
    <table className={tableCls}>
      <thead className="bg-muted/40">
        <tr>
          <th className={thCls}>{kind === "purchase" ? "Bill No." : "Invoice No."}</th>
          <th className={thCls}>Date</th>
          <th className={thCls}>{kind === "sales" ? "Customer Name" : kind === "purchase" ? "Supplier Name" : "Party"}</th>
          <th className={`${thCls} text-right`}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ inv, value }) => (
          <tr key={inv.id} className={trCls}>
            <td className={`${tdCls} text-xs`}>
              <button
                onClick={() => navigate(`${inv.kind === "sales" ? "/sales/invoices" : "/expenses/bills"}/${inv.id}`)}
                className="text-primary hover:underline"
              >
                {inv.id}
              </button>
            </td>
            <td className={`${tdCls} text-xs`}>{inv.date}</td>
            <td className={`${tdCls} truncate text-xs`}>{inv.counterpartyName}</td>
            <td className={`${tdCls} text-right text-xs tabular-nums`}>{inr(value)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
              No invoices available for this catalog
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
  return bare ? table : <Card className="overflow-hidden">{table}</Card>;
}

function Variants({ item }: { item: CatalogItem }) {
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const side = item.sales ?? item.purchase;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-end gap-2 px-4 py-3">
        <Tabs
          value={status}
          onChange={setStatus}
          className="!gap-1 !p-0.5"
          items={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
        <Button variant="outline">
          <Plus />
          Add Variant
        </Button>
      </div>
      <table className={tableCls}>
        <thead className="bg-muted/40">
          <tr>
            <th className={`${thCls} w-12`} />
            <th className={thCls}>Name</th>
            <th className={thCls}>Description</th>
            <th className={thCls}>Price</th>
            <th className={thCls}>Status</th>
          </tr>
        </thead>
        <tbody>
          {status === "active" ? (
            <tr className={trCls}>
              <td className={tdCls}>
                <SquarePlus className="size-4 text-muted-foreground" />
              </td>
              <td className={`${tdCls} text-xs font-medium`}>{item.name}</td>
              <td className={`${tdCls} text-xs`}>{side?.description || "-"}</td>
              <td className={`${tdCls} text-xs tabular-nums`}>{priceLabel(item).replace("₹", "INR ")}</td>
              <td className={`${tdCls} text-xs text-green-600`}>Active</td>
            </tr>
          ) : (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                No inactive variants.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function ActivityLog({ item }: { item: CatalogItem }) {
  const entries = item.addedFromBill
    ? [{ what: `Added from ${item.addedFromBill}, received over Bharat Connect`, when: item.createdAt }]
    : [{ what: `Created by ${item.createdBy}`, when: item.createdAt }];
  return (
    <Card className="px-5 py-4">
      <ul className="space-y-3">
        {entries.map((e) => (
          <li key={e.what} className="flex items-center justify-between text-xs">
            <span className="text-foreground">{e.what}</span>
            <span className="text-muted-foreground">{e.when}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
