import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { useHrmsStore } from "../../store/useHrmsStore";
import { Dialog } from "../../components/ui/dialog";
import { tableCls, tdCls, thCls, trCls } from "../../components/ui/table";
import { compareMonths, inr, num, spacedMonth } from "./months";
import { EmptyRow } from "./shared";
import type { Employee, PayRecord } from "./types";

// v4 Payslip tab: one row per payroll-run month (Month, CTC, Payable Days, Gross, PF, ESI, Other
// Deduction, Netpay). Clicking a month opens "Salary Details for the month of …".

export function PayslipTab({ employee }: { employee: Employee }) {
  const runs = useHrmsStore((s) => s.runs);
  const [open, setOpen] = useState<PayRecord | null>(null);
  const records = Object.values(runs)
    .map((r) => r.records[employee.id])
    .filter(Boolean)
    .sort((a, b) => compareMonths(b.month, a.month));

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className={tableCls}>
          <thead>
            <tr className="bg-muted/40">
              {["Month", "CTC", "Payable Days", "Gross", "PF", "ESI", "Other Deduction", "Netpay"].map((h) => (
                <th key={h} className={thCls}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.month} className={trCls}>
                <td className={tdCls}>
                  <button className="cursor-pointer text-primary hover:underline" onClick={() => setOpen(r)}>
                    {spacedMonth(r.month)}
                  </button>
                </td>
                <td className={tdCls}>{inr(r.ctc)}</td>
                <td className={tdCls}>{r.payableDays}</td>
                <td className={tdCls}>{inr(r.grossEarned)}</td>
                <td className={tdCls}>{inr(r.employeePf)}</td>
                <td className={tdCls}>{inr(r.employeeEsi)}</td>
                <td className={tdCls}>{inr(r.pt + r.tds + r.deductions.reduce((t, d) => t + d.amount, 0))}</td>
                <td className={`${tdCls} font-medium text-green-600`}>{inr(r.payout)}</td>
              </tr>
            ))}
            {records.length === 0 && <EmptyRow colSpan={8}>No payslips yet — payroll hasn't been run for this employee.</EmptyRow>}
          </tbody>
        </table>
      </div>
      {open && <PayslipDialog record={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export function PayslipDialog({ record, onClose }: { record: PayRecord; onClose: () => void }) {
  const all: [string, number][] = [
    ["Employee PF", record.employeePf],
    ["Employee ESI", record.employeeEsi],
    ["Professional Tax", record.pt],
    ["TDS", record.tds],
    ...record.deductions.map((d): [string, number] => [d.name, d.amount]),
  ];
  const deductions = all.filter(([, v]) => v > 0);
  const totalDeductions = deductions.reduce((t, [, v]) => t + v, 0);

  return (
    <Dialog
      open
      onClose={onClose}
      className="max-w-xl"
      title={
        <span className="flex items-center gap-2 text-base">
          Salary Details for the month of {spacedMonth(record.month)}
          <button className="cursor-pointer opacity-60 hover:opacity-100" title="Download payslip" onClick={() => toast.success("Payslip PDF downloaded")}>
            <Download className="size-4" />
          </button>
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <Figure label="Payout" value={`Rs. ${num(record.payout)}`} tone="text-green-600" />
        <Figure label="Earnings" value={`Rs. ${num(record.grossEarned)}`} tone="text-blue-600" />
        <Figure label="Deductions" value={`Rs. ${num(totalDeductions)}`} tone="text-red-600" />
      </div>
      <table className={tableCls}>
        <thead>
          <tr>
            <th className={thCls}>Salary Components</th>
            <th className={thCls}>Monthly CTC</th>
            <th className={`${thCls} text-right`}>Earnings for this month</th>
          </tr>
        </thead>
        <tbody>
          {record.earnings.map((e) => (
            <tr key={e.key}>
              <td className={`${tdCls} font-medium`}>{e.name}</td>
              <td className={tdCls}>{num(e.monthly)}</td>
              <td className={`${tdCls} text-right`}>{num(e.earned)}</td>
            </tr>
          ))}
          {record.benefits.map((b) => (
            <tr key={b.name}>
              <td className={`${tdCls} font-medium`}>{b.name}</td>
              <td className={tdCls}>-</td>
              <td className={`${tdCls} text-right`}>{num(b.amount)}</td>
            </tr>
          ))}
          <tr>
            <td className={`${tdCls} font-semibold`}>Total Earnings</td>
            <td className={`${tdCls} font-semibold`}>{num(record.grossMonthly)}</td>
            <td className={`${tdCls} text-right font-semibold`}>{num(record.grossEarned)}</td>
          </tr>
        </tbody>
      </table>
      <div>
        <div className="mb-1 text-sm font-semibold">Deductions</div>
        <table className={tableCls}>
          <tbody>
            {deductions.map(([k, v]) => (
              <tr key={k}>
                <td className={tdCls}>{k}</td>
                <td className={`${tdCls} text-right`}>{num(v)}</td>
              </tr>
            ))}
            <tr>
              <td className={`${tdCls} font-semibold`}>Total Deductions</td>
              <td className={`${tdCls} text-right font-semibold text-red-600`}>{num(totalDeductions)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {record.segments && record.employeePf > 0 && (
        <div>
          <div className="mb-1 text-sm font-semibold">Provident Fund by period</div>
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={thCls}>Period</th>
                <th className={thCls}>Ceiling</th>
                <th className={thCls}>Payable days</th>
                <th className={`${thCls} text-right`}>PF wage</th>
                <th className={`${thCls} text-right`}>Employee PF</th>
              </tr>
            </thead>
            <tbody>
              {record.segments.map((s) => (
                <tr key={s.label}>
                  <td className={tdCls}>{s.label}</td>
                  <td className={tdCls}>{s.coveredDays ? `₹${num(s.ceiling)}` : "Not covered"}</td>
                  <td className={tdCls}>{Number.isInteger(s.payableDays) ? s.payableDays : s.payableDays.toFixed(2)}</td>
                  <td className={`${tdCls} text-right`}>{num(s.pfWage)}</td>
                  <td className={`${tdCls} text-right`}>{(s.pfWage * 0.12).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-muted-foreground">PF wage ceiling revised to ₹25,000 from 17 Sep 2026. Rounded once on the total.</p>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-border pt-4 text-base font-semibold">
        <span>Netpay</span>
        <span className="text-green-600">{num(record.payout)}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Payable days {Number.isInteger(record.payableDays) ? record.payableDays : record.payableDays.toFixed(2)} of {record.daysInMonth} · Employer PF {num(record.employerPf)} (EPS{" "}
        {num(record.eps)} · EPF {num(record.employerEpf)}) · EDLI {num(record.edli)}
        {record.employerEsi > 0 && ` · Employer ESI ${num(record.employerEsi)}`}
        {record.employerAdjustments?.map((a) => ` · ${a.name} ${num(a.amount)}`)}
      </div>
    </Dialog>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-base font-semibold ${tone}`}>{value}</div>
    </div>
  );
}
