import type { Employee, MonthKey, OneTimeItem, PayRecord, PfSegment, SalaryComponent, SalaryStructure, SepBasis } from "./types";
import { CURRENT_MONTH, ageOn, compareMonths, daysInMonth, monthEnd, monthOfDate, monthStart, parseMonth } from "./months";
import {
  EDLI_RATE,
  EPS_AGE_LIMIT,
  EPS_RATE,
  ESI_EMPLOYEE_RATE,
  ESI_EMPLOYER_RATE,
  ESI_WAGE_LIMIT,
  PF_CEILINGS,
  PF_RATE,
  PF_REVISION,
  monthlyTds,
  pfCapOn,
  pfCeilingOn,
  professionalTax,
} from "./statutory";

// Payroll engine. Outside September 2026 it mirrors LEDGERS v4 (components prorate by payable days ÷
// days in month, PF = 12% of PF wages with an optional cap at 12% of the ceiling, employer PF =
// employee PF, ESI when gross ≤ ₹21,000) — now with the ceiling taken from the date, not hardcoded.
//
// September 2026 is worked out per segment (HANDOFF-pf-wage-ceiling.md, "Computation rule"):
//   PF wage_s = min( W × paid_days_s / D ,  C_s × E_s / E )
// C_s = ceiling in force in segment s, E_s = days employed and PF-covered in s, E = Σ E_s.
// Full precision per segment, rounded once at the end. A normal month is the same formula with one segment.

/** The month the ceiling changed in, and the first day of the new ceiling. */
export const REVISION_MONTH: MonthKey = monthOfDate(PF_REVISION.from);
export const REVISION_DAY = Number(PF_REVISION.from.slice(8));
export const OLD_CEILING = PF_CEILINGS[PF_CEILINGS.length - 2].ceiling;
export const NEW_CEILING = PF_REVISION.ceiling;

export const SEP_BASIS_LABEL: Record<SepBasis, string> = {
  mid_month: "Mid-month change",
  old: "Old ceiling, full month",
};

export const PF_BASIS_LABEL = {
  none: "NO-PF",
  gross_excl_hra: "12% gross excluding HRA",
  basic: "12%-Basic",
} as const;

/** "Limit to ₹1800" is now "Limit to PF ceiling", showing the cap in force for the month. */
export function pfLimitLabel(limit: SalaryStructure["pfLimit"], month: MonthKey = CURRENT_MONTH): string {
  return limit === "no_limit" ? "No Limit" : `Limit to PF ceiling (₹${pfCapOn(monthEnd(month)).toLocaleString("en-IN")})`;
}

/** Components LEDGERS offers under "Add Components". */
export const COMPONENT_CATALOG: { key: string; name: string }[] = [
  { key: "hra", name: "House Rent Allowance" },
  { key: "special", name: "Special Allowance" },
  { key: "conveyance", name: "Conveyance Allowance" },
  { key: "medical", name: "Medical Allowance" },
  { key: "lta", name: "Leave Travel Allowance" },
  { key: "telephone", name: "Telephone Allowance" },
  { key: "food", name: "Food Allowance" },
  { key: "driver", name: "Driver Salary Reimbursement" },
  { key: "fuel", name: "Fuel Reimbursement" },
  { key: "bonus", name: "Statutory Bonus" },
];

/** The default split LEDGERS fills in when you type a gross: Basic 50%, HRA 30% of Basic, rest Special. */
export function defaultSplit(gross: number): { basic: number; components: SalaryComponent[] } {
  const basic = Math.round(gross * 0.5);
  const hra = Math.round(basic * 0.3);
  return {
    basic,
    components: [
      { key: "hra", name: "House Rent Allowance", amount: hra, pay: "prorated", inPfWages: false },
      { key: "special", name: "Special Allowance", amount: gross - basic - hra, pay: "prorated", inPfWages: false },
    ],
  };
}

export function structureGross(s: Pick<SalaryStructure, "basic" | "components">): number {
  return s.basic + s.components.reduce((t, c) => t + c.amount, 0);
}

/** Does this component count as PF wages under the structure's basis? */
export function inPfWage(s: Pick<SalaryStructure, "pfBasis">, c: SalaryComponent): boolean {
  if (s.pfBasis === "gross_excl_hra") return c.key !== "hra";
  if (s.pfBasis === "basic") return c.inPfWages;
  return false;
}

