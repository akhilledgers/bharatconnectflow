import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownToLine, CalendarDays, Eye, IndianRupee, MoreHorizontal, Plus, Printer, Search, SquarePen, Trash2, X } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox, Input } from "../../components/ui/input";
import { menuItemCls, popoverCls } from "../../components/ui/popover";
import { tableCls, tdCls, thCls, trCls, TablePagination } from "../../components/ui/table";
import { useBankingStore } from "../../store/useBankingStore";
import { paymentLabel, useDocPaid, useDocPayment, usePayDocs } from "../banking/PayDocs";
import { inr } from "../invoices/kindConfig";
import { EXPENSE_VOUCHERS, voucherDoc, voucherTotal, type ExpenseVoucher } from "./vouchers";

const BASE = "/expenses/vouchers";

// As on LEDGERS' Expense Voucher list (Number, Payment Date, Name, Total Amount, Payment, Status), plus paying
// unpaid vouchers straight from a connected bank: per row, or several at once from the selection bar.
export function ExpenseVoucherListPage() {
  const navigate = useNavigate();
  const payDocs = usePayDocs();
  const payouts = useBankingStore((s) => s.payouts);
  // Payments recorded on a voucher by hand (paid from cash, a card, a director…).
  const recorded = useBankingStore((s) => s.docPayments);
  const docOf = (v: ExpenseVoucher) => voucherDoc(v, recorded);
  const [selected, setSelected] = useState<string[]>([]);
  const [menu, setMenu] = useState<string | null>(null);

  const rows = EXPENSE_VOUCHERS;
  const inPayment = (v: ExpenseVoucher) => payouts.some((p) => p.docs?.includes(v.number) && ["awaiting", "processing", "paid"].includes(p.status));
  const selectedRows = rows.filter((v) => selected.includes(v.number));
  const toPay = selectedRows.filter((v) => docOf(v).due > 0 && !inPayment(v));
  const allSelected = rows.every((v) => selected.includes(v.number));
  const toggle = (n: string) => setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground">Expense Vouchers</h1>
        <Button variant="outline">
          <Plus />
          Create Expense Voucher
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs shadow-black/5">
        {selectedRows.length > 0 ? (
          <div className="flex h-14 items-center justify-between gap-3 bg-muted/40 px-5">
            <div className="flex items-center gap-2 text-2sm">
              <button onClick={() => setSelected([])} aria-label="Clear selection" className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="size-4" />
              </button>
              <span className="font-medium">{selectedRows.length} selected</span>
              {toPay.length > 0 && toPay.length !== selectedRows.length && <span className="text-muted-foreground">· {toPay.length} to pay</span>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <ArrowDownToLine />
                Download
              </Button>
              <Button variant="outline" size="sm">
                <Printer />
                Print
              </Button>
              <Button variant="outline" size="sm">
                <Trash2 />
                Delete
              </Button>
              {payDocs.canPay && (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!toPay.length}
                  title={toPay.length ? undefined : "These are already paid"}
                  onClick={() => {
                    payDocs.pay(toPay.map(docOf));
                    setSelected([]);
                  }}
                >
                  <IndianRupee />
                  {toPay.length ? `Pay ${inr(toPay.reduce((s, v) => s + docOf(v).due, 0))}` : "Pay"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search Expense Voucher..." className="ps-9" />
            </div>
            <button className="inline-flex h-8.5 w-56 items-center gap-2 rounded-md border border-input bg-background px-3 text-2sm text-muted-foreground/80 shadow-xs shadow-black/5">
              <CalendarDays className="size-4 text-muted-foreground" />
              Select Date range
            </button>
          </div>
        )}

        <table className={`${tableCls} table-fixed`}>
          <thead className="bg-muted/40">
            <tr>
              <th className={`${thCls} w-12`}>
                <Checkbox aria-label="Select all" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((v) => v.number))} />
              </th>
              <th className={thCls}>Number</th>
              <th className={thCls}>Payment Date</th>
              <th className={`${thCls} w-[24%]`}>Name</th>
              <th className={thCls}>Total Amount</th>
              <th className={thCls}>Payment</th>
              <th className={thCls}>Status</th>
              <th className={`${thCls} w-28`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <VoucherRow
                key={v.number}
                voucher={v}
                selected={selected.includes(v.number)}
                onSelect={() => toggle(v.number)}
                onView={() => navigate(`${BASE}/${v.number}`)}
                due={docOf(v).due}
                paidFrom={recorded.filter((p) => p.doc === v.number).at(-1)?.accountLabel}
                onPay={payDocs.canPay && docOf(v).due > 0 ? () => payDocs.pay([docOf(v)]) : undefined}
                menuOpen={menu === v.number}
                onMenu={(open) => setMenu(open ? v.number : null)}
              />
            ))}
          </tbody>
        </table>
        <div className="flex min-h-14 items-center px-5">
          <TablePagination from={1} to={rows.length} total={rows.length} />
        </div>
      </div>
      {payDocs.drawers}
    </div>
  );
}

