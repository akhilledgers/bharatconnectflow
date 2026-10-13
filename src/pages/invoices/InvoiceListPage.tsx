import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowDownToLine,
  CalendarDays,
  Copy,
  Eye,
  Funnel,
  MoreHorizontal,
  Plus,
  Printer,
  Search,
  Send,
  Settings2,
  Split,
  SquareMenu,
  SquarePen,
  Trash2,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Checkbox, Input } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { tableCls, thCls, tdCls, trCls, TablePagination } from "../../components/ui/table";
import { CANCEL_PICKS, deleteRule, editRule } from "../../lib/editRules";
import { Dialog } from "../../components/ui/dialog";
import { CancelDialog } from "./BcDialogs";
import { PHASE2 } from "../../lib/phase";
import { useStore } from "../../store/useStore";
import { statusLabel, statusVariant, confirmationMeta, latestBcComment, isIncoming } from "../../lib/invoiceStatus";
import { Badge } from "../../components/ui/badge";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { ConnectBharatConnectBanner } from "../../components/ConnectBharatConnectCTA";
import { PendingActionsBanner } from "../../components/layout/PendingActionsBanner";
import { InviteBcTooltip } from "../../components/InviteBcTooltip";
import { FilterMenu } from "../../components/FilterMenu";
import { configFor, sumAmount, sumUnpaid, inr } from "./kindConfig";
import type { Invoice } from "../../types";

