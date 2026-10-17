import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, Copy, Eye, Funnel, MoreVertical, Plus, Search, Settings2, SquarePen, Trash2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { InviteBcTooltip } from "../../components/InviteBcTooltip";
import { FilterMenu } from "../../components/FilterMenu";
import { ConnectBharatConnectBanner } from "../../components/ConnectBharatConnectCTA";
import { Button } from "../../components/ui/button";
import { Checkbox, Input } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { ToggleGroup } from "../../components/ui/tabs";
import { tableCls, thCls, tdCls, trCls, TablePagination } from "../../components/ui/table";
import { CreateContactModal } from "./CreateContactModal";
import type { LedgerContact, ContactType } from "../../types";

// Copied from LEDGERS' live Contacts (in.ledgers.cloud/v4/contacts/manage-contacts): text-xl title with an outline
// "Create Contact", one card with search, All / Customer / Supplier, Active filter, settings; columns Name,
// Business Name, Email, Mobile, GSTIN, Region, Action; 10 rows per page. Bharat Connect adds the B mark before
// the name and a status filter.

type TypeFilter = "all" | ContactType;
type BcFilter = "all" | "connected" | "not_connected";
const PAGE = 10;

const toolbarBtn =
  "inline-flex h-8.5 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-xs shadow-black/5 hover:bg-accent [&_svg]:size-4 [&_svg]:opacity-60";
const cell = "min-w-0 max-w-full truncate text-sm font-normal text-gray-600";

