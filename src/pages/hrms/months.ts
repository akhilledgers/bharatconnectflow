import type { MonthKey } from "./types";

const NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** The prototype's "today" — matches the Demo Ledgers data it was modelled on. */
export const TODAY = "2026-10-15";
export const CURRENT_MONTH: MonthKey = "OCT-2026";

export function monthKey(year: number, monthIndex: number): MonthKey {
  return `${NAMES[monthIndex]}-${year}`;
}

export function parseMonth(key: MonthKey): { year: number; monthIndex: number } {
  const [m, y] = key.split("-");
  return { year: Number(y), monthIndex: NAMES.indexOf(m) };
}

export function daysInMonth(key: MonthKey): number {
  const { year, monthIndex } = parseMonth(key);
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** yyyy-mm-dd of the first / last day of the month. */
export function monthStart(key: MonthKey): string {
  const { year, monthIndex } = parseMonth(key);
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}
export function monthEnd(key: MonthKey): string {
  const { year, monthIndex } = parseMonth(key);
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(daysInMonth(key)).padStart(2, "0")}`;
}

/** Negative when a is before b. */
export function compareMonths(a: MonthKey, b: MonthKey): number {
  const pa = parseMonth(a);
  const pb = parseMonth(b);
  return pa.year * 12 + pa.monthIndex - (pb.year * 12 + pb.monthIndex);
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const { year, monthIndex } = parseMonth(key);
  const t = year * 12 + monthIndex + n;
  return monthKey(Math.floor(t / 12), t % 12);
}

export function monthOfDate(date: string): MonthKey {
  const [y, m] = date.split("-").map(Number);
  return monthKey(y, m - 1);
}

/** Financial-year months, APR → MAR, for the year containing `key`. */
export function fyMonths(key: MonthKey): MonthKey[] {
  const { year, monthIndex } = parseMonth(key);
  const start = monthIndex >= 3 ? year : year - 1;
  return Array.from({ length: 12 }, (_, i) => addMonths(monthKey(start, 3), i));
}

export function fyLabel(key: MonthKey): string {
  const { year, monthIndex } = parseMonth(key);
  const start = monthIndex >= 3 ? year : year - 1;
  return `${start}–${start + 1}`;
}

/** "SEP - 2026", as the payslip tab shows it. */
export function spacedMonth(key: MonthKey): string {
  return key.replace("-", " - ");
}

/** "08-09-2026" — LEDGERS shows dates dd-mm-yyyy. */
export function fmtDate(date?: string): string {
  if (!date) return "-";
  const [y, m, d] = date.split("-");
  return `${d}-${m}-${y}`;
}

export function inr(n: number): string {
  return `INR ${Math.round(n).toLocaleString("en-IN")}`;
}

export function num(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}

/** ₹67.11L style compact figure used on the payroll dashboard cards. */
export function lakhs(n: number): string {
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

export function ageOn(dob: string, on: string): number {
  const [y1, m1, d1] = dob.split("-").map(Number);
  const [y2, m2, d2] = on.split("-").map(Number);
  return y2 - y1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0);
}
