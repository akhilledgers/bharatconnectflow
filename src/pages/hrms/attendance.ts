import type { AttendanceMark, Employee, LeaveApplication, MonthKey } from "./types";
import { TODAY, daysInMonth, parseMonth } from "./months";
import { employedDays, employedDaysBetween, pfSegments } from "./payroll";

// Attendance is derived, not stored: Sundays are week-offs, seeded holidays are holidays, approved
// leave applications are leave, seeded LOP dates are absent, everything else up to today is present.
// Payable days for a month = employed days − LOP absences (unless entered by hand).

export const MARK_STYLE: Record<AttendanceMark, { label: string; cls: string }> = {
  present: { label: "Present", cls: "bg-emerald-500 text-white" },
  late: { label: "Late", cls: "bg-amber-500 text-white" },
  absent: { label: "Absent", cls: "bg-red-500 text-white" },
  leave: { label: "Leave", cls: "bg-green-600 text-white" },
  holiday: { label: "Holiday", cls: "bg-violet-500 text-white" },
  weekoff: { label: "Week off", cls: "bg-zinc-200 text-zinc-600" },
};

export function isoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function markFor(
  e: Employee,
  date: string,
  ctx: { absences: Record<string, string[]>; holidays: { date: string }[]; leaves: LeaveApplication[] },
): AttendanceMark | null {
  if (date < e.doj || (e.dateOfExit && date > e.dateOfExit) || date > TODAY) return null;
  if (new Date(date).getDay() === 0) return "weekoff";
  if (ctx.holidays.some((h) => h.date === date)) return "holiday";
  if (ctx.leaves.some((l) => l.employeeId === e.id && l.status === "approved" && l.from <= date && date <= l.to)) return "leave";
  if (ctx.absences[e.id]?.includes(date)) return "absent";
  // A little lateness so the dashboard isn't all green.
  if (Number(date.slice(8)) % 9 === 0 && e.id.endsWith("2")) return "late";
  return "present";
}

export function lopDays(e: Employee, month: MonthKey, absences: Record<string, string[]>): number {
  const { year, monthIndex } = parseMonth(month);
  const prefix = isoDate(year, monthIndex, 1).slice(0, 8);
  return (absences[e.id] ?? []).filter((d) => d.startsWith(prefix) && d >= e.doj && (!e.dateOfExit || d <= e.dateOfExit)).length;
}

export function defaultPayableDays(e: Employee, month: MonthKey, absences: Record<string, string[]>): number {
  return Math.max(0, employedDays(e, month) - lopDays(e, month, absences));
}

/** Payable days per PF segment from attendance: employed days in the segment less LOP dated in it. */
export function payableBySegment(e: Employee, month: MonthKey, absences: Record<string, string[]>): number[] {
  const { year, monthIndex } = parseMonth(month);
  return pfSegments(month).map((s) => {
    const lop = (absences[e.id] ?? []).filter((d) => {
      const [y, m, day] = d.split("-").map(Number);
      return y === year && m === monthIndex + 1 && day >= s.from && day <= s.to && d >= e.doj && (!e.dateOfExit || d <= e.dateOfExit);
    }).length;
    return Math.max(0, employedDaysBetween(e, month, s.from, s.to) - lop);
  });
}

export function monthDates(month: MonthKey): string[] {
  const { year, monthIndex } = parseMonth(month);
  return Array.from({ length: daysInMonth(month) }, (_, i) => isoDate(year, monthIndex, i + 1));
}
