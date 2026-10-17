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
  PfBasis,
  PfLimit,
  SalaryComponent,
  SalaryStructure,
} from "./types";
import { defaultSplit } from "./payroll";

// Seed for the HRMS prototype. Employees are chosen so the PF wage-ceiling scenarios in
// HANDOFF-pf-wage-ceiling.md each have someone to look at: wages either side of ₹15k / ₹25k,
// No Limit, mid-September joiners, a NO-PF employee who becomes newly covered, an exit on
// 10 Sep, a 58+ employee, and the "12% gross excluding HRA" basis.

export const SEED_BRANCHES: Branch[] = [
  { id: "br-mum", name: "Mumbai", state: "MAHARASHTRA" },
  { id: "br-blr", name: "Bengaluru", state: "KARNATAKA" },
  { id: "br-kochi", name: "Kochi", state: "KERALA" },
  { id: "br-del", name: "Ledgers Delhi branch", state: "DELHI" },
  { id: "br-che", name: "Chennai", state: "TAMIL NADU" },
];

export const SEED_HR_SETTINGS: HrSettings = {
  pfRegistrationNumber: "MHBAN0012345000",
  esiRegistrationNumber: "",
  payrollCycleStartDay: 1,
  restrictAttendanceIp: true,
  allowedIps: ["114.143.62.62"],
  checkInLocationRequired: true,
};

export const LEAVE_TYPES = [
  { key: "cl", name: "Casual Leave" },
  { key: "el", name: "Earned Leave" },
  { key: "sl", name: "Sick Leave" },
  { key: "wfh", name: "Work From Home" },
  { key: "ml", name: "Maternity Leave" },
  { key: "pl", name: "Paternity Leave" },
];

export const SEED_LEAVE_POLICIES: LeavePolicy[] = [
  {
    id: "lp-48",
    name: "Leave Policy",
    active: true,
    applicableFrom: "2025-11-26",
    duration: "CalendarYear",
    allocation: {
      cl: { applicable: true, frequency: "annually", creditDate: "beginning_of_year", creditValue: 8, probationMonths: 0 },
      el: { applicable: true, frequency: "monthly", creditDate: "first_day_of_month", creditValue: 15, probationMonths: 0, carryForwardLimit: 15 },
      sl: { applicable: true, frequency: "annually", creditDate: "beginning_of_year", creditValue: 5, probationMonths: 0 },
    },
  },
  {
    id: "lp-41",
    name: "Standard Leave Policy 2025",
    active: true,
    applicableFrom: "2025-10-03",
    duration: "CalendarYear",
    allocation: {
      cl: { applicable: true, frequency: "monthly", creditDate: "beginning_of_year", creditValue: 12, probationMonths: 3 },
      sl: { applicable: true, frequency: "monthly", creditDate: "beginning_of_year", creditValue: 6, probationMonths: 3 },
      wfh: { applicable: true, frequency: "quarterly", creditDate: "beginning_of_year", creditValue: 2, probationMonths: 3 },
      ml: { applicable: true, frequency: "monthly", creditDate: "first_day_of_month", creditValue: 60, probationMonths: 3 },
      pl: { applicable: true, frequency: "monthly", creditDate: "first_day_of_month", creditValue: 30, probationMonths: 3 },
    },
  },
];

const base = {
  status: "active" as const,
  employmentType: "Full Time" as const,
  shiftStart: "09:00",
  shiftEnd: "18:00",
  title: "Mr.",
  gender: "Male" as const,
  leavePolicyId: "lp-41",
};

