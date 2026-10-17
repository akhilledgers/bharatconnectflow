import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Download, Search } from "lucide-react";
import { useHrmsStore } from "../../../store/useHrmsStore";
import { Button } from "../../../components/ui/button";
import { Input, Select } from "../../../components/ui/input";
import { Tabs } from "../../../components/ui/tabs";
import { tableCls, tdCls, thCls, trCls } from "../../../components/ui/table";
import { CURRENT_MONTH, compareMonths, fyMonths, num } from "../months";
import { EmptyRow, panelCls } from "../shared";
import type { Employee, PayRecord } from "../types";

// v4 Reports → Payroll: Monthly Pay Report (/reports/monthly-pay-report) and PF Report
// (/reports/pf-report — UAN, gross / EPF / EPS / EDLI wages, employee & employer PF, remitted; the
// source for the ECR file). "Export as Excel" downloads a CSV here.

type Report = "monthly-pay" | "pf" | "salary-register" | "pf-difference";

interface Col {
  h: string;
  v: (r: PayRecord, e: Employee, branch: string) => string | number;
}

const COLUMNS: Record<Exclude<Report, "pf-difference">, Col[]> = {
  "monthly-pay": [
    { h: "Employee ID", v: (_, e) => e.employeeId },
    { h: "Employee Name", v: (_, e) => e.name },
    { h: "Designation", v: (_, e) => e.designation ?? "NA" },
    { h: "Branch", v: (_, __, b) => b || "NA" },
    { h: "CTC", v: (r) => r.ctc },
    { h: "Salary Payout", v: (r) => r.payout },
    { h: "TDS", v: (r) => r.tds },
    { h: "Other Deduction", v: (r) => r.pt + r.deductions.reduce((t, d) => t + d.amount, 0) },
  ],
  pf: [
    { h: "UAN", v: (_, e) => e.uan ?? "Missing" },
    { h: "Employee ID", v: (_, e) => e.employeeId },
    { h: "Employee Name", v: (_, e) => e.name },
    { h: "Gross Wages", v: (r) => r.grossEarned },
    { h: "EPF Wages", v: (r) => r.pfWage },
    { h: "EPS Wages", v: (r) => r.epsWage },
    { h: "EDLI Wages", v: (r) => r.edliWage },
    { h: "Employee PF", v: (r) => r.employeePf },
    { h: "Employer PF", v: (r) => r.employerPf },
    // ECR splits employer PF into EPS (pension) and the EPF difference.
    { h: "EPS", v: (r) => r.eps ?? 0 },
    { h: "Employer EPF", v: (r) => r.employerEpf ?? r.employerPf },
    { h: "EDLI", v: (r) => r.edli ?? 0 },
    { h: "EPF Contri Remitted", v: (r) => r.employeePf },
  ],
  "salary-register": [
    { h: "Employee ID", v: (_, e) => e.employeeId },
    { h: "Employee Name", v: (_, e) => e.name },
    { h: "Payable Days", v: (r) => r.payableDays },
    { h: "Basic", v: (r) => r.earnings.find((x) => x.key === "basic")?.earned ?? 0 },
    { h: "HRA", v: (r) => r.earnings.find((x) => x.key === "hra")?.earned ?? 0 },
    { h: "Other Earnings", v: (r) => r.grossEarned - (r.earnings.find((x) => x.key === "basic")?.earned ?? 0) - (r.earnings.find((x) => x.key === "hra")?.earned ?? 0) },
    { h: "Gross", v: (r) => r.grossEarned },
    { h: "Employee PF", v: (r) => r.employeePf },
    { h: "Employee ESI", v: (r) => r.employeeEsi },
    { h: "PT", v: (r) => r.pt },
    { h: "TDS", v: (r) => r.tds },
    { h: "Net Pay", v: (r) => r.payout },
    { h: "Employer PF", v: (r) => r.employerPf },
    { h: "Employer ESI", v: (r) => r.employerEsi },
  ],
};

const TITLES: Record<Report, string> = { "pf-difference": "PF difference", "monthly-pay": "Monthly Pay Report", pf: "PF Report", "salary-register": "Salary Register" };

