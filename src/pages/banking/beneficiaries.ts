import { useBankingStore } from "../../store/useBankingStore";
import type { PayFromAccount } from "./data";

/** Whether every payee in `keys` is an active beneficiary on this Pay From account (always true for banks without a list). */
export function useBeneficiariesReady(payFrom: PayFromAccount, keys: string[]) {
  const list = useBankingStore((s) => s.beneficiaries[payFrom.id]);
  return !payFrom.needsBeneficiary || keys.every((k) => list?.[k]?.status === "active");
}

/** The beneficiary-list key for a payee, matching the bulk drawer's row keys. */
export function payeeKey(b: { kind: "contact"; contactId: string; accountId: string } | { kind: "employee"; employeeId: string } | { kind: "other"; name: string; ifsc: string }) {
  return b.kind === "contact" ? `contact:${b.contactId}:${b.accountId}` : b.kind === "employee" ? `employee:${b.employeeId}` : `other:${b.ifsc}:${b.name}`;
}

/** Beneficiary codes: letters and digits only, upper case. */
export const cleanCode = (v: string, max: number) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max);

/** A code suggested from the payee's name (e.g. Rohan Mehta → ROHANMEHTA), made unique against codes already taken. */
export function suggestCode(name: string, taken: Set<string>, max: number) {
  const base = cleanCode(name.replace(/\b(pvt|private|ltd|limited|llp)\b/gi, ""), max) || "PAYEE";
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const c = base.slice(0, max - String(i).length) + i;
    if (!taken.has(c)) return c;
  }
}
