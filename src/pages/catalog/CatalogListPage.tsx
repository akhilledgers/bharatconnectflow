import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, Eye, Funnel, MoreHorizontal, Network, Plus, Search, Settings2, SquarePen, Trash2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { Button } from "../../components/ui/button";
import { Checkbox, Input } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { tableCls, thCls, tdCls, trCls, TablePagination } from "../../components/ui/table";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { CreateCatalogDialog } from "./CreateCatalogDialog";
import { priceLabel } from "../../lib/catalogFormat";

// Copied from LEDGERS' live Catalog (in.ledgers.cloud/v4/catalog/manage-catalog): outline "Create Catalog",
// a card with search, All / Sales / Purchase, Active filter; columns Product Name, Description, Price,
// GST Rate, Units, Action; 10 rows per page.

type Mode = "all" | "sales" | "purchase";
const PAGE = 10;

const toolbarBtn =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-xs shadow-black/5 hover:bg-accent [&_svg]:size-4 [&_svg]:opacity-60";


export function CatalogListPage() {
  const navigate = useNavigate();
  const catalog = useStore((s) => s.catalog);
  const [mode, setMode] = useState<Mode>("all");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [query, setQuery] = useState("");
  const [asc, setAsc] = useState<boolean | null>(null);
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => {
    let r = catalog.filter(
      (c) =>
        c.status === status &&
        (mode === "all" || (mode === "sales" ? !!c.sales : !!c.purchase)) &&
        (!query || c.name.toLowerCase().includes(query.toLowerCase())),
    );
    if (asc !== null) r = [...r].sort((a, b) => (asc ? 1 : -1) * a.name.localeCompare(b.name));
    return r;
  }, [catalog, mode, status, query, asc]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground">Catalog</h1>
        <Button variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus />
          Create Catalog
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs shadow-black/5">
        <div className="flex items-center justify-between gap-3 px-3.5 py-3">
          <div className="relative w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search catalog..."
              className="ps-9"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 items-center overflow-hidden rounded-md border border-input shadow-xs shadow-black/5">
              {(["all", "sales", "purchase"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setPage(0);
                  }}
                  className={`h-full cursor-pointer border-s border-input px-2.5 text-xs font-medium capitalize first:border-s-0 ${
                    mode === m ? "bg-accent text-foreground" : "bg-background text-foreground hover:bg-accent/60"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button className={toolbarBtn} title="Group by">
              <Network />
            </button>
            <button
              className={toolbarBtn}
              onClick={() => {
                setStatus(status === "active" ? "inactive" : "active");
                setPage(0);
              }}
              title="Show active or inactive items"
            >
              <Funnel />
              {status === "active" ? "Active" : "Inactive"}
            </button>
            <button className={toolbarBtn} title="Settings">
              <Settings2 />
            </button>
          </div>
        </div>

        <table className={`${tableCls} table-fixed`}>
          <thead className="bg-muted/40">
            <tr>
              <th className={`${thCls} w-12`}>
                <Checkbox aria-label="Select all" />
              </th>
              <th className={`${thCls} w-[22%]`}>
                <button onClick={() => setAsc(asc === null ? true : !asc)} className="inline-flex cursor-pointer items-center gap-1.5">
                  Product Name
                  <ArrowUpDown className="size-3.5 opacity-60" />
                </button>
              </th>
              <th className={thCls}>Description</th>
              <th className={`${thCls} w-[21%]`}>Price</th>
              <th className={`${thCls} w-28`}>GST Rate</th>
              <th className={`${thCls} w-32`}>Units</th>
              <th className={`${thCls} w-20`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => {
              const side = mode === "purchase" ? c.purchase : (c.sales ?? c.purchase);
              return (
                <tr key={c.id} className={trCls}>
                  <td className={tdCls}>
                    <Checkbox aria-label={`Select ${c.name}`} />
                  </td>
                  <td className={`${tdCls} truncate text-xs`}>
                    <span className="inline-flex max-w-full items-center gap-1.5">
                      <button onClick={() => navigate(`/catalog/${c.id}`)} className="truncate text-primary hover:underline">
                        {c.name}
                      </button>
                      {c.addedFromBill && (
                        <span title={`Added from ${c.addedFromBill} received over Bharat Connect`} className="shrink-0">
                          <BharatConnectMark size={12} />
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={`${tdCls} truncate text-xs text-foreground`}>{side?.description || "-"}</td>
                  <td className={`${tdCls} truncate text-xs tabular-nums text-foreground`}>{priceLabel(c, mode)}</td>
                  <td className={`${tdCls} text-xs text-foreground`}>{c.gstRate}%</td>
                  <td className={`${tdCls} truncate text-xs text-foreground`}>{c.unit}</td>
                  <td className={`${tdCls} relative`}>
                    <button
                      onClick={() => setMenu(menu === c.id ? null : c.id)}
                      aria-label="Actions"
                      className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md hover:bg-accent"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                    {menu === c.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                        <div className={`absolute right-4 z-20 mt-1 w-40 space-y-0.5 p-1 ${popoverCls}`}>
                          <button className={menuItemCls} onClick={() => navigate(`/catalog/${c.id}`)}>
                            <Eye />
                            View
                          </button>
                          <button className={menuItemCls} onClick={() => setMenu(null)}>
                            <SquarePen />
                            Edit
                          </button>
                          <button className={`${menuItemCls} !text-destructive [&_svg]:!opacity-100`} onClick={() => setMenu(null)}>
                            <Trash2 />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-xs text-muted-foreground">
                  No catalog found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex min-h-14 items-center px-5">
          <TablePagination
            from={current * PAGE + 1}
            to={current * PAGE + shown.length}
            total={rows.length}
            page={current}
            pages={pages}
            onPage={setPage}
          />
        </div>
      </div>

      <CreateCatalogDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
