import { create } from "zustand";
import type {
  Branch,
  Employee,
  EmployeeDocument,
  EmployeeNote,
  HrSettings,
  LeaveApplication,
  LeavePolicy,
  MonthKey,
  OneTimeItem,
  PaidAnswer,
  PayRecord,
  PayrollRun,
  PfDifference,
  SalaryStructure,
  SepBasis,
} from "../pages/hrms/types";
import {
  SEED_ABSENCES,
  SEED_BRANCHES,
  SEED_DOCUMENTS,
  SEED_EMPLOYEES,
  SEED_HOLIDAYS,
  SEED_HR_SETTINGS,
  SEED_LEAVE_APPLICATIONS,
  SEED_LEAVE_POLICIES,
  SEED_NOTES,
  SEED_ONE_TIME,
  SEED_PAID_MONTHS,
  SEED_PAYABLE_OVERRIDES,
  SEED_RUN_MONTHS,
  SEED_SALARIES,
} from "../pages/hrms/data";
import {
  REVISION_MONTH,
  computePay,
  coveredStructure,
  employedDaysBetween,
  employedInMonth,
  isNewlyCovered,
  joinsEps,
  monthlyPfWage,
  pfSegments,
  salaryFor,
  samePay,
  splitPayable,
} from "../pages/hrms/payroll";
import { defaultPayableDays, payableBySegment } from "../pages/hrms/attendance";
import { TODAY, addMonths, compareMonths, monthEnd } from "../pages/hrms/months";
import { NET_PAY_FLOOR_DROP, PF_REVISION } from "../pages/hrms/statutory";
import { FIRST_FULL_MONTH, ctcRows, septemberStatus } from "../pages/hrms/revision";

// HRMS prototype's own mock world (employees, salary structures, payroll runs, HR settings),
// kept apart from the Bharat Connect store the same way Banking keeps useBankingStore.

type OneTime = Record<MonthKey, Record<string, { benefits: OneTimeItem[]; deductions: OneTimeItem[] }>>;

export const DIFF_LABEL = "PF difference – Sep 2026";
export const DIFF_EMPLOYER_LABEL = "Employer PF difference – Sep 2026";
export const DIFF_EMPLOYER_PAYS_LABEL = "Employee PF difference – Sep 2026 (employer pays)";

interface Data {
  employees: Employee[];
  branches: Branch[];
  salaries: SalaryStructure[];
  runs: Record<MonthKey, PayrollRun>;
  payableOverrides: Record<MonthKey, Record<string, number>>;
  /** Hand-edited payable days per PF segment (September 2026). */
  payableHalves: Record<MonthKey, Record<string, number[]>>;
  payableReasons: Record<MonthKey, Record<string, string>>;
  oneTime: OneTime;
  absences: Record<string, string[]>;
  holidays: { date: string; name: string }[];
  hrSettings: HrSettings;
  leavePolicies: LeavePolicy[];
  leaveApplications: LeaveApplication[];
  notes: EmployeeNote[];
  documents: EmployeeDocument[];
  /** September 2026 PF basis selected on the computation page (one basis for the month). */
  sepBasis: SepBasis;
  pfDifferences: PfDifference[];
  sepReminderDismissed: boolean;
  /** How September was brought onto the new ceiling: re-run, or its difference added to October. */
  sepCorrection: { method: "rerun" | "october"; on: string } | null;
  /** October choice set on the computation page and previewed live until the run saves it. */
  octPlan: OctoberPlan;
}

export interface OctoberPlan {
  /** September left on the old ceiling: add its difference to October, or not (correct September instead). */
  sepDifference: "add" | "skip";
}

export interface RunResult {
  inserted: number;
  updated: number;
  unchanged: number;
}

export interface SeptemberRunOptions {
  paidAnswer: PaidAnswer;
  /** Who bears the employee share of the difference, per employee (paid on the old basis only). */
  payers: Record<string, "employee" | "employer">;
}

