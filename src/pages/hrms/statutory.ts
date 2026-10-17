// Statutory parameters, effective-dated. v4 hardcodes the ₹1,800 cap (frontend) and ₹15,000 EPS/EDLI
// wages (backend PF report); here every ceiling-derived figure comes from PF_CEILINGS, so the next
// revision is one new row.

export const PF_RATE = 0.12;
export const EPS_RATE = 0.0833;
export const EDLI_RATE = 0.005;
/** No EPS from age 58. */
export const EPS_AGE_LIMIT = 58;

/** PF / EPS / EDLI wage ceiling, by the date it takes effect. */
export const PF_CEILINGS: { from: string; ceiling: number; notification: string }[] = [
  { from: "2014-09-01", ceiling: 15000, notification: "G.S.R. 609(E)" },
  // S.O. 5109(E), Gazette 17-Sep-2026. G.S.R. 847(E): non-EPS members with wages ≤ ceiling on this date come under EPS.
  { from: "2026-09-17", ceiling: 25000, notification: "S.O. 5109(E)" },
];

export const PF_REVISION = PF_CEILINGS[PF_CEILINGS.length - 1];

export function pfCeilingOn(date: string): number {
  let c = PF_CEILINGS[0].ceiling;
  for (const r of PF_CEILINGS) if (r.from <= date) c = r.ceiling;
  return c;
}

/** "Limit to PF ceiling" cap on the employee (and employer) share = 12% of the ceiling. */
export function pfCapOn(date: string): number {
  return Math.round(pfCeilingOn(date) * PF_RATE);
}

export const ESI_WAGE_LIMIT = 21000;
export const ESI_EMPLOYEE_RATE = 0.0075;
export const ESI_EMPLOYER_RATE = 0.0325;

/** October take-home flag: recovery may not take net pay more than this far below September's paid net. */
export const NET_PAY_FLOOR_DROP = 0.1;

/** Monthly professional tax by state — a simplified slab table for the prototype. */
export function professionalTax(state: string, monthlyGross: number, monthIndex: number): number {
  switch (state.toUpperCase()) {
    case "MAHARASHTRA":
      if (monthlyGross <= 7500) return 0;
      if (monthlyGross <= 10000) return 175;
      return monthIndex === 1 ? 300 : 200; // ₹300 in February
    case "KARNATAKA":
      return monthlyGross >= 25000 ? 200 : 0;
    case "KERALA":
      // Collected half-yearly, in September and March.
      if (monthIndex !== 8 && monthIndex !== 2) return 0;
      return monthlyGross >= 30000 ? 600 : monthlyGross >= 18000 ? 180 : 0;
    case "TAMIL NADU":
      // Half-yearly too; collected in September and March.
      if (monthIndex !== 8 && monthIndex !== 2) return 0;
      return monthlyGross >= 21000 ? 1250 : monthlyGross >= 12500 ? 690 : 0;
    default:
      return 0;
  }
}

/** Rough monthly TDS under the new regime (FY 2026-27 slabs, ₹75k standard deduction, 87A rebate). */
export function monthlyTds(monthlyGross: number): number {
  const taxable = Math.max(0, monthlyGross * 12 - 75000);
  if (taxable <= 1200000) return 0;
  const slabs: [number, number][] = [
    [400000, 0],
    [800000, 0.05],
    [1200000, 0.1],
    [1600000, 0.15],
    [2000000, 0.2],
    [2400000, 0.25],
    [Infinity, 0.3],
  ];
  let tax = 0;
  let prev = 0;
  for (const [upto, rate] of slabs) {
    if (taxable > prev) tax += (Math.min(taxable, upto) - prev) * rate;
    prev = upto;
  }
  return Math.round((tax * 1.04) / 12);
}
