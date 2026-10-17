import type { Employee, MonthKey, PayrollRun, SalaryStructure } from "./types";
import {
  REVISION_MONTH,
  coveredStructure,
  inPfWage,
  isNewlyCovered,
  joinsEps,
  keepCtcStructure,
  monthlyPfWage,
  salaryFor,
  setupCtc,
  setupPf,
  structureGross,
} from "./payroll";
import { addMonths } from "./months";
import { PF_REVISION } from "./statutory";

// The one-off work the PF wage-ceiling revision brings, as plain data for the October run dialog and
// the dashboard summary card: who comes under PF / pension, whether September was corrected, and whose
// CTC moves when employer PF rises.

/** First month fully on the new ceiling — where the one-time questions are asked. */
export const FIRST_FULL_MONTH: MonthKey = addMonths(REVISION_MONTH, 1);
const PRE_REVISION_MONTH: MonthKey = addMonths(REVISION_MONTH, -1);

export interface CoverageRow {
  employee: Employee;
  /** Excluded employee brought under PF. */
  pf: boolean;
  /** Non-EPS member brought under pension. */
  eps: boolean;
  start: string;
  wageOnRevision: number;
  recorded: boolean;
}

export function coverageRows(employees: Employee[], salaries: SalaryStructure[]): CoverageRow[] {
  return employees.flatMap((e) => {
    const rev = salaryFor(salaries, e.id, REVISION_MONTH);
    if (!rev) return [];
    const pf = isNewlyCovered(e, rev);
    const eps = joinsEps(e, rev);
    if (!pf && !eps) return [];
    return [
      {
        employee: e,
        pf,
        eps,
        start: e.doj > PF_REVISION.from ? e.doj : PF_REVISION.from,
        wageOnRevision: monthlyPfWage(coveredStructure(rev, true)),
        recorded: (!pf || !!e.pfCoveredFrom) && (!eps || !!e.epsFrom),
      },
    ];
  });
}

export type SeptemberStatus = "not_run" | "old" | "rerun" | "in_october";

export function septemberStatus(run: PayrollRun | undefined, correction: { method: "rerun" | "october" } | null): SeptemberStatus {
  if (correction?.method === "october") return "in_october";
  if (!run) return "not_run";
  return (run.sepBasis ?? "old") === "old" ? "old" : "rerun";
}

export interface CtcRow {
  employee: Employee;
  /** Structure as costed from October (newly covered → 12%-Basic + Limit to PF ceiling). */
  base: SalaryStructure;
  newlyCovered: boolean;
  ctcBefore: number;
  ctcAfter: number;
  pfBefore: number;
  pfAfter: number;
}

/** Employees whose CTC rises from October because employer PF rises. No Limit employees never appear. */
export function ctcRows(employees: Employee[], salaries: SalaryStructure[]): CtcRow[] {
  return employees.flatMap((e) => {
    if (e.status !== "active") return [];
    const s = salaryFor(salaries, e.id, FIRST_FULL_MONTH);
    if (!s) return [];
    const newlyCovered = isNewlyCovered(e, salaryFor(salaries, e.id, REVISION_MONTH));
    const base = coveredStructure(s, newlyCovered);
    const ctcBefore = setupCtc(s, PRE_REVISION_MONTH);
    const ctcAfter = setupCtc(base, FIRST_FULL_MONTH);
    if (ctcAfter <= ctcBefore) return [];
    return [{ employee: e, base, newlyCovered, ctcBefore, ctcAfter, pfBefore: setupPf(s, PRE_REVISION_MONTH), pfAfter: setupPf(base, FIRST_FULL_MONTH) }];
  });
}

/** The allowance "Keep CTC the same" shrinks: one outside PF wages (not HRA) if any, else Special Allowance. */
export function absorbComponent(s: SalaryStructure): string | undefined {
  return (s.components.find((c) => c.key !== "hra" && !inPfWage(s, c)) ?? s.components.find((c) => c.key === "special") ?? s.components[0])?.key;
}

export interface CtcPreview {
  gross: number;
  ctc: number;
  /** Full-month take-home change vs the same salary at the old ceiling (before PT / TDS). */
  takeHome: number;
  /** "Keep CTC" isn't possible — not enough in the allowance. */
  impossible: boolean;
}

export function ctcPreview(r: CtcRow, choice: "increase" | "keep"): CtcPreview {
  const oldNet = structureGross(r.base) - r.pfBefore;
  const increase = { gross: structureGross(r.base), ctc: r.ctcAfter, takeHome: structureGross(r.base) - r.pfAfter - oldNet, impossible: false };
  if (choice === "increase") return increase;
  const key = absorbComponent(r.base);
  const k = key ? keepCtcStructure(r.base, r.ctcBefore, key, FIRST_FULL_MONTH) : null;
  if (!k) return { ...increase, impossible: true };
  return { gross: structureGross(k), ctc: setupCtc(k, FIRST_FULL_MONTH), takeHome: structureGross(k) - setupPf(k, FIRST_FULL_MONTH) - oldNet, impossible: false };
}