export function ContactsListPage() {
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const contacts = useStore((s) => s.contacts);
  const connected = business.connectionState === "connected";

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [bcFilter, setBcFilter] = useState<BcFilter>("all");
  const [search, setSearch] = useState("");
  const [asc, setAsc] = useState<boolean | null>(null);
  const [page, setPage] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = contacts.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (connected && bcFilter === "connected" && !c.b2bId) return false;
      if (connected && bcFilter === "not_connected" && c.b2bId) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.businessName?.toLowerCase().includes(q)) return false;
      return true;
    });
    if (asc !== null) r = [...r].sort((a, b) => (asc ? 1 : -1) * a.name.localeCompare(b.name));
    return r;
  }, [contacts, typeFilter, bcFilter, search, asc, connected]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground">Contacts</h1>
        <Button variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus />
          Create Contact
        </Button>
      </div>

      <ConnectBharatConnectBanner message="Turn your contacts into a live network — onboard to Bharat Connect." />

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs shadow-black/5">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-2.5 border-b border-border px-5 py-3">
          <div className="relative w-50">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search contacts..."
              className="ps-9"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <ToggleGroup
              value={typeFilter}
              onChange={(v) => {
                setTypeFilter(v);
                setPage(0);
              }}
              items={[
                { value: "all", label: "All" },
                { value: "customer", label: "Customer" },
                { value: "supplier", label: "Supplier" },
              ]}
            />
            {connected && (
              <FilterMenu
                value={bcFilter}
                defaultValue="all"
                onChange={(v) => {
                  setBcFilter(v);
                  setPage(0);
                }}
                options={[
                  { value: "all", label: "All Bharat Connect statuses" },
                  { value: "connected", label: "On Bharat Connect" },
                  { value: "not_connected", label: "Not on Bharat Connect" },
                ]}
              />
            )}
            <button className={toolbarBtn} title="Show active or inactive contacts">
              <Funnel />
              Active
            </button>
            <button className={`${toolbarBtn} !px-2.5`} title="Settings">
              <Settings2 />
            </button>
          </div>
        </div>

        <table className={`${tableCls} table-fixed`}>
          <thead>
            <tr className="bg-muted/40">
              <th className={`${thCls} w-12`}>
                <Checkbox aria-label="Select all" />
              </th>
              <th className={thCls}>
                <button onClick={() => setAsc(asc === null ? true : !asc)} className="inline-flex cursor-pointer items-center gap-1.5">
                  Name
                  <ArrowUpDown className="size-3.5 opacity-60" />
                </button>
              </th>
              <th className={thCls}>Business Name</th>
              <th className={thCls}>Email</th>
              <th className={thCls}>Mobile</th>
              <th className={thCls}>GSTIN</th>
              <th className={`${thCls} w-28`}>Region</th>
              <th className={`${thCls} w-20`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                connected={connected}
                menuOpen={openMenuId === c.id}
                onToggleMenu={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                onCloseMenu={() => setOpenMenuId(null)}
                onView={() => navigate(`/contacts/${c.id}`)}
              />
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No contacts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex min-h-14 items-center px-5">
          <TablePagination from={current * PAGE + 1} to={current * PAGE + shown.length} total={rows.length} page={current} pages={pages} onPage={setPage} />
        </div>
      </div>

      {createOpen && <CreateContactModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function ContactRow({
  contact,
  connected,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onView,
}: {
  contact: LedgerContact;
  connected: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onView: () => void;
}) {
  const name = `${contact.salutation} ${contact.name}`;
  return (
    <tr className={trCls}>
      <td className={tdCls}>
        <Checkbox aria-label={`Select ${contact.name}`} />
      </td>
      <td className={tdCls}>
        <div className="flex min-w-0 items-center gap-1.5 text-sm font-normal text-primary">
          {connected && (
            <span className="flex w-[13px] shrink-0 justify-center">
              {contact.b2bId ? (
                <span title={`On Bharat Connect · ${contact.b2bId}`}>
                  <BharatConnectMark size={13} />
                </span>
              ) : contact.b2bId === null ? (
                <InviteBcTooltip counterpartyName={contact.name}>
                  <span className="cursor-default">
                    <BharatConnectMark size={13} className="grayscale opacity-50" />
                  </span>
                </InviteBcTooltip>
              ) : contact.email || contact.mobile || contact.gstin || contact.pan ? (
                <span title="No GSTIN or PAN linked">
                  <BharatConnectMark size={13} className="grayscale opacity-20" />
                </span>
              ) : null /* nothing to identify them by: no mark at all (the empty slot keeps names aligned) */}
            </span>
          )}
          <button onClick={onView} className="min-w-0 max-w-full cursor-pointer truncate hover:underline" title={name}>
            {name}
          </button>
        </div>
      </td>
      <td className={tdCls}>
        <div className={cell}>{contact.businessName ?? "-"}</div>
      </td>
      <td className={tdCls}>
        <div className={cell} title={contact.email}>
          {contact.email ?? "-"}
        </div>
      </td>
      <td className={tdCls}>
        <div className={cell}>{contact.mobile ?? "-"}</div>
      </td>
      <td className={tdCls}>
        <div className={cell}>{contact.gstin ?? "-"}</div>
      </td>
      <td className={tdCls}>
        <div className={cell}>{contact.region || "-"}</div>
      </td>
      <td className={`${tdCls} relative`}>
        <button onClick={onToggleMenu} aria-label="Actions" className="cursor-pointer select-none rounded p-1 text-muted-foreground hover:bg-muted">
          <MoreVertical className="size-4" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
            <div className={`absolute right-4 z-20 mt-1 w-40 space-y-0.5 p-1 ${popoverCls}`}>
              <button
                className={menuItemCls}
                onClick={() => {
                  onCloseMenu();
                  onView();
                }}
              >
                <Eye />
                View
              </button>
              <button className={menuItemCls} onClick={onCloseMenu}>
                <SquarePen />
                Edit
              </button>
              <button className={menuItemCls} onClick={onCloseMenu}>
                <Copy />
                Duplicate
              </button>
              <button className={`${menuItemCls} !text-destructive [&_svg]:!opacity-100`} onClick={onCloseMenu}>
                <Trash2 />
                Delete
              </button>
            </div>
          </>
        )}
      </td>
    </tr>
  );
}
