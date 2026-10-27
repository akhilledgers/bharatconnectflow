import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Search, SquarePen, Trash2 } from "lucide-react";
import { DIFF_LABEL, reviewMonth, useHrmsStore, type ReviewRow } from "../../../store/useHrmsStore";
import { REVISION_MONTH, samePay } from "../payroll";
import { SeptemberBasisCard, SeptemberRunDialog } from "./SeptemberRun";
import { OctoberRerunAlert } from "./OctoberRun";
import { FIRST_FULL_MONTH } from "../revision";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Checkbox, Input, Select } from "../../../components/ui/input";
import { ToggleGroup } from "../../../components/ui/tabs";
import { tableCls, tdCls, thCls, trCls } from "../../../components/ui/table";
import { cn } from "../../../lib/cn";
import { CURRENT_MONTH, addMonths, compareMonths, fyMonths, inr } from "../months";

const fmtDays = (d: number) => (Number.isInteger(d) ? String(d) : d.toFixed(2));
import { EmptyRow, panelCls } from "../shared";
import { AssignBranchDialog, OneTimeDialog, PayableDaysDialog } from "./PayrollDialogs";
import type { Employee } from "../types";

// v4 /hrms/payroll-computation?month=SEP-2026. Live review of the month for every employee on the
// rolls: payable days (pop-up), one-time benefits / deductions, PF, ESI, PT, Gross, CTC, Payout,
// Branch (or "Assign branch"). Select employees → Run Payroll. As in v4 there's no confirmation step:
// the run happens immediately and you land on the Monthly Pay Report.

type Dialog =
  | { kind: "payable"; employee: Employee; current: number }
  | { kind: "branch"; employee: Employee }
  | { kind: "benefits" | "deductions"; employee: Employee }
  | null;

