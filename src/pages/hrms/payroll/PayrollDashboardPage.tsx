import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator, CheckCircle2, FileSpreadsheet, XCircle } from "lucide-react";
import { reviewMonth, useHrmsStore } from "../../../store/useHrmsStore";
import { Button } from "../../../components/ui/button";
import { Tabs } from "../../../components/ui/tabs";
import { tableCls, tdCls, thCls, trCls } from "../../../components/ui/table";
import { CURRENT_MONTH, compareMonths, fyLabel, fyMonths, lakhs, num } from "../months";
import { REVISION_MONTH, latestSalary } from "../payroll";
import { SeptemberReminder } from "./SeptemberRun";
import { RevisionCard } from "./RevisionCard";
import { septemberStatus } from "../revision";
import { StatCard, panelCls } from "../shared";
import type { PayRecord } from "../types";

// v4 /hrms/payroll-dashboard: FY cards, Salary / Compliance chart, HR Compliance for the current
// month, Tax Calc / Tax Sheets, "N Employees without salary", and the month table. The current month
// shows RUN / RERUN PAYROLL; past months show their overall net pay (→ Monthly Pay Report).

function sum(records: PayRecord[], f: (r: PayRecord) => number) {
  return records.reduce((t, r) => t + f(r), 0);
}

