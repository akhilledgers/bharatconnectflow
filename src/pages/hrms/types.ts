// HRMS domain model — shaped after the live LEDGERS v4 HRMS API (hrms/employee, hrms/salary,
// hrms/payroll/review, hrms/payroll/run, hrms/settings/*), simplified to what the screens use.

/** "SEP-2026" — the month key LEDGERS uses everywhere in payroll. */
export type MonthKey = string;

export type EmployeeStatus = "active" | "inactive";
export type EmploymentType = "Full Time" | "Part Time" | "Contract" | "Intern" | "Consultant";

export interface Branch {
  id: string;
  name: string;
  /** State drives PT and the "location" column on the computation page. */
  state: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  title: string;
  name: string;
  status: EmployeeStatus;
  personalEmail?: string;
  personalMobile: string;
  officeEmail: string;
  officeMobile?: string;
  fathersName?: string;
  dob: string; // yyyy-mm-dd
  gender: "Male" | "Female" | "Other";
  aadhaar?: string;
  pan?: string;
  uan?: string;
  esiNumber?: string;
  designation?: string;
  department?: string;
  reportingTo?: string; // employee id
  employmentType: EmploymentType;
  shiftStart: string; // "09:00"
  shiftEnd: string;
  branchId?: string;
  doj: string; // yyyy-mm-dd
  dateOfExit?: string;
  presentAddress?: Address;
  permanentAddress?: Address;
  bank?: BankDetails;
  leavePolicyId?: string;
  religion?: string;
  bloodGroup?: string;
  maritalStatus?: string;
  /** EPF member who is not in EPS (pension). false = "non-EPS". Defaults to true. */
  epsMember?: boolean;
  /** Set when an excluded employee is brought under PF by the ceiling revision (yyyy-mm-dd). */
  pfCoveredFrom?: string;
  /** Set when a non-EPS member comes under EPS by G.S.R. 847(E). */
  epsFrom?: string;
  /** PF wage on 17-Sep-2026 — decides pension eligibility; recorded by the revision list. */
  pfWageOnRevision?: number;
  /** No ceiling logic applies to international workers. */
  internationalWorker?: boolean;
}

/** How a component is paid when the employee has loss-of-pay days. */
export type ComponentPay = "prorated" | "standard";

export interface SalaryComponent {
  key: string;
  name: string;
  amount: number;
  pay: ComponentPay;
  /** "Include in PF wages" on the Salary Setup screen. */
  inPfWages: boolean;
}

/** PF basis dropdown on Salary Setup. */
export type PfBasis = "none" | "gross_excl_hra" | "basic";
/** PF cap dropdown on Salary Setup ("No Limit" / "Limit to ₹1800"). */
export type PfLimit = "no_limit" | "limit";

export interface SalaryStructure {
  id: string;
  employeeId: string;
  /** First month this structure applies to (salary revisions are month-granular in LEDGERS). */
  effectiveFrom: MonthKey;
  gross: number;
  basic: number;
  zeroBasic: boolean;
  components: SalaryComponent[];
  pfBasis: PfBasis;
  pfLimit: PfLimit;
  esiEnabled: boolean;
  createdOn: string;
  /** Why the revision exists, when the system made it (e.g. "PF ceiling — CTC kept"). */
  reason?: string;
}

export interface OneTimeItem {
  name: string;
  amount: number;
}