export function PayrollReportsPage() {
  const { report = "monthly-pay" } = useParams<{ report: Report }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const month = params.get("month") ?? CURRENT_MONTH;
  const run = useHrmsStore((s) => s.runs[month]);
  const employees = useHrmsStore((s) => s.employees);
  const branches = useHrmsStore((s) => s.branches);
  const [search, setSearch] = useState("");
  const months = fyMonths(CURRENT_MONTH).filter((m) => compareMonths(m, CURRENT_MONTH) <= 0);
  const cols = COLUMNS[report as Exclude<Report, "pf-difference">] ?? COLUMNS["monthly-pay"];

  const rows = Object.values(run?.records ?? {})
    .filter((r) => report !== "pf" || r.employeePf > 0)
    .map((r) => {
      const e = employees.find((x) => x.id === r.employeeId)!;
      return { r, e, b: branches.find((x) => x.id === e.branchId)?.name ?? "" };
    })
    .filter(({ e }) => !search || e.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.e.name.localeCompare(b.e.name));

  // The PF report feeds the ECR: an employee without a UAN can't be filed, so they stay out of the export.
  const noUan = report === "pf" ? rows.filter(({ e }) => !e.uan).length : 0;
  const exportCsv = () => {
    const out = report === "pf" ? rows.filter(({ e }) => e.uan) : rows;
    const lines = [cols.map((c) => c.h), ...out.map(({ r, e, b }) => cols.map((c) => String(c.v(r, e, b))))];
    const blob = new Blob([lines.map((l) => l.map((x) => `"${x.replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${TITLES[report as Report].replace(/ /g, "-")}-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <Tabs<Report>
        variant="pill"
        className="mb-4"
        value={report as Report}
        onChange={(r) => navigate(`/hrms/reports/${r}?month=${month}`)}
        items={[
          { value: "monthly-pay", label: "Monthly Pay Report" },
          { value: "pf", label: "PF Report" },
          { value: "salary-register", label: "Salary Register" },
          { value: "pf-difference", label: "PF difference (Sep 2026)" },
        ]}
      />
      {report === "pf-difference" ? (
        <PfDifferenceReport />
      ) : (
        <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-medium text-foreground">{TITLES[report as Report]}</h1>
        <div className="flex items-center gap-2.5">
          <Select wrapperClassName="w-36" value={month} onChange={(e) => setParams({ month: e.target.value })}>
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="ps-9" />
          </div>
          <Button onClick={exportCsv} disabled={rows.length === 0}>
            <Download /> Export as Excel
          </Button>
        </div>
      </div>
      {noUan > 0 && (
        <p className="-mt-3 mb-3 text-xs text-destructive">
          {noUan} employee(s) without a UAN are left out of the export (ECR) until a UAN is added.
        </p>
      )}
      <div className={`${panelCls} scrollbar-thin overflow-x-auto`}>
        <table className={tableCls}>
          <thead>
            <tr className="bg-muted/40">
              {cols.map((c) => (
                <th key={c.h} className={thCls}>
                  {c.h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, e, b }) => (
              <tr key={e.id} className={trCls}>
                {cols.map((c) => {
                  const v = c.v(r, e, b);
                  return (
                    <td key={c.h} className={`${tdCls} whitespace-nowrap text-sm ${v === "Missing" ? "text-destructive" : ""}`}>
                      {typeof v === "number" && !["Payable Days"].includes(c.h) ? num(v) : v}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={cols.length}>No Rows To Show</EmptyRow>}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}

/**
 * September difference, for the separate (supplementary) ECR when September was paid and filed on the
 * old ceiling. One row per employee with a difference; payer shows who bears the employee share.
 */
function PfDifferenceReport() {
  const diffs = useHrmsStore((s) => s.pfDifferences);
  const employees = useHrmsStore((s) => s.employees);
  const rows = diffs.map((d) => ({ d, e: employees.find((x) => x.id === d.employeeId)! }));
  const head = ["UAN", "Employee ID", "Employee Name", "Employee PF", "EPS", "Employer EPF", "EDLI", "Employee share paid by", "Settled in"];
  const line = ({ d, e }: (typeof rows)[number]) => [
    e.uan ?? "Missing",
    e.employeeId,
    e.name,
    d.employeePf,
    d.eps,
    d.employerEpf,
    d.edli,
    d.employeePf === 0 ? "— (pension split only)" : d.payer === "employee" ? "Employee (deducted)" : "Employer",
    d.recoverFrom,
  ];
  const exportCsv = () => {
    const blob = new Blob([[head, ...rows.filter((r) => r.e.uan).map(line)].map((l) => l.map((x) => `"${x}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "PF-difference-SEP-2026.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-foreground">PF difference — September 2026</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Created when September is re-run as “Paid on the old ceiling”, or its difference is added to October. Source for the difference ECR; employees without a UAN are left out of the export.
          </p>
        </div>
        <Button onClick={exportCsv} disabled={rows.length === 0}>
          <Download /> Export as Excel
        </Button>
      </div>
      <div className={`${panelCls} scrollbar-thin overflow-x-auto`}>
        <table className={tableCls}>
          <thead>
            <tr className="bg-muted/40">
              {head.map((h) => (
                <th key={h} className={thCls}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.e.id} className={trCls}>
                {line(r).map((v, i) => (
                  <td key={head[i]} className={`${tdCls} whitespace-nowrap text-sm ${v === "Missing" ? "text-destructive" : ""}`}>
                    {typeof v === "number" ? num(v) : v}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={head.length}>No differences — September hasn't been re-run as “Paid on the old basis”.</EmptyRow>}
          </tbody>
        </table>
      </div>
    </>
  );
}