interface HrmsState extends Data {
  addEmployee: (e: Omit<Employee, "id">) => Employee;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  /** Set Salary: replaces a structure effective the same month, otherwise adds a revision. */
  setSalary: (s: Omit<SalaryStructure, "id" | "createdOn">) => void;
  setPayableDays: (month: MonthKey, employeeId: string, days: number, reason: string, halves?: number[]) => void;
  addOneTime: (month: MonthKey, employeeId: string, kind: "benefits" | "deductions", item: OneTimeItem) => void;
  removeOneTime: (month: MonthKey, employeeId: string, kind: "benefits" | "deductions", index: number) => void;
  setSepBasis: (b: SepBasis) => void;
  dismissSepReminder: () => void;
  runPayroll: (month: MonthKey, employeeIds: string[], sep?: SeptemberRunOptions) => RunResult;
  markPaid: (month: MonthKey, employeeIds: string[], mode: string, date: string) => void;
  /** September left as paid on the old ceiling: settle its mid-month difference in `month` instead of re-running it. */
  addSeptemberToMonth: (month: MonthKey, payers: Record<string, "employee" | "employer">) => void;
  setOctPlan: (patch: Partial<OctoberPlan>) => void;
  /** Save the October plan (September difference) — done by the first October run. */
  applyOctPlan: () => void;
  updateHrSettings: (patch: Partial<HrSettings>) => void;
  saveLeavePolicy: (p: LeavePolicy) => void;
  setLeaveApplicationStatus: (id: string, status: LeaveApplication["status"]) => void;
  addNote: (employeeId: string, text: string) => void;
  addDocument: (employeeId: string, name: string) => void;
  resetHrms: () => void;
}

export interface ReviewRow {
  employee: Employee;
  salary?: SalaryStructure;
  branch?: Branch;
  record?: PayRecord;
  payableFromAttendance: boolean;
  /** PF coverage changes from the revision. */
  newlyCovered: boolean;
  joinsEps: boolean;
  /** Outstanding September difference still to be recovered after this month. */
  carryForward?: number;
  /** First month on the new ceiling: CTC at the old ceiling, when employer PF (and so CTC) rises for this employee. */
  ctcBefore?: number;
}

/** Payable days for an employee in a month: the hand-entered figure if any, else from attendance. */
export function payableDaysFor(s: Pick<Data, "payableOverrides" | "payableHalves" | "absences">, e: Employee, month: MonthKey): number {
  const halves = s.payableHalves[month]?.[e.id];
  if (halves) return halves.reduce((t, d) => t + d, 0);
  return s.payableOverrides[month]?.[e.id] ?? defaultPayableDays(e, month, s.absences);
}

/** Payable days per PF segment: hand-entered halves, else a manual total split by employed days, else attendance. */
export function payableHalvesFor(s: Pick<Data, "payableOverrides" | "payableHalves" | "absences">, e: Employee, month: MonthKey): number[] {
  const halves = s.payableHalves[month]?.[e.id];
  if (halves) return halves;
  const total = s.payableOverrides[month]?.[e.id];
  if (total !== undefined) return splitPayable(total, pfSegments(month).map((seg) => employedDaysBetween(e, month, seg.from, seg.to)));
  return payableBySegment(e, month, s.absences);
}

/** Employee share of a September difference already recovered in runs before `month`. */
function recoveredBefore(s: Data, employeeId: string, month: MonthKey): number {
  return Object.values(s.runs)
    .filter((r) => compareMonths(r.month, month) < 0 && compareMonths(r.month, REVISION_MONTH) > 0)
    .reduce((t, r) => t + (r.records[employeeId]?.deductions.filter((d) => d.name === DIFF_LABEL).reduce((x, d) => x + d.amount, 0) ?? 0), 0);
}