/** Full-month PF wages for a structure (before proration). */
export function monthlyPfWage(s: Pick<SalaryStructure, "basic" | "components" | "pfBasis">): number {
  if (s.pfBasis === "none") return 0;
  return s.basic + s.components.filter((c) => inPfWage(s, c)).reduce((t, c) => t + c.amount, 0);
}

/** A NO-PF employee brought under PF is put on 12%-Basic, limited to the ceiling. */
export function coveredStructure<T extends Pick<SalaryStructure, "pfBasis" | "pfLimit">>(s: T, newlyCovered: boolean): T {
  return newlyCovered && s.pfBasis === "none" ? { ...s, pfBasis: "basic", pfLimit: "limit" } : s;
}

/** Full-month employee (= employer) PF for a structure, at the ceiling in force at the end of `month`. */
export function setupPf(s: Pick<SalaryStructure, "basic" | "components" | "pfBasis" | "pfLimit">, month: MonthKey = CURRENT_MONTH): number {
  if (s.pfBasis === "none") return 0;
  const pf = Math.round(monthlyPfWage(s) * PF_RATE);
  const cap = pfCapOn(monthEnd(month));
  return s.pfLimit === "limit" && pf > cap ? cap : pf;
}

export function setupEsi(s: Pick<SalaryStructure, "basic" | "components" | "esiEnabled">): number {
  const gross = structureGross(s);
  return s.esiEnabled && gross <= ESI_WAGE_LIMIT ? Math.ceil(gross * ESI_EMPLOYEE_RATE) : 0;
}

/** CTC per month = gross + employer PF + employer ESI. */
export function setupCtc(s: Pick<SalaryStructure, "basic" | "components" | "pfBasis" | "pfLimit" | "esiEnabled">, month: MonthKey = CURRENT_MONTH): number {
  const gross = structureGross(s);
  const employerEsi = s.esiEnabled && gross <= ESI_WAGE_LIMIT ? Math.ceil(gross * ESI_EMPLOYER_RATE) : 0;
  return gross + setupPf(s, month) + employerEsi;
}

/** The structure in force for a month: the latest one effective on or before it. */
export function salaryFor(structures: SalaryStructure[], employeeId: string, month: MonthKey): SalaryStructure | undefined {
  return structures
    .filter((s) => s.employeeId === employeeId && compareMonths(s.effectiveFrom, month) <= 0)
    .sort((a, b) => compareMonths(b.effectiveFrom, a.effectiveFrom))[0];
}

export function latestSalary(structures: SalaryStructure[], employeeId: string): SalaryStructure | undefined {
  return structures.filter((s) => s.employeeId === employeeId).sort((a, b) => compareMonths(b.effectiveFrom, a.effectiveFrom))[0];
}

/** Is the employee on the rolls at any point in the month? */
export function employedInMonth(e: Employee, month: MonthKey): boolean {
  return e.doj <= monthEnd(month) && (!e.dateOfExit || e.dateOfExit >= monthStart(month));
}

/** Calendar days in [from, to] of the month the employee was on the rolls. */
export function employedDaysBetween(e: Employee, month: MonthKey, from: number, to: number): number {
  if (!employedInMonth(e, month)) return 0;
  const start = Math.max(from, e.doj > monthStart(month) ? Number(e.doj.slice(8)) : 1);
  const end = Math.min(to, e.dateOfExit && e.dateOfExit < monthEnd(month) ? Number(e.dateOfExit.slice(8)) : daysInMonth(month));
  return Math.max(0, end - start + 1);
}

export function employedDays(e: Employee, month: MonthKey): number {
  return employedDaysBetween(e, month, 1, daysInMonth(month));
}

/** Day ranges the month's PF is worked out over: two for the revision month, one otherwise. */
export function pfSegments(month: MonthKey): { label: string; from: number; to: number }[] {
  const D = daysInMonth(month);
  const m = parseMonth(month).monthIndex;
  const name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m];
  if (month !== REVISION_MONTH) return [{ label: `1–${D} ${name}`, from: 1, to: D }];
  return [
    { label: `1–${REVISION_DAY - 1} ${name}`, from: 1, to: REVISION_DAY - 1 },
    { label: `${REVISION_DAY}–${D} ${name}`, from: REVISION_DAY, to: D },
  ];
}