export function PayrollDashboardPage() {
  const navigate = useNavigate();
  const state = useHrmsStore();
  const [chart, setChart] = useState<"salary" | "compliance">("salary");
  const sepRun = state.runs[REVISION_MONTH];
  const months = fyMonths(CURRENT_MONTH).filter((m) => compareMonths(m, CURRENT_MONTH) <= 0);
  const byMonth = months.map((m) => ({ month: m, records: Object.values(state.runs[m]?.records ?? {}) }));
  const runMonths = byMonth.filter((m) => m.records.length > 0);
  const all = runMonths.flatMap((m) => m.records);
  const gross = sum(all, (r) => r.grossEarned);
  const net = sum(all, (r) => r.payout);
  const tds = sum(all, (r) => r.tds);
  const active = state.employees.filter((e) => e.status === "active");
  const noSalary = active.filter((e) => !latestSalary(state.salaries, e.id)).length;
  const current = reviewMonth(state, CURRENT_MONTH).filter((r) => r.record);
  const applicable = {
    TDS: current.some((r) => r.record!.tds > 0),
    ESI: current.some((r) => r.record!.employeeEsi > 0),
    EPF: current.some((r) => r.record!.employeePf > 0),
    PT: current.some((r) => r.record!.pt > 0),
  };

  const bars = byMonth.map((m) => ({
    month: m.month,
    a: chart === "salary" ? sum(m.records, (r) => r.grossEarned) : sum(m.records, (r) => r.employeePf + r.employerPf),
    b: chart === "salary" ? sum(m.records, (r) => r.payout) : sum(m.records, (r) => r.employeeEsi + r.employerEsi),
    c: chart === "salary" ? sum(m.records, (r) => r.grossEarned - r.payout) : sum(m.records, (r) => r.tds + r.pt),
  }));
  const max = Math.max(1, ...bars.flatMap((b) => [b.a, b.b, b.c]));
  const legend = chart === "salary" ? ["Gross Pay", "Net Pay", "Deductions"] : ["PF", "ESI", "TDS + PT"];
  const tableMonths = [...months].reverse().filter((m) => m === CURRENT_MONTH || state.runs[m]);

  return (
    <div>
      <h1 className="mb-5 text-xl font-medium text-foreground">Payroll Dashboard</h1>
      {septemberStatus(sepRun, state.sepCorrection) === "old" && !state.sepReminderDismissed && (
        <div className="mb-5">
          <SeptemberReminder onDismiss={state.dismissSepReminder} onOpen={() => navigate(`/hrms/payroll/computation?month=${REVISION_MONTH}`)} />
        </div>
      )}
      <RevisionCard />
      <div className="mb-5 grid grid-cols-4 gap-4">
        <StatCard label="Total Gross Pipeline" value={lakhs(gross)} hint="FY total" tone="text-blue-600" />
        <StatCard label="Average Monthly Net" value={lakhs(runMonths.length ? net / runMonths.length : 0)} hint="FY average" tone="text-violet-600" />
        <StatCard label="Annual TDS Reserve" value={lakhs(tds)} hint="FY total" tone="text-green-600" />
        <StatCard label="Headcount Growth" value={active.length} hint="Total / new" tone="text-red-600" />
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className={`${panelCls} col-span-2 p-4`}>
          <Tabs<"salary" | "compliance">
            value={chart}
            onChange={setChart}
            items={[
              { value: "salary", label: "Salary" },
              { value: "compliance", label: "Compliance" },
            ]}
          />
          <div className="mt-4 flex h-52 items-end gap-3 border-b border-border px-2">
            {bars.map((b) => (
              <div key={b.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-44 items-end gap-0.5">
                  {[
                    [b.a, "bg-blue-500"],
                    [b.b, "bg-emerald-500"],
                    [b.c, "bg-red-500"],
                  ].map(([v, cls], i) => (
                    <div key={i} title={`${legend[i]}: ₹${num(v as number)}`} className={`w-2.5 rounded-t ${cls}`} style={{ height: `${Math.max(2, ((v as number) / max) * 176)}px` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-3 px-2">
            {bars.map((b) => (
              <div key={b.month} className="flex-1 text-center text-[10px] text-muted-foreground">
                {b.month.replace("-", " ")}
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-center gap-5 text-xs">
            {legend.map((l, i) => (
              <span key={l} className="inline-flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${["bg-blue-500", "bg-emerald-500", "bg-red-500"][i]}`} /> {l}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${panelCls} p-4`}>
            <div className="text-sm font-semibold">HR Compliance</div>
            <div className="mb-3 text-xs text-muted-foreground">{CURRENT_MONTH}</div>
            {Object.entries(applicable).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-t border-border py-2 text-sm">
                <span>{k}</span>
                <span className={`inline-flex items-center gap-1 text-xs ${v ? "text-green-600" : "text-amber-600"}`}>
                  {v ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  {v ? "Applicable" : "Not Applicable"}
                </span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button className={`${panelCls} flex cursor-pointer flex-col items-center gap-1.5 p-4 text-xs font-medium hover:bg-muted/40`} onClick={() => navigate("/hrms/tax-declaration")}>
              <Calculator className="size-5 text-blue-600" /> TAX CALC
            </button>
            <button className={`${panelCls} flex cursor-pointer flex-col items-center gap-1.5 p-4 text-xs font-medium hover:bg-muted/40`} onClick={() => navigate("/hrms/reports/pf")}>
              <FileSpreadsheet className="size-5 text-violet-600" /> TAX SHEETS
            </button>
          </div>
        </div>
      </div>

      <div className={panelCls}>
        <div className="flex min-h-14 items-center justify-between border-b border-border px-5">
          <span className="rounded-md border border-input px-3 py-1.5 text-sm">{fyLabel(CURRENT_MONTH)}</span>
          {noSalary > 0 && (
            <button onClick={() => navigate("/hrms/employees")} className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs text-red-600">
              <span className="rounded-full bg-red-500 px-1.5 text-white">{noSalary}</span> Employees without salary
            </button>
          )}
        </div>
        <table className={tableCls}>
          <thead>
            <tr className="bg-muted/40">
              {["Month", "Headcount", "Gross (₹)", "PF", "ESI", "TDS", "PT", "Overall Netpay"].map((h) => (
                <th key={h} className={thCls}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableMonths.map((m) => {
              const recs = Object.values(state.runs[m]?.records ?? {});
              const isCurrent = m === CURRENT_MONTH;
              return (
                <tr key={m} className={trCls}>
                  <td className={tdCls}>
                    <button className="cursor-pointer font-medium text-primary hover:underline" onClick={() => navigate(`/hrms/payroll/computation?month=${m}`)}>
                      {m}
                    </button>
                  </td>
                  <td className={tdCls}>
                    <div className="font-medium">{recs.length}</div>
                    <div className="text-xs text-muted-foreground">Employees</div>
                  </td>
                  <td className={tdCls}>{num(sum(recs, (r) => r.grossEarned))}</td>
                  <td className={tdCls}>{num(sum(recs, (r) => r.employerPf))}</td>
                  <td className={tdCls}>{num(sum(recs, (r) => r.employerEsi))}</td>
                  <td className={tdCls}>{num(sum(recs, (r) => r.tds))}</td>
                  <td className={tdCls}>{num(sum(recs, (r) => r.pt))}</td>
                  <td className={tdCls}>
                    {isCurrent ? (
                      <Button size="sm" variant="primary" onClick={() => navigate(`/hrms/payroll/computation?month=${m}`)}>
                        {recs.length ? "RERUN PAYROLL" : "RUN PAYROLL"}
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => navigate(`/hrms/reports/monthly-pay?month=${m}`)}>
                        INR {num(sum(recs, (r) => r.payout))}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