/** Live computation for a month — what the Payroll Computation page shows (hrms/payroll/review). */
export function reviewMonth(s: Data, month: MonthKey, opts: { sepBasis?: SepBasis } = {}): ReviewRow[] {
  const basis = month === REVISION_MONTH ? (opts.sepBasis ?? s.sepBasis) : undefined;
  // First month on the new ceiling: preview the October plan (not yet saved) so the table shows what Run will do.
  const firstFull = month === FIRST_FULL_MONTH;
  const planDiffs = firstFull && octoberSepPending(s) && s.octPlan.sepDifference === "add" ? septemberDiffs(s, month) : [];
  const ctcByEmployee = new Map(firstFull ? ctcRows(s.employees, s.salaries).map((r) => [r.employee.id, r]) : []);
  return (
    s.employees
      // Exited employees still appear in the month they left (employedInMonth checks the exit date).
      .filter((e) => employedInMonth(e, month) && (e.status === "active" || !!e.dateOfExit))
      .map((employee) => {
        const salary = salaryFor(s.salaries, employee.id, month);
        const branch = s.branches.find((b) => b.id === employee.branchId);
        const revisionSalary = salaryFor(s.salaries, employee.id, REVISION_MONTH);
        const coverage = { newlyCovered: isNewlyCovered(employee, revisionSalary), joinsEps: joinsEps(employee, revisionSalary) };
        const one = s.oneTime[month]?.[employee.id];
        const base = {
          employee,
          salary,
          branch,
          payableFromAttendance: s.payableOverrides[month]?.[employee.id] === undefined && !s.payableHalves[month]?.[employee.id],
          newlyCovered: coverage.newlyCovered && compareMonths(month, REVISION_MONTH) >= 0 && basis !== "old",
          joinsEps: coverage.joinsEps && compareMonths(month, REVISION_MONTH) >= 0 && basis !== "old",
          ctcBefore: ctcByEmployee.get(employee.id)?.ctcBefore,
        };
        if (!salary) return base;

        const compute = (deductions: OneTimeItem[], employerAdjustments: OneTimeItem[]) =>
          computePay({
            employee,
            salary,
            state: branch?.state ?? "",
            month,
            payableDays: payableDaysFor(s, employee, month),
            halves: month === REVISION_MONTH ? payableHalvesFor(s, employee, month) : undefined,
            sepBasis: basis,
            coverage,
            benefits: one?.benefits,
            deductions,
            employerAdjustments,
          });

        // September difference settled in a later month.
        const diff =
          compareMonths(month, REVISION_MONTH) > 0
            ? (planDiffs.find((d) => d.employeeId === employee.id) ?? s.pfDifferences.find((d) => d.employeeId === employee.id))
            : undefined;
        const deductions = [...(one?.deductions ?? [])];
        const employerAdjustments: OneTimeItem[] = [];
        if (diff && month === diff.recoverFrom) {
          if (diff.employerPf) employerAdjustments.push({ name: DIFF_EMPLOYER_LABEL, amount: diff.employerPf });
          if (diff.payer === "employer" && diff.employeePf) employerAdjustments.push({ name: DIFF_EMPLOYER_PAYS_LABEL, amount: diff.employeePf });
        }
        let carryForward: number | undefined;
        let heldBack: number | undefined;
        if (diff && diff.payer === "employee" && diff.employeePf > 0 && compareMonths(month, diff.recoverFrom) >= 0) {
          const outstanding = diff.employeePf - recoveredBefore(s, employee.id, month);
          if (outstanding > 0) {
            // Net-pay floor: October net may not fall more than 10% below September's net as paid —
            // less September's one-off benefits (a bonus or incentive isn't the take-home people rely on).
            const sep = s.runs[REVISION_MONTH];
            const sepRec = sep?.records[employee.id];
            const oneOffs = sepRec?.benefits.reduce((t, b) => t + b.amount, 0) ?? 0;
            const baseline = (sep?.payments[employee.id]?.paidAmount ?? sepRec?.payout ?? 0) - oneOffs;
            const before = compute(deductions, employerAdjustments).payout;
            const allowed = Math.max(0, Math.floor(before - (1 - NET_PAY_FLOOR_DROP) * baseline));
            const take = Math.min(outstanding, allowed);
            if (take > 0) deductions.push({ name: DIFF_LABEL, amount: take });
            if (take < outstanding) {
              heldBack = outstanding - take;
              carryForward = heldBack;
            }
          }
        }
        const record = compute(deductions, employerAdjustments);
        if (heldBack) record.recoveryHeldBack = heldBack;
        return { ...base, record, carryForward };
      })
  );
}

/** September still stands on the old ceiling (not re-run, difference not yet added to a later month). */
export function octoberSepPending(s: Data): boolean {
  return septemberStatus(s.runs[REVISION_MONTH], s.sepCorrection) === "old";
}

/** September's mid-month difference for everyone in its run, to settle in `month`. Exited employees: employer pays. */
function septemberDiffs(s: Data, month: MonthKey, payers: Record<string, PfDifference["payer"]> = {}): PfDifference[] {
  const ids = Object.keys(s.runs[REVISION_MONTH]?.records ?? {});
  return septemberImpact(s, ids, "mid_month")
    .map((r) => differenceFor(r.employee.id, r.before, r.after, payers[r.employee.id] ?? (r.employee.dateOfExit ? "employer" : "employee"), month))
    .filter((d): d is PfDifference => !!d);
}