/** Is the revision month in scope and on which basis? Months before it use the old ceiling throughout. */
function segmentCeiling(month: MonthKey, segFrom: number, basis: SepBasis | undefined): number {
  if (month !== REVISION_MONTH) return pfCeilingOn(monthStart(month));
  if (basis === "old") return OLD_CEILING;
  return segFrom >= REVISION_DAY ? NEW_CEILING : OLD_CEILING;
}

/** Did the revision bring this employee under PF? (NO-PF, PF wage on 17 Sep ≤ new ceiling, on the rolls from 17 Sep.) */
export function isNewlyCovered(e: Employee, revisionStructure: SalaryStructure | undefined): boolean {
  if (e.pfCoveredFrom) return true;
  if (!revisionStructure || revisionStructure.pfBasis !== "none" || e.internationalWorker) return false;
  if (e.dateOfExit && e.dateOfExit < PF_REVISION.from) return false;
  return monthlyPfWage(coveredStructure(revisionStructure, true)) <= NEW_CEILING;
}

/** Does G.S.R. 847(E) bring this non-EPS member under EPS from 17 Sep? */
export function joinsEps(e: Employee, revisionStructure: SalaryStructure | undefined): boolean {
  if (e.epsFrom) return true;
  if (e.epsMember !== false || !revisionStructure) return false;
  return monthlyPfWage(revisionStructure) <= NEW_CEILING;
}

export interface CoverageFlags {
  /** Excluded employee covered from the revision date. */
  newlyCovered: boolean;
  /** Non-EPS member who joins EPS from the revision date. */
  joinsEps: boolean;
}