function VoucherRow({
  voucher: v,
  selected,
  onSelect,
  onView,
  due,
  paidFrom,
  onPay,
  menuOpen,
  onMenu,
}: {
  voucher: ExpenseVoucher;
  /** Still owed, after payments recorded on it. */
  due: number;
  /** Where the last payment recorded on it came from. */
  paidFrom?: string;
  selected: boolean;
  onSelect: () => void;
  onView: () => void;
  onPay?: () => void;
  menuOpen: boolean;
  onMenu: (open: boolean) => void;
}) {
  const payment = useDocPayment(v.number);
  const paidHere = useDocPaid(v.number);
  const paid = !!v.paidBy || paidHere || due <= 0;
  const part = !paid && due < voucherTotal(v);
  const canPay = onPay && !payment && !paid;
  const item = (Icon: typeof Eye, label: string, run?: () => void) => (
    <button
      onClick={() => {
        onMenu(false);
        run?.();
      }}
      className={menuItemCls}
    >
      <Icon />
      {label}
    </button>
  );
  return (
    <tr className={trCls}>
      <td className={tdCls}>
        <Checkbox aria-label={`Select ${v.number}`} checked={selected} onChange={onSelect} />
      </td>
      <td className={`${tdCls} text-xs`}>
        <button onClick={onView} className="text-primary hover:underline">
          {v.number}
        </button>
      </td>
      <td className={`${tdCls} text-xs`}>{v.date}</td>
      <td className={`${tdCls} truncate text-xs`}>
        <button onClick={onView} className="text-primary hover:underline">
          {v.party}
        </button>
      </td>
      <td className={`${tdCls} text-xs tabular-nums`}>{inr(voucherTotal(v))}</td>
      <td className={`${tdCls} text-xs text-muted-foreground`}>{v.paidBy ?? (payment ? "Bank" : (paidFrom ?? "—"))}</td>
      <td className={tdCls}>
        <Badge variant={paid ? "success" : part ? "warning" : "destructive"}>{paid ? "Paid" : part ? "Part Paid" : "Not Paid"}</Badge>
        {payment && !paid && <div className="mt-1 text-xs text-muted-foreground">{paymentLabel(payment)}</div>}
      </td>
      <td className={tdCls}>
        <div className="relative flex items-center gap-1">
          {canPay && (
            <Button variant="outline" size="sm" onClick={onPay}>
              Pay
            </Button>
          )}
          <button
            onClick={() => onMenu(!menuOpen)}
            aria-label="Actions"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => onMenu(false)} />
              <div className={`absolute right-0 top-full z-20 mt-1 w-44 space-y-0.5 p-1 ${popoverCls}`}>
                {item(Eye, "View Details", onView)}
                {canPay && item(IndianRupee, "Pay from bank", onPay)}
                {item(SquarePen, "Edit")}
                {item(Printer, "Print")}
                {item(ArrowDownToLine, "Download")}
                {item(Trash2, "Delete")}
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
