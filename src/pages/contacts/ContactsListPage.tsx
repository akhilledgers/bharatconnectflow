import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Edit3, Eye, Filter, MoreHorizontal, SlidersHorizontal, Trash2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { InviteBcTooltip } from "../../components/InviteBcTooltip";
import { FilterMenu } from "../../components/FilterMenu";
import { ConnectBharatConnectBanner } from "../../components/ConnectBharatConnectCTA";
import { CreateContactModal } from "./CreateContactModal";
import type { LedgerContact, ContactType } from "../../types";

type TypeFilter = "all" | ContactType;
type BcFilter = "all" | "connected" | "not_connected";

export function ContactsListPage() {
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const contacts = useStore((s) => s.contacts);
  const connected = business.connectionState === "connected";

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [bcFilter, setBcFilter] = useState<BcFilter>("all");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = contacts.filter((c) => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (connected && bcFilter === "connected" && !c.b2bId) return false;
    if (connected && bcFilter === "not_connected" && c.b2bId) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.businessName?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Contacts</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          <span className="text-base leading-none">+</span>
          Create Contact
        </button>
      </div>

      <ConnectBharatConnectBanner message="Turn your contacts into a live network — onboard to Bharat Connect." />

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-72 rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5 text-sm">
              {([
                ["all", "All"],
                ["customer", "Customer"],
                ["supplier", "Supplier"],
              ] as [TypeFilter, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTypeFilter(value)}
                  className={`rounded-md px-3 py-1.5 ${
                    typeFilter === value ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {connected ? (
              <FilterMenu
                value={bcFilter}
                defaultValue="all"
                onChange={setBcFilter}
                options={[
                  { value: "all", label: "All Bharat Connect statuses" },
                  { value: "connected", label: "Connected" },
                  { value: "not_connected", label: "Not connected" },
                ]}
              />
            ) : (
              <button className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent">
                <Filter className="h-4 w-4" />
              </button>
            )}
            <button className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-foreground">
              <th className="w-10 px-4 py-3">
                <input type="checkbox" className="h-4 w-4 rounded border-input" />
              </th>
              <th className="px-2 py-3 font-medium">Name</th>
              <th className="px-2 py-3 font-medium">Business Name</th>
              <th className="px-2 py-3 font-medium">Email</th>
              <th className="px-2 py-3 font-medium">Mobile</th>
              <th className="px-2 py-3 font-medium">GSTIN</th>
              <th className="px-2 py-3 font-medium">Region</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => (
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No contacts match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>
            Showing Records 1 to {rows.length} of {rows.length} total records
          </span>
          <div className="flex gap-2">
            <button className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-accent" disabled>
              Previous
            </button>
            <button className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-accent" disabled>
              Next
            </button>
          </div>
        </div>
      </div>

      {createOpen && <CreateContactModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Eye;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${
        danger ? "text-red-600" : "text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
      {label}
    </button>
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
  return (
    <tr className="relative hover:bg-accent/60">
      <td className="px-4 py-4">
        <input type="checkbox" className="h-4 w-4 rounded border-input" />
      </td>
      <td className="px-2 py-4">
        <div className="flex items-center gap-1.5">
          {connected && (
            <span className="flex w-[13px] shrink-0 justify-center">
              {contact.b2bId ? (
                <span title="Connected to Bharat Connect">
                  <BharatConnectMark size={13} />
                </span>
              ) : contact.b2bId === null ? (
                <InviteBcTooltip counterpartyName={contact.name}>
                  <span className="cursor-default">
                    <BharatConnectMark size={13} className="grayscale opacity-50" />
                  </span>
                </InviteBcTooltip>
              ) : (
                <span title="No GSTIN or PAN on file — can't check Bharat Connect status">
                  <BharatConnectMark size={13} className="grayscale opacity-20" />
                </span>
              )}
            </span>
          )}
          <button onClick={onView} className="font-medium text-primary hover:underline">
            {contact.salutation} {contact.name}
          </button>
        </div>
      </td>
      <td className="px-2 py-4 text-foreground">{contact.businessName ?? "—"}</td>
      <td className="px-2 py-4 text-foreground">{contact.email ?? "—"}</td>
      <td className="px-2 py-4 text-foreground">{contact.mobile ?? "—"}</td>
      <td className="px-2 py-4 text-foreground">{contact.gstin ?? "—"}</td>
      <td className="px-2 py-4 text-foreground">{contact.region}</td>
      <td className="px-4 py-4 text-right">
        <div className="relative inline-block">
          <button
            onClick={onToggleMenu}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-border bg-card p-1.5 shadow-lg">
                <MenuItem
                  icon={Eye}
                  label="View Details"
                  onClick={() => {
                    onCloseMenu();
                    onView();
                  }}
                />
                <MenuItem icon={Edit3} label="Edit" onClick={onCloseMenu} />
                <MenuItem icon={Copy} label="Duplicate" onClick={onCloseMenu} />
                <div className="my-1 border-t border-border" />
                <MenuItem icon={Trash2} label="Delete" danger onClick={onCloseMenu} />
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
