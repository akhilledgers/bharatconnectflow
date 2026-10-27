// The period filter shared by the bank view and the cash book in Transactions.

export type Period = "this-month" | "last-month" | "last-3" | "fy" | "custom";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-3", label: "Last 3 months" },
  { value: "fy", label: "This financial year" },
  { value: "custom", label: "Custom range" },
];

/** [from, to] for a period, as dates (inclusive). */
export function periodRange(p: Period, custom: { from: string; to: string }): [Date, Date] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = new Date(y, m, now.getDate());
  switch (p) {
    case "this-month":
      return [new Date(y, m, 1), today];
    case "last-month":
      return [new Date(y, m - 1, 1), new Date(y, m, 0)];
    case "last-3":
      return [new Date(y, m - 2, 1), today];
    case "fy":
      return [new Date(m >= 3 ? y : y - 1, 3, 1), today];
    case "custom":
      return [custom.from ? new Date(custom.from) : new Date(2000, 0, 1), custom.to ? new Date(custom.to) : today];
  }
}