/** Per-employee before / after for the September run's impact step. */
export interface ImpactRow {
  employee: Employee;
  before: PayRecord;
  after: PayRecord;
  /** True when September was already run for this employee (so `before` is what was run). */
  wasRun: boolean;
  paid: boolean;
}

export function septemberImpact(s: Data, employeeIds: string[], basis: SepBasis = s.sepBasis): ImpactRow[] {
  const old = new Map(reviewMonth(s, REVISION_MONTH, { sepBasis: "old" }).map((r) => [r.employee.id, r.record]));
  const run = s.runs[REVISION_MONTH];
  return reviewMonth(s, REVISION_MONTH, { sepBasis: basis })
    .filter((r) => r.record && employeeIds.includes(r.employee.id))
    .map((r) => ({
      employee: r.employee,
      // Compare with what was paid: the original record if it was re-run since, else the run, else the old ceiling.
      before: run?.paidRecords?.[r.employee.id] ?? run?.records[r.employee.id] ?? old.get(r.employee.id)!,
      after: r.record!,
      wasRun: !!run?.records[r.employee.id],
      paid: !!run?.payments[r.employee.id],
    }));
}

/** A September difference between what was run and what the new ceiling gives; null when nothing changed. */
function differenceFor(employeeId: string, before: PayRecord, after: PayRecord, payer: PfDifference["payer"], recoverFrom: MonthKey): PfDifference | null {
  const d = {
    employeePf: after.employeePf - before.employeePf,
    employerPf: after.employerPf - before.employerPf,
    eps: after.eps - (before.eps ?? 0),
    employerEpf: after.employerEpf - (before.employerEpf ?? before.employerPf),
    edli: after.edli - (before.edli ?? 0),
  };
  if (!d.employeePf && !d.employerPf && !d.eps) return null;
  return { employeeId, fromMonth: REVISION_MONTH, ...d, payer, recoverFrom, createdOn: TODAY };
}

/**
 * Record PF / pension coverage from 17 Sep for the given employees who qualify: start date, PF wage on
 * 17 Sep, and Salary Setup moved from NO-PF to 12%-Basic + Limit to PF ceiling from October. A rule,
 * not a choice — there's no opt-out below the ceiling — so it's done by the run, not asked.
 */
function recordCoverage(s: Data, employeeIds: string[]): Pick<Data, "employees" | "salaries"> {
  const salaries = [...s.salaries];
  const employees = s.employees.map((e) => {
    if (!employeeIds.includes(e.id)) return e;
    const rev = salaryFor(s.salaries, e.id, REVISION_MONTH);
    const covered = isNewlyCovered(e, rev);
    const eps = joinsEps(e, rev);
    if ((!covered || e.pfCoveredFrom) && (!eps || e.epsFrom)) return e;
    const start = e.doj > PF_REVISION.from ? e.doj : PF_REVISION.from;
    const oct = addMonths(REVISION_MONTH, 1);
    const latest = salaryFor(s.salaries, e.id, oct);
    if (covered && latest && latest.pfBasis === "none") {
      const i = salaries.findIndex((x) => x.employeeId === e.id && x.effectiveFrom === oct);
      const next = { ...coveredStructure(latest, true), id: nextId("s"), effectiveFrom: oct, createdOn: TODAY, reason: "PF ceiling — brought under PF" };
      if (i >= 0) salaries[i] = next;
      else salaries.push(next);
    }
    // epsMember stays as it was: EPS counts only from epsFrom (17 Sep), not for 1–16 Sep.
    return {
      ...e,
      pfCoveredFrom: covered ? start : e.pfCoveredFrom,
      epsFrom: eps ? start : e.epsFrom,
      pfWageOnRevision: rev ? monthlyPfWage(coveredStructure(rev, true)) : e.pfWageOnRevision,
    };
  });
  return { employees, salaries };
}

/** Earliest month after September with no payment recorded for the employee — where a difference lands. */
function firstUnpaidMonthAfter(s: Data, employeeId: string, month: MonthKey): MonthKey {
  let m = addMonths(month, 1);
  for (let i = 0; i < 12 && s.runs[m]?.payments[employeeId]; i++) m = addMonths(m, 1);
  return m;
}