export function computePay({
  employee,
  salary,
  state,
  month,
  payableDays,
  halves,
  sepBasis,
  coverage = { newlyCovered: false, joinsEps: false },
  benefits = [],
  deductions = [],
  employerAdjustments = [],
}: {
  employee: Employee;
  salary: SalaryStructure;
  state: string;
  month: MonthKey;
  payableDays: number;
  /** Payable days per PF segment (September only); defaults to employed-day proportion. */
  halves?: number[];
  sepBasis?: SepBasis;
  coverage?: CoverageFlags;
  benefits?: OneTimeItem[];
  deductions?: OneTimeItem[];
  employerAdjustments?: OneTimeItem[];
}): PayRecord {
  const D = daysInMonth(month);
  const ratio = Math.min(payableDays, D) / D;
  const prorate = (amount: number, pay: SalaryComponent["pay"] = "prorated") => (payableDays <= 0 ? 0 : pay === "standard" ? amount : amount * ratio);

  const earnings = [
    { key: "basic", name: "Basic", monthly: salary.basic, earned: Math.round(prorate(salary.basic)) },
    ...salary.components.map((c) => ({ key: c.key, name: c.name, monthly: c.amount, earned: Math.round(prorate(c.amount, c.pay)) })),
  ];
  const grossMonthly = structureGross(salary);
  const grossEarned = earnings.reduce((t, e) => t + e.earned, 0);

  // Coverage only changes from the revision month on, and not when September is run on the old ceiling.
  const afterRevision = compareMonths(month, REVISION_MONTH) >= 0 && !(month === REVISION_MONTH && sepBasis === "old");
  const newlyCovered = afterRevision && coverage.newlyCovered && salary.pfBasis === "none";
  const pfStructure = coveredStructure(salary, newlyCovered);
  const W = monthlyPfWage(pfStructure);
  const age58 = ageOn(employee.dob, monthStart(month)) >= EPS_AGE_LIMIT;

  const segs = pfSegments(month);
  const employed = segs.map((s) => employedDaysBetween(employee, month, s.from, s.to));
  const coveredDays = segs.map((s, i) => (pfStructure.pfBasis === "none" ? 0 : newlyCovered && s.to < REVISION_DAY ? 0 : employed[i]));
  const E = coveredDays.reduce((t, d) => t + d, 0);
  const paid = halves && halves.length === segs.length ? halves : splitPayable(payableDays, employed);

  const segments: PfSegment[] = segs.map((s, i) => {
    const ceiling = segmentCeiling(month, s.from, sepBasis);
    const covered = coveredDays[i] > 0;
    const wage = covered ? (W * Math.min(paid[i], employed[i])) / D : 0;
    const cap = E > 0 ? (ceiling * coveredDays[i]) / E : 0;
    const capped = Math.min(wage, cap);
    const pfWage = employee.internationalWorker || pfStructure.pfLimit === "no_limit" ? wage : capped;
    // A non-EPS member brought into EPS counts from 17 Sep in September, and for the whole month after.
    const joinedEps = afterRevision && coverage.joinsEps && (month !== REVISION_MONTH || s.from >= REVISION_DAY);
    const epsEligible = !age58 && (employee.epsMember !== false || joinedEps);
    return { label: s.label, from: s.from, to: s.to, ceiling, coveredDays: coveredDays[i], payableDays: paid[i], wage, cap, pfWage, epsWage: epsEligible ? capped : 0 };
  });

  const pfWage = segments.reduce((t, s) => t + s.pfWage, 0);
  const epsWage = segments.reduce((t, s) => t + s.epsWage, 0);
  const edliWage = segments.reduce((t, s) => t + Math.min(s.wage, s.cap), 0);
  const employeePf = Math.round(pfWage * PF_RATE);
  const employerPf = employeePf;
  const eps = Math.min(employerPf, Math.round(epsWage * EPS_RATE));
  const edli = Math.round(edliWage * EDLI_RATE);

  const esiApplies = salary.esiEnabled && grossMonthly <= ESI_WAGE_LIMIT;
  const employeeEsi = esiApplies ? Math.ceil(grossEarned * ESI_EMPLOYEE_RATE) : 0;
  const employerEsi = esiApplies ? Math.ceil(grossEarned * ESI_EMPLOYER_RATE) : 0;

  const pt = grossEarned > 0 ? professionalTax(state, grossMonthly, parseMonth(month).monthIndex) : 0;
  const tds = grossEarned > 0 ? monthlyTds(grossMonthly) : 0;

  const benefitTotal = benefits.reduce((t, b) => t + b.amount, 0);
  const deductionTotal = deductions.reduce((t, d) => t + d.amount, 0);
  const payout = Math.max(0, grossEarned + benefitTotal - employeePf - employeeEsi - pt - tds - deductionTotal);

  return {
    employeeId: employee.id,
    month,
    payableDays,
    daysInMonth: D,
    earnings,
    benefits,
    deductions,
    grossMonthly,
    grossEarned: grossEarned + benefitTotal,
    pfWage: Math.round(pfWage),
    epsWage: Math.round(epsWage),
    edliWage: Math.round(edliWage),
    employeePf,
    employerPf,
    eps,
    employerEpf: employerPf - eps,
    edli,
    segments: month === REVISION_MONTH ? segments : undefined,
    newlyCovered: newlyCovered || undefined,
    sepBasis: month === REVISION_MONTH ? (sepBasis ?? "old") : undefined,
    employerAdjustments: employerAdjustments.length ? employerAdjustments : undefined,
    employeeEsi,
    employerEsi,
    pt,
    tds,
    ctc: setupCtc(pfStructure, month),
    payout,
  };
}

/** Has anything that's paid, deducted or deposited changed between two records? (Ignores breakdown-only fields.) */
export function samePay(a: PayRecord, b: PayRecord): boolean {
  const key = (r: PayRecord) =>
    JSON.stringify([
      Math.round(r.payableDays * 100),
      r.grossEarned,
      r.employeePf,
      r.employerPf,
      r.eps ?? null,
      r.employeeEsi,
      r.employerEsi,
      r.pt,
      r.tds,
      r.payout,
      r.deductions,
      r.benefits,
      r.employerAdjustments ?? [],
    ]);
  return key(a) === key(b);
}

/** Spread loss-of-pay across segments in proportion to employed days (the default for manual payable days). */
export function splitPayable(total: number, employed: number[]): number[] {
  const all = employed.reduce((t, d) => t + d, 0);
  if (all === 0) return employed.map(() => 0);
  const lop = Math.max(0, all - total);
  // Full precision — the PF wage is rounded once, at the end.
  return employed.map((d) => d - (lop * d) / all);
}