export const SEED_EMPLOYEES: Employee[] = [
  { ...base, id: "e1", employeeId: "LD001", title: "Ms.", gender: "Female", name: "Ananya Rao", personalMobile: "9820011223", officeEmail: "ananya@demoledgers.in", dob: "1997-03-14", designation: "Accounts Executive", department: "Finance", branchId: "br-mum", doj: "2024-06-03", uan: "101234567801", pan: "BQRPR1234A", esiNumber: "3100123456" },
  { ...base, id: "e2", employeeId: "LD002", epsMember: false, name: "Rohit Sharma", personalMobile: "9845022334", officeEmail: "rohit@demoledgers.in", dob: "1993-07-21", designation: "Sales Manager", department: "Sales", branchId: "br-blr", doj: "2023-04-10", uan: "101234567802", pan: "AKLPS4521K", reportingTo: "e4" },
  { ...base, id: "e3", employeeId: "LD003", title: "Ms.", gender: "Female", name: "Priya Nair", personalMobile: "9895033445", officeEmail: "priya@demoledgers.in", dob: "1990-11-02", designation: "Product Lead", department: "Product", branchId: "br-kochi", doj: "2022-01-17", uan: "101234567803", pan: "AGHPN7789Q", reportingTo: "e4" },
  { ...base, id: "e4", employeeId: "LD004", name: "Vikram Singh", personalMobile: "9810044556", officeEmail: "vikram@demoledgers.in", dob: "1985-05-30", designation: "Head of Operations", department: "Operations", branchId: "br-del", doj: "2021-08-02", uan: "101234567804", pan: "ABKPS3344M" },
  { ...base, id: "e5", employeeId: "LD005", title: "Ms.", gender: "Female", name: "Meera Iyer", personalMobile: "9840055667", officeEmail: "meera@demoledgers.in", dob: "1995-09-12", designation: "Designer", department: "Product", branchId: "br-che", doj: "2025-02-03", pan: "CDRPI5566L", reportingTo: "e3" },
  { ...base, id: "e6", employeeId: "LD006", name: "Arjun Patel", personalMobile: "9820066778", officeEmail: "arjun@demoledgers.in", dob: "1999-12-25", designation: "Support Associate", department: "Support", branchId: "br-mum", doj: "2026-09-05", uan: "101234567806", reportingTo: "e4" },
  { ...base, id: "e7", employeeId: "LD007", title: "Ms.", gender: "Female", name: "Kavya Menon", personalMobile: "9895077889", officeEmail: "kavya@demoledgers.in", dob: "1998-04-08", designation: "Business Analyst", department: "Product", branchId: "br-kochi", doj: "2026-09-08", reportingTo: "e3" },
  { ...base, id: "e8", employeeId: "LD008", name: "Sanjay Gupta", personalMobile: "9810088990", officeEmail: "sanjay@demoledgers.in", dob: "1992-02-19", designation: "Engineer", department: "Engineering", branchId: "br-del", doj: "2026-09-20", uan: "101234567808", reportingTo: "e4" },
  { ...base, id: "e9", employeeId: "LD009", name: "Farhan Qureshi", status: "inactive", personalMobile: "9820099001", officeEmail: "farhan@demoledgers.in", dob: "1991-06-11", designation: "Engineer", department: "Engineering", branchId: "br-mum", doj: "2023-11-06", dateOfExit: "2026-09-10", uan: "101234567809", reportingTo: "e4" },
  { ...base, id: "e10", employeeId: "LD010", title: "Mrs.", gender: "Female", name: "Lakshmi Krishnan", personalMobile: "9845010112", officeEmail: "lakshmi@demoledgers.in", dob: "1966-08-01", designation: "Senior Accountant", department: "Finance", branchId: "br-blr", doj: "2019-07-01", uan: "101234567810", pan: "AAJPK1122C" },
  { ...base, id: "e11", employeeId: "LD011", title: "Ms.", gender: "Female", name: "Neha Joshi", personalMobile: "9820011223", officeEmail: "neha@demoledgers.in", dob: "1996-01-29", designation: "HR Executive", department: "HR", branchId: "br-mum", doj: "2024-10-01", uan: "101234567811" },
  { ...base, id: "e12", employeeId: "LD012", name: "Deepak Kumar", personalMobile: "9871012131", officeEmail: "deepak@demoledgers.in", dob: "2000-10-10", designation: "Intern", department: "Engineering", doj: "2026-10-01", employmentType: "Intern" },
  { ...base, id: "e13", employeeId: "LD013", title: "Ms.", gender: "Female", name: "Sneha Pillai", status: "inactive", personalMobile: "9895013141", officeEmail: "sneha@demoledgers.in", dob: "1994-03-03", designation: "Marketing Executive", department: "Marketing", branchId: "br-kochi", doj: "2022-05-02", dateOfExit: "2026-03-31" },
];

function salary(
  id: string,
  employeeId: string,
  effectiveFrom: MonthKey,
  gross: number,
  pfBasis: PfBasis,
  pfLimit: PfLimit,
  opts: { basic?: number; esi?: boolean; extra?: SalaryComponent[] } = {},
): SalaryStructure {
  const split = defaultSplit(gross);
  let components = split.components;
  let basic = split.basic;
  if (opts.basic !== undefined) {
    basic = opts.basic;
    const hra = Math.round(basic * 0.3);
    components = [
      { ...components[0], amount: hra },
      { ...components[1], amount: gross - basic - hra },
    ];
  }
  if (opts.extra) components = [...components, ...opts.extra];
  return { id, employeeId, effectiveFrom, gross, basic, zeroBasic: false, components, pfBasis, pfLimit, esiEnabled: !!opts.esi, createdOn: "2026-04-01" };
}