function seedData(): Data {
  const data: Data = {
    employees: SEED_EMPLOYEES,
    branches: SEED_BRANCHES,
    salaries: SEED_SALARIES,
    runs: {},
    payableOverrides: SEED_PAYABLE_OVERRIDES,
    payableHalves: {},
    payableReasons: {},
    oneTime: SEED_ONE_TIME,
    absences: SEED_ABSENCES,
    holidays: SEED_HOLIDAYS,
    hrSettings: SEED_HR_SETTINGS,
    leavePolicies: SEED_LEAVE_POLICIES,
    leaveApplications: SEED_LEAVE_APPLICATIONS,
    notes: SEED_NOTES,
    documents: SEED_DOCUMENTS,
    sepBasis: "mid_month",
    pfDifferences: [],
    sepReminderDismissed: false,
    sepCorrection: null,
    octPlan: { sepDifference: "add" },
  };
  for (const month of SEED_RUN_MONTHS) {
    // Every seeded month — September included — was run before the revision, on the old ceiling.
    const rows = reviewMonth(data, month, { sepBasis: "old" }).filter((r) => r.record && r.branch);
    const records: Record<string, PayRecord> = {};
    for (const r of rows) records[r.employee.id] = r.record!;
    const payments: PayrollRun["payments"] = {};
    if (SEED_PAID_MONTHS.includes(month))
      for (const r of rows) payments[r.employee.id] = { employeeId: r.employee.id, paidAmount: r.record!.payout, paidOn: monthEnd(month), mode: "Bank Transfer" };
    data.runs[month] = { month, records, payments, runOn: monthEnd(month), sepBasis: month === REVISION_MONTH ? "old" : undefined };
  }
  return data;
}

let seq = 100;
const nextId = (p: string) => `${p}${++seq}`;