export function PayrollComputationPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const month = params.get("month") ?? CURRENT_MONTH;
  const state = useHrmsStore();
  const { runPayroll, removeOneTime } = state;
  const rows = reviewMonth(state, month);
  const run = state.runs[month];
  const activeCount = state.employees.filter((e) => e.status === "active").length;
  const withSalary = state.employees.filter((e) => e.status === "active" && state.salaries.some((s) => s.employeeId === e.id)).length;

  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);

  const [view, setView] = useState<"all" | "affected">("all");

  const selectable = (r: ReviewRow) => !!r.record && !!r.branch;

  /** Touched by the PF ceiling revision — September vs what was paid; October's difference lines and CTC changes. */
  const revisionView = month === REVISION_MONTH || month === FIRST_FULL_MONTH;
  const affected = (r: ReviewRow): boolean => {
    const rec = r.record;
    if (!rec) return false;
    if (month === REVISION_MONTH) {
      const paid = run?.paidRecords?.[r.employee.id] ?? run?.records[r.employee.id];
      return r.newlyCovered || r.joinsEps || (!!paid && (paid.employeePf !== rec.employeePf || paid.payout !== rec.payout || (paid.eps ?? 0) !== rec.eps));
    }
    if (month === FIRST_FULL_MONTH)
      return rec.deductions.some((d) => d.name === DIFF_LABEL) || !!rec.recoveryHeldBack || !!rec.employerAdjustments?.length || r.ctcBefore !== undefined;
    return false;
  };
  const affectedCount = revisionView ? rows.filter(affected).length : 0;

  const shown = rows.filter(
    (r) =>
      (view === "all" || !revisionView || affected(r)) &&
      (!search || r.employee.name.toLowerCase().includes(search.toLowerCase()) || r.employee.employeeId.toLowerCase().includes(search.toLowerCase())),
  );
  const totals = rows.reduce(
    (t, r) => {
      if (!r.record) return t;
      t.eesi += r.record.employeeEsi;
      t.epf += r.record.employeePf;
      t.pt += r.record.pt;
      t.resi += r.record.employerEsi;
      t.rpf += r.record.employerPf;
      t.tds += r.record.tds;
      return t;
    },
    { eesi: 0, epf: 0, pt: 0, resi: 0, rpf: 0, tds: 0 },
  );
  const allSelectable = shown.filter(selectable).map((r) => r.employee.id);
  const months = fyMonths(CURRENT_MONTH).filter((m) => compareMonths(m, CURRENT_MONTH) <= 0);

  const isSeptember = month === REVISION_MONTH;
  const [sepRunOpen, setSepRunOpen] = useState(false);
  const isFirstFull = month === FIRST_FULL_MONTH;

  const doRun = () => {
    if (isSeptember) return setSepRunOpen(true);
    const res = runPayroll(month, selected);
    toast.success("Payroll computed successfully", { description: `Inserted ${res.inserted} · Updated ${res.updated} · No changes ${res.unchanged}` });
    navigate(`/hrms/reports/monthly-pay?month=${month}`);
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground">Payroll Computation</h1>
        <div className="flex gap-2.5">
          <Button onClick={() => navigate("/hrms/tax-declaration")}>Tax Declaration</Button>
          <Button onClick={() => toast.success("PT exemption saved")}>Add PT Exemption</Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-stretch gap-3">
        {[
          [activeCount, "Active Employees"],
          [withSalary, "With salary setup"],
          [activeCount - withSalary, "Without salary setup"],
        ].map(([n, l]) => (
          <div key={l} className="min-w-40 rounded-xl border border-border bg-card px-4 py-3 shadow-xs shadow-black/5">
            <div className="text-xl font-semibold">{n}</div>
            <div className="text-xs text-muted-foreground">{l}</div>
          </div>
        ))}
        <div className="grid flex-1 grid-cols-3 gap-x-6 gap-y-1.5 rounded-xl border border-border bg-card px-4 py-3 text-xs shadow-xs shadow-black/5">
          <Chip dot="bg-amber-500" label="Employee ESI" value={totals.eesi} />
          <Chip dot="bg-blue-500" label="Employee PF" value={totals.epf} />
          <Chip dot="bg-emerald-500" label="PT" value={totals.pt} />
          <Chip dot="bg-amber-700" label="Employer ESI" value={totals.resi} />
          <Chip dot="bg-blue-700" label="Employer PF" value={totals.rpf} />
          <Chip dot="bg-violet-500" label="TDS" value={totals.tds} />
        </div>
      </div>

      {isSeptember && <SeptemberBasisCard />}
      {isFirstFull && <OctoberRerunAlert />}

      <div className={panelCls}>
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-2.5 border-b border-border px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="relative w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Employee" className="ps-9" />
            </div>
            {revisionView && (
              <ToggleGroup<"all" | "affected">
                value={view}
                onChange={setView}
                items={[
                  { value: "all", label: "All" },
                  { value: "affected", label: `Affected by PF ceiling (${affectedCount})` },
                ]}
              />
            )}
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="size-2 rounded-full bg-blue-500" /> Selected Employees : {selected.length}
            </span>
            {run && (
              <Badge variant="primary">
                Run on {run.runOn.split("-").reverse().join("-")} · {Object.keys(run.records).length} employees
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Select
              wrapperClassName="w-36"
              value={month}
              onChange={(e) => {
                setSelected([]);
                setParams({ month: e.target.value });
              }}
            >
              {months.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
            <Button variant="primary" disabled={selected.length === 0} onClick={doRun}>
              Run Payroll
            </Button>
          </div>
        </div>

        <div className="scrollbar-thin overflow-x-auto">
          <table className={`${tableCls} min-w-[1250px]`}>
            <thead>
              <tr className="bg-muted/40">
                <th className={`${thCls} w-10`}>
                  <Checkbox
                    aria-label="Select all"
                    checked={allSelectable.length > 0 && allSelectable.every((id) => selected.includes(id))}
                    onChange={(e) => setSelected(e.target.checked ? allSelectable : [])}
                  />
                </th>
                {["EMP ID", "EMP NAME", "PAYABLE", "BENEFITS", "DEDUCTION", "PF", "ESI", "PT", "GROSS", "CTC", "PAYOUT", "BRANCH"].map((h) => (
                  <th key={h} className={cn(thCls, "text-xs font-medium")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const e = r.employee;
                const rec = r.record;
                const one = state.oneTime[month]?.[e.id];
                const ran = run?.records[e.id];
                // Struck-out figures show what was paid, not whichever run came last.
                const paid = run?.paidRecords?.[e.id] ?? ran;
                const changed = ran && rec && !samePay(ran, rec);
                return (
                  <tr key={e.id} className={trCls}>
                    <td className={tdCls}>
                      <span title={!rec ? "Set up salary to include in payroll" : !r.branch ? "Assign a branch to include in payroll" : undefined}>
                        <Checkbox
                          aria-label={`Select ${e.name}`}
                          disabled={!selectable(r)}
                          checked={selected.includes(e.id)}
                          onChange={(ev) => setSelected(ev.target.checked ? [...selected, e.id] : selected.filter((x) => x !== e.id))}
                        />
                      </span>
                    </td>
                    <td className={`${tdCls} text-sm`}>{e.employeeId}</td>
                    <td className={tdCls}>
                      <button className="cursor-pointer text-sm text-primary hover:underline" onClick={() => navigate(`/hrms/employees/${e.id}?tab=salary`)}>
                        {e.name}
                      </button>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {ran && (
                          <Badge variant={changed ? "warning" : "success"} className="h-5 text-[10px]">
                            {changed ? "Changed since run" : "In payroll"}
                          </Badge>
                        )}
                        {r.newlyCovered && (
                          <Badge variant="info" className="h-5 text-[10px]" title="Excluded employee with PF wage ≤ ₹25,000 on 17 Sep — covered from that date">
                            PF from 17 Sep
                          </Badge>
                        )}
                        {r.joinsEps && (
                          <Badge variant="info" className="h-5 text-[10px]" title="Non-EPS member with wages ≤ ₹25,000 on 17 Sep — G.S.R. 847(E)">
                            EPS from 17 Sep
                          </Badge>
                        )}
                        {!e.uan && rec && rec.employeePf > 0 && (
                          <Badge variant="destructive" className="h-5 text-[10px]" title="Excluded from the ECR file until a UAN is added">
                            UAN missing
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className={tdCls}>
                      {rec ? (
                        <button
                          className="inline-flex cursor-pointer items-center gap-1.5 text-sm hover:opacity-80"
                          onClick={() => setDialog({ kind: "payable", employee: e, current: rec.payableDays })}
                        >
                          <SquarePen className="size-4 rounded border border-blue-600 p-0.5 text-blue-600" />
                          {fmtDays(rec.payableDays)}
                          {!r.payableFromAttendance && <span className="text-[10px] text-muted-foreground">(manual)</span>}
                          {rec.segments && (
                            <span className="text-[10px] text-muted-foreground" title={rec.segments.map((s) => `${s.label}: ${fmtDays(s.payableDays)}`).join(" · ")}>
                              ({rec.segments.map((s) => fmtDays(s.payableDays)).join(" + ")})
                            </span>
                          )}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className={tdCls}>
                      <OneTimeCell
                        kind="benefits"
                        items={one?.benefits ?? []}
                        disabled={!rec}
                        onAdd={() => setDialog({ kind: "benefits", employee: e })}
                        onRemove={(i) => removeOneTime(month, e.id, "benefits", i)}
                      />
                    </td>
                    <td className={tdCls}>
                      <OneTimeCell
                        kind="deductions"
                        items={one?.deductions ?? []}
                        disabled={!rec}
                        onAdd={() => setDialog({ kind: "deductions", employee: e })}
                        onRemove={(i) => removeOneTime(month, e.id, "deductions", i)}
                      />
                      {rec?.deductions
                        .filter((d) => d.name === DIFF_LABEL)
                        .map((d) => (
                          <div key={d.name} className="mt-1 text-xs" title="Employee share of the September PF difference (September was paid on the old ceiling)">
                            PF diff – Sep <span className="text-primary">{inr(d.amount)}</span>
                          </div>
                        ))}
                      {rec?.recoveryHeldBack ? (
                        <div className="mt-1 text-[10px] text-amber-700" title="Recovery capped so net pay falls no more than 10% below September's">
                          {inr(rec.recoveryHeldBack)} carried to {addMonths(month, 1)}
                        </div>
                      ) : null}
                      {rec?.employerAdjustments?.length ? (
                        <div className="mt-1 text-[10px] text-muted-foreground" title={rec.employerAdjustments.map((a) => `${a.name}: ₹${a.amount}`).join("\n")}>
                          Employer: +{inr(rec.employerAdjustments.reduce((t, a) => t + a.amount, 0))} PF diff
                        </div>
                      ) : null}
                    </td>
                    {rec ? (
                      <>
                        <td className={`${tdCls} whitespace-nowrap text-sm`}>
                          {inr(rec.employeePf)}
                          {paid && paid.employeePf !== rec.employeePf && (
                            <div className="text-[10px] text-muted-foreground line-through" title="As paid">
                              {inr(paid.employeePf)}
                            </div>
                          )}
                        </td>
                        <td className={`${tdCls} whitespace-nowrap text-sm`}>{inr(rec.employeeEsi)}</td>
                        <td className={`${tdCls} whitespace-nowrap text-sm`}>{inr(rec.pt)}</td>
                        <td className={`${tdCls} whitespace-nowrap text-sm`}>{inr(rec.grossEarned)}</td>
                        <td className={`${tdCls} whitespace-nowrap text-sm`}>
                          {inr(rec.ctc)}
                          {r.ctcBefore !== undefined && rec.ctc !== r.ctcBefore && (
                            <div className="text-[10px] text-muted-foreground line-through" title="CTC on the old PF ceiling">
                              {inr(r.ctcBefore)}
                            </div>
                          )}
                        </td>
                        <td className={`${tdCls} whitespace-nowrap text-sm font-medium`}>
                          {inr(rec.payout)}
                          {paid && paid.payout !== rec.payout && (
                            <div className="text-[10px] font-normal text-muted-foreground line-through" title="As paid">
                              {inr(paid.payout)}
                            </div>
                          )}
                        </td>
                      </>
                    ) : (
                      <td colSpan={6} className={`${tdCls} text-sm text-muted-foreground`}>
                        No salary set ·{" "}
                        <button className="cursor-pointer text-primary hover:underline" onClick={() => navigate(`/hrms/employees/${e.id}?tab=salary`)}>
                          Set up salary
                        </button>
                      </td>
                    )}
                    <td className={tdCls}>
                      {r.branch ? (
                        <span className="text-sm uppercase">{r.branch.state}</span>
                      ) : (
                        <Button size="sm" onClick={() => setDialog({ kind: "branch", employee: e })}>
                          Assign branch
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && <EmptyRow colSpan={13}>No employees on the rolls for {month}.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </div>

      {dialog?.kind === "payable" && <PayableDaysDialog employee={dialog.employee} month={month} current={dialog.current} onClose={() => setDialog(null)} />}
      {dialog?.kind === "branch" && <AssignBranchDialog employee={dialog.employee} onClose={() => setDialog(null)} />}
      {sepRunOpen && <SeptemberRunDialog employeeIds={selected} onClose={() => setSepRunOpen(false)} />}
      {(dialog?.kind === "benefits" || dialog?.kind === "deductions") && (
        <OneTimeDialog employee={dialog.employee} month={month} kind={dialog.kind} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function Chip({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${dot}`} />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{inr(value)}</span>
    </div>
  );
}

function OneTimeCell({
  kind,
  items,
  disabled,
  onAdd,
  onRemove,
}: {
  kind: "benefits" | "deductions";
  items: { name: string; amount: number }[];
  disabled: boolean;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  const benefit = kind === "benefits";
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        disabled={disabled}
        onClick={onAdd}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-50",
          benefit ? "border-blue-200 bg-blue-50 text-blue-600" : "border-red-200 bg-red-50 text-red-600",
        )}
      >
        <Plus className="size-3" /> {benefit ? "Benefit" : "Deduction"}
      </button>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <span>{it.name}</span>
          <span className="text-primary">{inr(it.amount)}</span>
          <button onClick={() => onRemove(i)} className="cursor-pointer text-red-500 hover:text-red-700" aria-label={`Remove ${it.name}`}>
            <Trash2 className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