export const SEED_SALARIES: SalaryStructure[] = [
  salary("s1", "e1", "APR-2026", 20000, "basic", "limit", { basic: 12000, esi: true }),
  salary("s2", "e2", "APR-2026", 35000, "basic", "limit", { basic: 20000 }),
  salary("s3a", "e3", "APR-2025", 48000, "basic", "limit", { basic: 28000 }),
  salary("s3", "e3", "APR-2026", 52000, "basic", "limit", { basic: 30000 }),
  salary("s4", "e4", "APR-2026", 90000, "basic", "no_limit", { basic: 30000 }),
  salary("s5", "e5", "APR-2026", 36000, "none", "no_limit", { basic: 22000 }),
  salary("s6", "e6", "SEP-2026", 24000, "basic", "limit", { basic: 14000 }),
  salary("s7", "e7", "SEP-2026", 34000, "none", "no_limit", { basic: 20000 }),
  salary("s8", "e8", "SEP-2026", 40000, "basic", "limit", { basic: 24000 }),
  salary("s9", "e9", "APR-2026", 50000, "basic", "limit", { basic: 30000 }),
  salary("s10", "e10", "APR-2026", 48000, "basic", "limit", { basic: 30000 }),
  salary("s11", "e11", "APR-2026", 25000, "gross_excl_hra", "limit", { basic: 10000 }),
];

/**
 * Payable days entered by hand for a month (the Payable Days pop-up). Anyone not listed gets their
 * employed days less loss-of-pay absences from attendance.
 */
export const SEED_PAYABLE_OVERRIDES: Record<MonthKey, Record<string, number>> = {};

/** Unpaid absences (LOP) marked in attendance. */
export const SEED_ABSENCES: Record<string, string[]> = {
  e3: ["2026-09-22", "2026-09-23"],
  e7: ["2026-09-29", "2026-09-30"],
  e1: ["2026-08-11"],
  e2: ["2026-10-06"],
};

export const SEED_HOLIDAYS: { date: string; name: string }[] = [
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-10-02", name: "Gandhi Jayanti" },
  { date: "2026-10-20", name: "Dussehra" },
];

export const SEED_ONE_TIME: Record<MonthKey, Record<string, { benefits: OneTimeItem[]; deductions: OneTimeItem[] }>> = {
  "SEP-2026": { e2: { benefits: [{ name: "Incentive", amount: 5000 }], deductions: [] }, e1: { benefits: [], deductions: [{ name: "LWF", amount: 25 }] } },
};

/** Months already run and paid in the seed. September was run on the old ceiling. */
export const SEED_RUN_MONTHS: MonthKey[] = ["APR-2026", "MAY-2026", "JUN-2026", "JUL-2026", "AUG-2026", "SEP-2026"];
/** Paid months (Salary Payment → Mark as Paid). September is paid; that's what makes re-runs interesting. */
export const SEED_PAID_MONTHS: MonthKey[] = ["APR-2026", "MAY-2026", "JUN-2026", "JUL-2026", "AUG-2026", "SEP-2026"];

export const SEED_LEAVE_APPLICATIONS: LeaveApplication[] = [
  { id: "la1", employeeId: "e3", type: "Casual Leave", from: "2026-09-14", to: "2026-09-15", days: 2, reason: "Family function", status: "approved" },
  { id: "la2", employeeId: "e2", type: "Sick Leave", from: "2026-10-12", to: "2026-10-12", days: 1, reason: "Fever", status: "approved" },
  { id: "la3", employeeId: "e1", type: "Casual Leave", from: "2026-10-20", to: "2026-10-21", days: 2, reason: "Travel", status: "pending" },
  { id: "la4", employeeId: "e7", type: "Work From Home", from: "2026-10-16", to: "2026-10-16", days: 1, reason: "Internet installation", status: "pending" },
];

export const SEED_NOTES: EmployeeNote[] = [
  { id: "n1", employeeId: "e9", text: "Resigned; last working day 10-Sep-2026. F&F pending.", createdOn: "2026-09-10" },
  { id: "n2", employeeId: "e5", text: "Opted out of PF at joining (PF wage above ₹15,000).", createdOn: "2025-02-03" },
];

export const SEED_DOCUMENTS: EmployeeDocument[] = [
  { id: "d1", employeeId: "e1", name: "Offer letter.pdf", uploadedOn: "2024-05-20" },
  { id: "d2", employeeId: "e1", name: "PAN card.jpg", uploadedOn: "2024-06-03" },
  { id: "d3", employeeId: "e3", name: "Form 11.pdf", uploadedOn: "2022-01-17" },
];

export const DEPARTMENTS = ["Finance", "Sales", "Product", "Operations", "Support", "Engineering", "HR", "Marketing"];
export const TITLES = ["Mr.", "Mrs.", "Miss.", "Ms.", "Dr.", "M/s.", "Prof.", "CA.", "CS.", "CWA.", "ADV.", "ER.", "CMA."];
export const EMPLOYMENT_TYPES = ["Full Time", "Part Time", "Contract", "Intern", "Consultant"] as const;