export const useHrmsStore = create<HrmsState>((set, get) => ({
  ...seedData(),

  addEmployee: (e) => {
    const employee = { ...e, id: nextId("e") };
    set((s) => ({ employees: [employee, ...s.employees] }));
    return employee;
  },

  updateEmployee: (id, patch) => set((s) => ({ employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

  setSalary: (input) =>
    set((s) => {
      const others = s.salaries.filter((x) => !(x.employeeId === input.employeeId && x.effectiveFrom === input.effectiveFrom));
      return { salaries: [...others, { ...input, id: nextId("s"), createdOn: TODAY }] };
    }),

  setPayableDays: (month, employeeId, days, reason, halves) =>
    set((s) => {
      const restHalves = { ...s.payableHalves[month] };
      if (halves) restHalves[employeeId] = halves;
      else delete restHalves[employeeId];
      return {
        payableOverrides: { ...s.payableOverrides, [month]: { ...s.payableOverrides[month], [employeeId]: days } },
        payableHalves: { ...s.payableHalves, [month]: restHalves },
        payableReasons: { ...s.payableReasons, [month]: { ...s.payableReasons[month], [employeeId]: reason } },
      };
    }),

  addOneTime: (month, employeeId, kind, item) =>
    set((s) => {
      const cur = s.oneTime[month]?.[employeeId] ?? { benefits: [], deductions: [] };
      return { oneTime: { ...s.oneTime, [month]: { ...s.oneTime[month], [employeeId]: { ...cur, [kind]: [...cur[kind], item] } } } };
    }),

  removeOneTime: (month, employeeId, kind, index) =>
    set((s) => {
      const cur = s.oneTime[month]?.[employeeId];
      if (!cur) return {};
      return { oneTime: { ...s.oneTime, [month]: { ...s.oneTime[month], [employeeId]: { ...cur, [kind]: cur[kind].filter((_, i) => i !== index) } } } };
    }),

  setSepBasis: (sepBasis) => set({ sepBasis }),
  dismissSepReminder: () => set({ sepReminderDismissed: true }),

  runPayroll: (month, employeeIds, sep) => {
    const s = get();
    const impact = month === REVISION_MONTH ? new Map(septemberImpact(s, employeeIds).map((r) => [r.employee.id, r])) : undefined;
    const rows = reviewMonth(s, month).filter((r) => employeeIds.includes(r.employee.id) && r.record);
    const prev = s.runs[month];
    const records = { ...prev?.records };
    const payments = { ...prev?.payments };
    const paidRecords = { ...prev?.paidRecords };
    let pfDifferences = s.pfDifferences;
    const result: RunResult = { inserted: 0, updated: 0, unchanged: 0 };
    for (const r of rows) {
      const id = r.employee.id;
      const old = records[id];
      if (!old) result.inserted++;
      else if (samePay(old, r.record!)) result.unchanged++;
      else result.updated++;
      // First re-run of a paid employee: keep what was actually paid.
      if (old && prev?.payments[id] && !paidRecords[id]) paidRecords[id] = old;
      records[id] = r.record!;

      if (month === REVISION_MONTH && sep) {
        pfDifferences = pfDifferences.filter((d) => d.employeeId !== id);
        if (sep.paidAnswer === "paid_as_here") {
          // Salaries were paid exactly as now calculated: records only, nothing carried forward.
          payments[id] = { employeeId: id, paidAmount: r.record!.payout, paidOn: payments[id]?.paidOn ?? TODAY, mode: payments[id]?.mode ?? "Bank Transfer" };
        } else if (sep.paidAnswer === "paid_old") {
          const before = impact!.get(id)!.before;
          const d = differenceFor(id, before, r.record!, sep.payers[id] ?? "employee", firstUnpaidMonthAfter(s, id, month));
          if (d) pfDifferences = [...pfDifferences, d];
          // What was actually paid stays as the payment; the run now carries the corrected September.
          if (!payments[id]) payments[id] = { employeeId: id, paidAmount: before.payout, paidOn: TODAY, mode: "Bank Transfer" };
        }
      }
    }
    // Coverage is recorded by whichever runs first on the new ceiling: a September re-run or a later month.
    const onNewCeiling = compareMonths(month, REVISION_MONTH) > 0 || (month === REVISION_MONTH && s.sepBasis !== "old");
    set({
      runs: {
        ...s.runs,
        [month]: { month, records, payments, paidRecords, runOn: TODAY, ...(month === REVISION_MONTH ? { sepBasis: s.sepBasis, paidAnswer: sep?.paidAnswer } : {}) },
      },
      pfDifferences,
      ...(month === REVISION_MONTH && sep ? { sepCorrection: s.sepBasis === "old" ? null : { method: "rerun" as const, on: TODAY } } : {}),
      ...(onNewCeiling ? recordCoverage(s, rows.map((r) => r.employee.id)) : {}),
    });
    return result;
  },

  markPaid: (month, employeeIds, mode, date) =>
    set((s) => {
      const run = s.runs[month];
      if (!run) return {};
      const payments = { ...run.payments };
      for (const id of employeeIds) {
        const rec = run.records[id];
        if (rec) payments[id] = { employeeId: id, paidAmount: rec.payout, paidOn: date, mode };
      }
      return { runs: { ...s.runs, [month]: { ...run, payments } } };
    }),

  addSeptemberToMonth: (month, payers) =>
    set((s) => {
      // September stays as paid; the mid-month difference for everyone in it is settled in `month`.
      const ids = Object.keys(s.runs[REVISION_MONTH]?.records ?? {});
      const keep = s.pfDifferences.filter((d) => !ids.includes(d.employeeId));
      const diffs = septemberDiffs(s, month, payers);
      return {
        pfDifferences: [...keep, ...diffs],
        sepCorrection: { method: "october", on: TODAY },
        ...recordCoverage(s, ids),
      };
    }),

  setOctPlan: (patch) => set((s) => ({ octPlan: { ...s.octPlan, ...patch } })),

  applyOctPlan: () => {
    const s = get();
    if (octoberSepPending(s) && s.octPlan.sepDifference === "add") get().addSeptemberToMonth(FIRST_FULL_MONTH, {});
  },

  updateHrSettings: (patch) => set((s) => ({ hrSettings: { ...s.hrSettings, ...patch } })),

  saveLeavePolicy: (p) =>
    set((s) => ({ leavePolicies: s.leavePolicies.some((x) => x.id === p.id) ? s.leavePolicies.map((x) => (x.id === p.id ? p : x)) : [...s.leavePolicies, p] })),

  setLeaveApplicationStatus: (id, status) => set((s) => ({ leaveApplications: s.leaveApplications.map((l) => (l.id === id ? { ...l, status } : l)) })),

  addNote: (employeeId, text) => set((s) => ({ notes: [{ id: nextId("n"), employeeId, text, createdOn: TODAY }, ...s.notes] })),

  addDocument: (employeeId, name) => set((s) => ({ documents: [{ id: nextId("d"), employeeId, name, uploadedOn: TODAY }, ...s.documents] })),

  resetHrms: () => set(seedData()),
}));
