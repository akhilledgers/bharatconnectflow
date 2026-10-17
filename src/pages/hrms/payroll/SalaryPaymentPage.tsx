import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useHrmsStore } from "../../../store/useHrmsStore";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { Checkbox, FormItem, Input, Label, Select } from "../../../components/ui/input";
import { tableCls, tdCls, thCls, trCls } from "../../../components/ui/table";
import { CURRENT_MONTH, TODAY, compareMonths, fmtDate, fyMonths, num } from "../months";
import { EmptyRow, StatCard, panelCls } from "../shared";

// v4 /hrms/salary-payment?month=OCT&year=2026: Salary Payout / Already Paid / Balance cards, a row per
// employee in that month's run with payment status, and Mark as Paid for the selected rows.

export function SalaryPaymentPage() {
  const [params, setParams] = useSearchParams();
  const month = params.get("month") ?? CURRENT_MONTH;
  const run = useHrmsStore((s) => s.runs[month]);
  const employees = useHrmsStore((s) => s.employees);
  const markPaid = useHrmsStore((s) => s.markPaid);
  const [selected, setSelected] = useState<string[]>([]);
  const [paying, setPaying] = useState(false);
  const months = fyMonths(CURRENT_MONTH).filter((m) => compareMonths(m, CURRENT_MONTH) <= 0);

  const rows = Object.values(run?.records ?? {}).map((r) => {
    const paid = run?.payments[r.employeeId]?.paidAmount ?? 0;
    return { r, e: employees.find((e) => e.id === r.employeeId)!, paid, balance: Math.max(0, r.payout - paid), payment: run?.payments[r.employeeId] };
  });
  const payout = rows.reduce((t, x) => t + x.r.payout, 0);
  const paid = rows.reduce((t, x) => t + x.paid, 0);
  const payable = rows.filter((x) => x.balance > 0).map((x) => x.e.id);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground">Salary Payment</h1>
        <div className="flex gap-2.5">
          <Select wrapperClassName="w-36" value={month} onChange={(e) => (setSelected([]), setParams({ month: e.target.value }))}>
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
          <Button variant="primary" disabled={selected.length === 0} onClick={() => setPaying(true)}>
            Mark as Paid
          </Button>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-3 gap-4">
        <StatCard label="Salary Payout" value={num(payout)} />
        <StatCard label="Already Paid" value={num(paid)} tone="text-green-600" />
        <StatCard label="Balance Amount" value={num(payout - paid)} tone="text-red-600" />
      </div>
      <div className={panelCls}>
        <table className={tableCls}>
          <thead>
            <tr className="bg-muted/40">
              <th className={`${thCls} w-10`}>
                <Checkbox
                  aria-label="Select all"
                  checked={payable.length > 0 && payable.every((id) => selected.includes(id))}
                  onChange={(e) => setSelected(e.target.checked ? payable : [])}
                />
              </th>
              {["Employee Id", "Employee Name", "Salary Payout", "Already Paid", "Balance Amount", "Payment Status", "Payment Date"].map((h) => (
                <th key={h} className={thCls}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, e, paid, balance, payment }) => (
              <tr key={e.id} className={trCls}>
                <td className={tdCls}>
                  <Checkbox
                    disabled={balance === 0}
                    checked={selected.includes(e.id)}
                    onChange={(ev) => setSelected(ev.target.checked ? [...selected, e.id] : selected.filter((x) => x !== e.id))}
                  />
                </td>
                <td className={tdCls}>{e.employeeId}</td>
                <td className={tdCls}>{e.name}</td>
                <td className={tdCls}>{num(r.payout)}</td>
                <td className={tdCls}>{num(paid)}</td>
                <td className={tdCls}>{num(balance)}</td>
                <td className={tdCls}>
                  {r.payout === 0 ? <Badge>Zero Payout</Badge> : balance === 0 ? <Badge variant="success">Paid</Badge> : <Badge variant="warning">{paid > 0 ? "Partly paid" : "Pending"}</Badge>}
                </td>
                <td className={tdCls}>{fmtDate(payment?.paidOn)}</td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={8}>Payroll hasn't been run for {month}.</EmptyRow>}
          </tbody>
        </table>
      </div>
      {paying && (
        <MarkPaidDialog
          count={selected.length}
          onClose={() => setPaying(false)}
          onConfirm={(mode, date) => {
            markPaid(month, selected, mode, date);
            toast.success(`${selected.length} salary payment(s) marked as paid`);
            setSelected([]);
            setPaying(false);
          }}
        />
      )}
    </div>
  );
}

function MarkPaidDialog({ count, onClose, onConfirm }: { count: number; onClose: () => void; onConfirm: (mode: string, date: string) => void }) {
  const [mode, setMode] = useState("Bank Transfer");
  const [date, setDate] = useState(TODAY);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Mark as Paid"
      description={`${count} employee(s)`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(mode, date)}>
            Confirm
          </Button>
        </>
      }
    >
      <FormItem>
        <Label>Payment Mode</Label>
        <Select value={mode} onChange={(e) => setMode(e.target.value)}>
          {["Bank Transfer", "Cheque", "Cash", "UPI"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
      </FormItem>
      <FormItem>
        <Label>Payment Date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </FormItem>
    </Dialog>
  );
}