// Stat card as on LEDGERS' Invoices page: rounded-2xl, p-6, grey label, xl amount, FY range.
function StatCard({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold tracking-tight tabular-nums ${className}`}>{value}</p>
        <p className="text-xs text-muted-foreground">01-04-2026 - 31-03-2027</p>
      </div>
    </div>
  );
}

const toolbarIconBtn =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-xs shadow-black/5 hover:bg-accent [&_svg]:size-4 [&_svg]:opacity-60";

type BcFilter = "all" | "not_sent" | "pending" | "accepted" | "returned" | "rejected" | "cancelled" | "failure";

// Statuses from handbook Annexure H. "pending" is Sent To Buyer (sales) / Awaiting Response (bills).
const SALES_BC_FILTERS: { value: BcFilter; label: string }[] = [
  { value: "all", label: "All Bharat Connect statuses" },
  { value: "not_sent", label: "Pending to send" },
  { value: "pending", label: "Sent To Buyer" },
  { value: "accepted", label: "Accepted" },
  { value: "returned", label: "Returned" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "failure", label: "Failed" },
];

const PURCHASE_BC_FILTERS: { value: BcFilter; label: string }[] = [
  { value: "all", label: "All Bharat Connect statuses" },
  { value: "pending", label: "Awaiting Response" },
  { value: "accepted", label: "Accepted" },
  ...(PHASE2.buyerReturn ? [{ value: "returned" as const, label: "Returned" }] : []),
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

function matchesBcFilter(invoice: Invoice, filter: BcFilter): boolean {
  if (filter === "all") return true;
  if (filter === "not_sent") return invoice.bcSendStatus === "not_sent";
  return invoice.bcConfirmationStatus === filter;
}

export function InvoiceListPage({ kind }: { kind: "sales" | "purchase" }) {
  const config = configFor(kind);
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const deleteInvoice = useStore((s) => s.deleteInvoice);
  const cancelAndDeleteInvoice = useStore((s) => s.cancelAndDeleteInvoice);
  const [toDelete, setToDelete] = useState<{ inv: Invoice; mode: "delete" | "cancel-delete" } | null>(null);
  const allInvoices = useStore((s) => s.invoices);
  const sendInvoiceViaBharatConnect = useStore((s) => s.sendInvoiceViaBharatConnect);
  const connected = business.connectionState === "connected";
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [bcFilter, setBcFilter] = useState<BcFilter>("all");
  // Sales: deleted documents are kept (soft delete) and listed under "Deleted"; totals only count active ones.
  const [showDeleted, setShowDeleted] = useState(false);
  // Bills: the Bharat Connect view lists only bills received over Bharat Connect, the ones to create first.
  const [bcOnly, setBcOnly] = useState(false);

  const rows = allInvoices.filter((i) => i.kind === kind && !i.deletedAt);
  // Raw Bharat Connect invoices are listed but aren't in the books yet, so they're left out of the totals.
  const booked = rows.filter((i) => !isIncoming(i));
  const received = rows.filter((i) => i.bcSendStatus === "sent");
  const toCreate = received.filter((i) => isIncoming(i) && i.bcConfirmationStatus === "pending").length;
  const showBcView = kind === "purchase" && connected && bcOnly;
  const listed = showDeleted
    ? allInvoices.filter((i) => i.kind === kind && i.deletedAt)
    : showBcView
      ? [...received].sort((a, b) => Number(b.bcConfirmationStatus === "pending") - Number(a.bcConfirmationStatus === "pending"))
      : rows;
  const filteredRows = connected && !showDeleted ? listed.filter((i) => matchesBcFilter(i, bcFilter)) : listed;
  const total = sumAmount(booked);
  const outstanding = sumUnpaid(booked);

  const stats = [
    { label: config.statCardLabels[0], value: inr(total), className: "text-emerald-600" },
    { label: config.statCardLabels[1], value: inr(outstanding), className: "text-amber-600" },
    { label: config.statCardLabels[2], value: inr(Math.round(outstanding * 0.79)), className: "text-red-600" },
    { label: config.statCardLabels[3], value: "INR 0.00", className: "text-purple-600" },
  ];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground">{config.pageTitle}</h1>
        <Button variant="outline" onClick={() => navigate(`${config.basePath}/create`)}>
          <Plus />
          {config.createLabel}
        </Button>
      </div>

      <ConnectBharatConnectBanner
        message={
          kind === "sales"
            ? "Get paid faster — onboard to Bharat Connect and send invoices instantly."
            : "Onboard to Bharat Connect to receive and confirm bills the moment they land."
        }
      />
      {connected && (
        <PendingActionsBanner
          kind={kind}
          onReview={() => {
            setBcFilter(kind === "sales" ? "not_sent" : "pending");
            if (kind === "purchase") setBcOnly(true);
          }}
        />
      )}

      <div className="mb-5 grid grid-cols-4 gap-5">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs shadow-black/5">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={`Search ${config.singular}...`} className="ps-9" />
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex h-8.5 w-56 items-center gap-2 rounded-md border border-input bg-background px-3 text-2sm text-muted-foreground/80 shadow-xs shadow-black/5">
              <CalendarDays className="size-4 text-muted-foreground" />
              Select Date range
            </button>
            {connected ? (
              <FilterMenu
                value={bcFilter}
                defaultValue="all"
                onChange={setBcFilter}
                options={kind === "sales" ? SALES_BC_FILTERS : PURCHASE_BC_FILTERS}
              />
            ) : (
              <button className={toolbarIconBtn} title="Filter">
                <Funnel />
              </button>
            )}
            {kind === "purchase" ? (
              connected && (
                <button
                  className={`relative ${toolbarIconBtn} ${bcOnly ? "!border-primary/50 !bg-primary/5 !text-primary" : ""}`}
                  onClick={() => setBcOnly((v) => !v)}
                  aria-pressed={bcOnly}
                  title={bcOnly ? "Show all bills" : "Show bills received over Bharat Connect"}
                >
                  <BharatConnectMark size={14} />
                  Bharat Connect
                  {toCreate > 0 && (
                    <span
                      className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white"
                      aria-label={`${toCreate} to create`}
                    >
                      {toCreate}
                    </span>
                  )}
                </button>
              )
            ) : (
              <button className={toolbarIconBtn} onClick={() => setShowDeleted((d) => !d)} title="Show active or deleted">
                <Archive />
                {showDeleted ? "Deleted" : "Active"}
              </button>
            )}
            <button className={toolbarIconBtn} title="Group by">
              <Split />
            </button>
            <button className={toolbarIconBtn} title="Columns">
              <SquareMenu />
            </button>
            <button className={toolbarIconBtn} title="Settings">
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
              <th className={thCls}>{config.singular} Number</th>
              <th className={thCls}>{config.singular} Date</th>
              <th className={`${thCls} w-[22%]`}>{config.counterpartyLabel}</th>
              <th className={thCls}>Amount</th>
              <th className={thCls}>{config.singular} Status</th>
              {connected && <th className={`${thCls} w-44`}>Bharat Connect</th>}
              <th className={`${thCls} w-20`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                config={config}
                connected={connected}
                menuOpen={openMenuId === inv.id}
                onToggleMenu={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                onCloseMenu={() => setOpenMenuId(null)}
                onView={() =>
                  navigate(isIncoming(inv) && inv.bcConfirmationStatus === "pending" ? `/expenses/bills/${inv.id}/create` : `${config.basePath}/${inv.id}`)
                }
                onSend={() => sendInvoiceViaBharatConnect(inv.id)}
                onDelete={(mode) => setToDelete({ inv, mode })}
              />
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={connected ? 8 : 7} className="px-4 py-10 text-center text-xs text-muted-foreground">
                  {showDeleted
                    ? `No deleted ${config.pageTitle.toLowerCase()}.`
                    : showBcView && received.length === 0
                    ? "No bills received over Bharat Connect yet."
                    : rows.length === 0
                    ? `No ${config.pageTitle.toLowerCase()} yet.`
                    : `No ${config.pageTitle.toLowerCase()} found.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex min-h-14 items-center px-5">
          <TablePagination from={1} to={filteredRows.length} total={filteredRows.length} />
        </div>
      </div>

      <CancelDialog
        key={toDelete?.inv.id}
        open={toDelete?.mode === "cancel-delete"}
        onClose={() => setToDelete(null)}
        title="Cancel and delete invoice?"
        description="It's cancelled on Bharat Connect and deleted from LEDGERS. This can't be revoked."
        confirmLabel="Cancel & Delete"
        picks={CANCEL_PICKS}
        onSubmit={async (reason) => {
          if (toDelete) await cancelAndDeleteInvoice(toDelete.inv.id, reason);
        }}
      />
      <Dialog
        open={toDelete?.mode === "delete"}
        onClose={() => setToDelete(null)}
        title={`Delete ${config.singular.toLowerCase()}?`}
        description="This can't be revoked."
        footer={
          <>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Keep {config.singular}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const target = toDelete;
                setToDelete(null);
                if (target) await deleteInvoice(target.inv.id);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground">
          {config.singular} {toDelete?.inv.id} for {toDelete?.inv.counterpartyName} will be removed.
        </p>
      </Dialog>
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
    <button onClick={onClick} className={danger ? `${menuItemCls} !text-destructive [&_svg]:!opacity-100` : menuItemCls}>
      <Icon />
      {label}
    </button>
  );
}

function InvoiceRow({
  invoice,
  config,
  connected,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onView,
  onSend,
  onDelete,
}: {
  invoice: Invoice;
  config: ReturnType<typeof configFor>;
  connected: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onView: () => void;
  onSend: () => void;
  onDelete: (mode: "delete" | "cancel-delete") => void;
}) {
  const navigate = useNavigate();
  const confirmation = confirmationMeta(invoice.bcConfirmationStatus, config.kind);
  const bcComment = latestBcComment(invoice);
  const showRespond = connected && config.kind === "purchase" && invoice.bcConfirmationStatus === "pending";
  const showSend = connected && config.kind === "sales" && invoice.bcSendStatus === "not_sent";
  const showSending = connected && invoice.bcSendStatus === "sending";
  const showRetry = connected && config.kind === "sales" && invoice.bcConfirmationStatus === "failure";
  const counterpartyOnBc = !!invoice.counterpartyB2bId;

  return (
    <tr className={`relative ${trCls}`}>
      <td className={tdCls}>
        <Checkbox aria-label={`Select ${invoice.id}`} />
      </td>
      <td className={`${tdCls} text-xs`}>
        <button onClick={onView} className="text-primary hover:underline">
          {invoice.id}
        </button>
      </td>
      <td className={`${tdCls} text-xs text-foreground`}>{invoice.date}</td>
      <td className={`${tdCls} truncate text-xs`}>
        <button onClick={onView} className="text-primary hover:underline">
          {invoice.counterpartyName}
        </button>
        {invoice.counterpartyEmail && <div className="truncate text-muted-foreground">{invoice.counterpartyEmail}</div>}
      </td>
      <td className={`${tdCls} text-xs tabular-nums text-foreground`}>{inr(invoice.amount)}</td>
      <td className={tdCls}>
        {invoice.deletedAt ? (
          <Badge variant="secondary" title={`Deleted on ${invoice.deletedAt}`}>
            Deleted
          </Badge>
        ) : (
          isIncoming(invoice) ? (
            <Badge variant="secondary" title="Received on Bharat Connect. Not created in LEDGERS yet.">
              Not created
            </Badge>
          ) : (
            <Badge variant={statusVariant(invoice.status)}>{statusLabel(invoice.status)}</Badge>
          )
        )}
      </td>
      {connected && (
        <td className={tdCls}>
          {showSend ? (
            counterpartyOnBc ? (
              <button
                onClick={onSend}
                className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-primary hover:text-primary/80"
              >
                Send via <BharatConnectMark size={12} />
              </button>
            ) : (
              <InviteBcTooltip counterpartyName={invoice.counterpartyName}>
                <span className="flex cursor-not-allowed items-center gap-1 whitespace-nowrap text-xs font-medium text-muted-foreground opacity-50">
                  Send via <BharatConnectMark size={12} className="grayscale" />
                </span>
              </InviteBcTooltip>
            )
          ) : showSending ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircularSpinner size={12} /> Sending…
            </span>
          ) : showRespond ? (
            // Accept / Return / Reject need a comment, so they live on the bill; this opens it.
            <Button variant="outline" size="sm" onClick={onView}>
              Create
            </Button>
          ) : showRetry ? (
            <div className="flex items-center gap-2">
              <Badge variant={confirmation!.variant}>
                {confirmation!.label}
              </Badge>
              <button onClick={onSend} className="text-xs font-medium text-primary hover:text-primary/80">
                Retry
              </button>
            </div>
          ) : confirmation ? (
            // Hover shows the comment that came with the status (e.g. the buyer's reason for a return).
            <span title={bcComment} className="inline-flex items-center gap-1.5">
              <Badge variant={confirmation.variant}>{confirmation.label}</Badge>
              {config.kind === "sales" && invoice.bcConfirmationStatus === "returned" && (
                <button onClick={onView} className="text-xs font-medium text-primary hover:text-primary/80">
                  Review
                </button>
              )}
            </span>
          ) : config.kind === "purchase" ? (
            // A bill entered by hand: it didn't come over Bharat Connect. "Not sent" would be wrong —
            // bills are received, never sent.
            counterpartyOnBc ? (
              <span className="text-xs text-muted-foreground">Not via Bharat Connect</span>
            ) : (
              <InviteBcTooltip
                counterpartyName={invoice.counterpartyName}
                className="relative flex w-15 justify-center"
                message={`${invoice.counterpartyName} hasn't joined Bharat Connect yet. Invite them so their future bills reach you over Bharat Connect.`}
              >
                <span className="cursor-default text-xs text-muted-foreground" aria-label="Not on Bharat Connect">
                  —
                </span>
              </InviteBcTooltip>
            )
          ) : (
            <span className="text-xs text-muted-foreground">Not sent</span>
          )}
        </td>
      )}
      <td className={tdCls}>
        <div className="relative inline-block">
          <button
            onClick={onToggleMenu}
            aria-label="Actions"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
              <div className={`absolute right-0 z-20 mt-1 w-48 space-y-0.5 p-1 ${popoverCls}`}>
                <MenuItem
                  icon={Eye}
                  label="View Details"
                  onClick={() => {
                    onCloseMenu();
                    onView();
                  }}
                />
                {/* Deleted, or raw Bharat Connect data: view only. */}
                {!invoice.deletedAt && !isIncoming(invoice) && <>
                {/* Bharat Connect action sits with the LEDGERS ones, only when it applies. */}
                {(showSend && counterpartyOnBc) || showRetry ? (
                  <MenuItem
                    icon={Send}
                    label={showRetry ? "Retry Bharat Connect" : config.bcSendActionLabel}
                    onClick={() => {
                      onCloseMenu();
                      onSend();
                    }}
                  />
                ) : null}
                {(() => {
                  const rule = editRule(invoice, connected);
                  return rule.mode === "blocked" ? (
                    <span title={rule.reason} className="block">
                      <button disabled className={`${menuItemCls} cursor-not-allowed opacity-50`}>
                        <SquarePen />
                        Edit {config.singular}
                      </button>
                    </span>
                  ) : (
                    <MenuItem
                      icon={SquarePen}
                      label={rule.mode === "resend" ? `Edit & Resend (v${rule.nextVersion})` : `Edit ${config.singular}`}
                      onClick={() => {
                        onCloseMenu();
                        navigate(`${config.basePath}/${invoice.id}/edit`);
                      }}
                    />
                  );
                })()}
                <MenuItem icon={Copy} label={`Copy ${config.singular}`} onClick={onCloseMenu} />
                <MenuItem icon={Printer} label="Print" onClick={onCloseMenu} />
                <MenuItem icon={ArrowDownToLine} label="Download" onClick={onCloseMenu} />
                {(() => {
                  const rule = deleteRule(invoice, connected);
                  return rule?.mode === "blocked" ? (
                    <span title={rule.reason} className="block">
                      <button disabled className={`${menuItemCls} cursor-not-allowed opacity-50`}>
                        <Trash2 />
                        Delete
                      </button>
                    </span>
                  ) : (
                    <MenuItem
                      icon={Trash2}
                      label={rule?.mode === "cancel-delete" ? "Cancel & Delete" : "Delete"}
                      danger
                      onClick={() => {
                        onCloseMenu();
                        onDelete(rule?.mode === "cancel-delete" ? "cancel-delete" : "delete");
                      }}
                    />
                  );
                })()}
                </>}
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
