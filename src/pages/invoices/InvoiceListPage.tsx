import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Check,
  Copy,
  Download,
  Edit3,
  Eye,
  Filter,
  Layers,
  MoreHorizontal,
  Printer,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { statusLabel, statusPillClass, confirmationMeta } from "../../lib/invoiceStatus";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { ConnectBharatConnectBanner } from "../../components/ConnectBharatConnectCTA";
import { PendingActionsBanner } from "../../components/layout/PendingActionsBanner";
import { InviteBcTooltip } from "../../components/InviteBcTooltip";
import { configFor, sumAmount, sumUnpaid, inr, money } from "./kindConfig";
import type { Invoice } from "../../types";

function StatCard({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="text-sm text-body">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${className}`}>{value}</div>
      <div className="mt-1 text-xs text-faint">01-04-2026 - 31-03-2027</div>
    </div>
  );
}

type BcFilter = "all" | "not_sent" | "awaiting" | "accepted" | "failure" | "pending";

const SALES_BC_FILTERS: { value: BcFilter; label: string }[] = [
  { value: "all", label: "All BharatConnect statuses" },
  { value: "not_sent", label: "Pending to send" },
  { value: "awaiting", label: "Awaiting confirmation" },
  { value: "accepted", label: "Accepted" },
  { value: "failure", label: "Failed" },
];

const PURCHASE_BC_FILTERS: { value: BcFilter; label: string }[] = [
  { value: "all", label: "All BharatConnect statuses" },
  { value: "pending", label: "Pending to accept" },
  { value: "accepted", label: "Accepted" },
  { value: "failure", label: "Failed" },
];

function matchesBcFilter(invoice: Invoice, kind: "sales" | "purchase", filter: BcFilter): boolean {
  if (filter === "all") return true;
  if (kind === "sales") {
    if (filter === "not_sent") return invoice.bcSendStatus === "not_sent";
    if (filter === "awaiting") return invoice.bcSendStatus === "sent" && invoice.bcConfirmationStatus === "pending";
    if (filter === "accepted") return invoice.bcConfirmationStatus === "accepted";
    if (filter === "failure") return invoice.bcConfirmationStatus === "failure";
    return true;
  }
  if (filter === "pending") return invoice.bcConfirmationStatus === "pending";
  if (filter === "accepted") return invoice.bcConfirmationStatus === "accepted";
  if (filter === "failure") return invoice.bcConfirmationStatus === "failure";
  return true;
}

export function InvoiceListPage({ kind }: { kind: "sales" | "purchase" }) {
  const config = configFor(kind);
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const allInvoices = useStore((s) => s.invoices);
  const sendInvoiceViaBharatConnect = useStore((s) => s.sendInvoiceViaBharatConnect);
  const respondToBill = useStore((s) => s.respondToBill);
  const connected = business.connectionState === "connected";
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [bcFilter, setBcFilter] = useState<BcFilter>("all");

  const rows = allInvoices.filter((i) => i.kind === kind);
  const filteredRows = connected ? rows.filter((i) => matchesBcFilter(i, kind, bcFilter)) : rows;
  const total = sumAmount(rows);
  const outstanding = sumUnpaid(rows);

  const stats = [
    { label: config.statCardLabels[0], value: inr(total), className: "text-emerald-600" },
    { label: config.statCardLabels[1], value: inr(outstanding), className: "text-amber-600" },
    { label: config.statCardLabels[2], value: inr(Math.round(outstanding * 0.79)), className: "text-red-600" },
    { label: config.statCardLabels[3], value: "INR 0.00", className: "text-purple-600" },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">{config.pageTitle}</h1>
        <button
          onClick={() => navigate(`${config.basePath}/create`)}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-gray-50"
        >
          <span className="text-base leading-none">+</span>
          {config.createLabel}
        </button>
      </div>

      {!connected && <ConnectBharatConnectBanner />}
      {connected && (
        <PendingActionsBanner kind={kind} onReview={() => setBcFilter(kind === "sales" ? "not_sent" : "pending")} />
      )}

      <div className="mb-6 grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <input
            placeholder={`Search ${config.singular}...`}
            className="w-72 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-faint hover:bg-gray-50">
              <Calendar className="h-4 w-4" />
              Select Date range
            </button>
            {connected && (
              <div className="relative">
                <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
                <select
                  value={bcFilter}
                  onChange={(e) => setBcFilter(e.target.value as BcFilter)}
                  className="appearance-none rounded-lg border border-gray-200 py-2 pl-8 pr-7 text-sm text-body hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {(kind === "sales" ? SALES_BC_FILTERS : PURCHASE_BC_FILTERS).map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button className="rounded-lg border border-gray-200 p-2 text-faint hover:bg-gray-50">
              <Layers className="h-4 w-4" />
            </button>
            <button className="rounded-lg border border-gray-200 p-2 text-faint hover:bg-gray-50">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-body">
              <th className="w-10 px-4 py-3">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
              </th>
              <th className="px-2 py-3 font-medium">{config.singular} Number</th>
              <th className="px-2 py-3 font-medium">{config.singular} Date</th>
              <th className="px-2 py-3 font-medium">{config.counterpartyLabel}</th>
              <th className="px-2 py-3 text-right font-medium">Amount</th>
              <th className="px-2 py-3 font-medium">{config.singular} Status</th>
              {connected && <th className="px-2 py-3 font-medium">BharatConnect</th>}
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                config={config}
                connected={connected}
                menuOpen={openMenuId === inv.id}
                onToggleMenu={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                onCloseMenu={() => setOpenMenuId(null)}
                onView={() => navigate(`${config.basePath}/${inv.id}`)}
                onSend={() => sendInvoiceViaBharatConnect(inv.id)}
                onAccept={() => respondToBill(inv.id, "accept")}
                onReject={() => respondToBill(inv.id, "reject")}
              />
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={connected ? 8 : 7} className="px-4 py-10 text-center text-faint">
                  {rows.length === 0
                    ? `No ${config.pageTitle.toLowerCase()} yet.`
                    : `No ${config.pageTitle.toLowerCase()} match this BharatConnect filter.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-faint">
          <span>
            Showing Records 1 to {filteredRows.length} of {filteredRows.length} total records
          </span>
          <div className="flex gap-2">
            <button className="rounded-md border border-gray-200 px-3 py-1.5 text-body hover:bg-gray-50" disabled>
              Previous
            </button>
            <button className="rounded-md border border-gray-200 px-3 py-1.5 text-body hover:bg-gray-50" disabled>
              Next
            </button>
          </div>
        </div>
      </div>
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
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50 ${
        danger ? "text-red-600" : "text-ink"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
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
  onAccept,
  onReject,
}: {
  invoice: Invoice;
  config: ReturnType<typeof configFor>;
  connected: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onView: () => void;
  onSend: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const confirmation = confirmationMeta(invoice.bcConfirmationStatus);
  const showAcceptReject = connected && config.kind === "purchase" && invoice.bcConfirmationStatus === "pending";
  const showSend = connected && config.kind === "sales" && invoice.bcSendStatus === "not_sent";
  const showSending = connected && invoice.bcSendStatus === "sending";
  const showRetry = connected && config.kind === "sales" && invoice.bcConfirmationStatus === "failure";
  const counterpartyOnBc = !!invoice.counterpartyB2bId;

  return (
    <tr className="relative hover:bg-gray-50/60">
      <td className="px-4 py-4">
        <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
      </td>
      <td className="px-2 py-4">
        <button onClick={onView} className="font-medium text-blue-600 hover:underline">
          {invoice.id}
        </button>
      </td>
      <td className="px-2 py-4 text-body">{invoice.date}</td>
      <td className="px-2 py-4">
        <button onClick={onView} className="text-blue-600 hover:underline">
          {invoice.counterpartyName}
        </button>
        {invoice.counterpartyEmail && <div className="text-xs text-faint">{invoice.counterpartyEmail}</div>}
      </td>
      <td className="px-2 py-4 text-right text-ink">{money(invoice.amount)}</td>
      <td className="px-2 py-4">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusPillClass(invoice.status)}`}>
          {statusLabel(invoice.status)}
        </span>
      </td>
      {connected && (
        <td className="px-2 py-4">
          {showSend ? (
            counterpartyOnBc ? (
              <button
                onClick={onSend}
                className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-primary hover:text-primary-hover"
              >
                Send via <BharatConnectMark size={12} />
              </button>
            ) : (
              <InviteBcTooltip counterpartyName={invoice.counterpartyName}>
                <span className="flex cursor-not-allowed items-center gap-1 whitespace-nowrap text-xs font-medium text-faint opacity-50">
                  Send via <BharatConnectMark size={12} className="grayscale" />
                </span>
              </InviteBcTooltip>
            )
          ) : showSending ? (
            <span className="flex items-center gap-2 text-xs text-faint">
              <CircularSpinner size={12} /> Sending…
            </span>
          ) : showAcceptReject ? (
            <div className="flex gap-1.5">
              <button
                onClick={onAccept}
                title="Accept"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </button>
              <button
                onClick={onReject}
                title="Reject"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100"
              >
                <X className="h-3 w-3" strokeWidth={3} />
              </button>
            </div>
          ) : showRetry ? (
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confirmation!.className}`}>
                {confirmation!.label}
              </span>
              <button onClick={onSend} className="text-xs font-medium text-primary hover:text-primary-hover">
                Retry
              </button>
            </div>
          ) : confirmation ? (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confirmation.className}`}>
              {confirmation.label}
            </span>
          ) : (
            <span className="text-xs text-faint">Not sent</span>
          )}
        </td>
      )}
      <td className="px-4 py-4 text-right">
        <div className="relative inline-block">
          <button
            onClick={onToggleMenu}
            className="flex h-7 w-7 items-center justify-center rounded-full text-faint hover:bg-gray-100 hover:text-body"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
              <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg">
                <MenuItem
                  icon={Eye}
                  label="View Details"
                  onClick={() => {
                    onCloseMenu();
                    onView();
                  }}
                />
                <MenuItem icon={Check} label="Mark as paid" onClick={onCloseMenu} />
                <MenuItem icon={Edit3} label="Edit invoice" onClick={onCloseMenu} />
                <MenuItem icon={Copy} label="Copy invoice" onClick={onCloseMenu} />
                <MenuItem icon={Printer} label="Print" onClick={onCloseMenu} />
                <MenuItem icon={Download} label="Download" onClick={onCloseMenu} />
                <div className="my-1 border-t border-gray-100" />
                <MenuItem icon={Trash2} label="Delete" danger onClick={onCloseMenu} />
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