/** One employee's line in a month's payroll (hrms/payroll/review → employees[]). */
export interface PayRecord {
  employeeId: string;
  month: MonthKey;
  payableDays: number;
  daysInMonth: number;
  /** Earned amount per component for the month, after proration. */
  earnings: { key: string; name: string; monthly: number; earned: number }[];
  benefits: OneTimeItem[];
  deductions: OneTimeItem[];
  grossMonthly: number;
  grossEarned: number;
  pfWage: number;
  epsWage: number;
  edliWage: number;
  employeePf: number;
  employerPf: number;
  /** Employer PF split: EPS (pension, 8.33% of EPS wages) and EPF (the rest). */
  eps: number;
  employerEpf: number;
  edli: number;
  /** September 2026 only: the two halves the PF was worked out on. */
  segments?: PfSegment[];
  /** Covered by PF only from the revision date (was NO-PF). */
  newlyCovered?: boolean;
  /** PF basis the month was computed on (September 2026 only). */
  sepBasis?: SepBasis;
  /** Employer-side one-off (e.g. September difference the employer pays), outside net pay. */
  employerAdjustments?: OneTimeItem[];
  /** Set when the September difference recovery was cut back by the net-pay floor. */
  recoveryHeldBack?: number;
  employeeEsi: number;
  employerEsi: number;
  pt: number;
  tds: number;
  ctc: number;
  payout: number;
}

/** How September 2026 PF is worked out (asked in the September run / re-run). */
export type SepBasis = "mid_month" | "old";
/** "Already paid?" in the September run. */
export type PaidAnswer = "not_paid" | "paid_as_here" | "paid_old";

export interface PfSegment {
  label: string; // "1–16 Sep"
  from: number;
  to: number;
  ceiling: number;
  /** Days employed and PF-covered in the segment. */
  coveredDays: number;
  payableDays: number;
  /** W × paid days ÷ days in month, before the ceiling. */
  wage: number;
  /** Ceiling share for the segment: ceiling × coveredDays ÷ covered days in month. */
  cap: number;
  pfWage: number;
  epsWage: number;
}

/** A September difference to settle in a later month (when September was paid on the old basis). */
export interface PfDifference {
  employeeId: string;
  fromMonth: MonthKey;
  employeePf: number;
  employerPf: number;
  eps: number;
  employerEpf: number;
  edli: number;
  /** Who bears the employee share. */
  payer: "employee" | "employer";
  /** First month the difference is settled in (the earliest month not yet paid). */
  recoverFrom: MonthKey;
  createdOn: string;
}

export type PaymentStatus = "pending" | "paid" | "zero";

export interface PaymentEntry {
  employeeId: string;
  paidAmount: number;
  paidOn?: string;
  mode?: string;
}

export interface PayrollRun {
  month: MonthKey;
  /** Each run inserts or updates per employee ({Inserted, Updated, No Changes} in v4). */
  records: Record<string, PayRecord>;
  runOn: string;
  payments: Record<string, PaymentEntry>;
  /** September 2026: basis and paid answer chosen at the last run. Undefined = old ceiling (pre-revision run). */
  sepBasis?: SepBasis;
  paidAnswer?: PaidAnswer;
  /** The record as originally paid, kept the first time a paid employee is re-run (what corrections compare against). */
  paidRecords?: Record<string, PayRecord>;
}

export type AttendanceMark = "present" | "absent" | "leave" | "holiday" | "weekoff" | "late";

export interface LeaveType {
  key: string;
  name: string;
}

export interface LeaveAllocation {
  applicable: boolean;
  frequency: "monthly" | "quarterly" | "annually";
  creditDate: "beginning_of_year" | "first_day_of_month";
  creditValue: number;
  probationMonths: number;
  carryForwardLimit?: number;
}

export interface LeavePolicy {
  id: string;
  name: string;
  active: boolean;
  applicableFrom: string;
  duration: "CalendarYear" | "FinancialYear";
  allocation: Record<string, LeaveAllocation>;
}

export interface LeaveApplication {
  id: string;
  employeeId: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
}

export interface HrSettings {
  pfRegistrationNumber: string;
  esiRegistrationNumber: string;
  /** Day of month the payroll cycle starts (LEDGERS "Payroll Cycle" select). */
  payrollCycleStartDay: number;
  restrictAttendanceIp: boolean;
  allowedIps: string[];
  checkInLocationRequired: boolean;
}

export interface EmployeeNote {
  id: string;
  employeeId: string;
  text: string;
  createdOn: string;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  name: string;
  uploadedOn: string;
}
