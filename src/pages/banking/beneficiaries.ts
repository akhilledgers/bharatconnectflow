import { useBankingStore } from "../../store/useBankingStore";
import type { PayFromAccount } from "./data";

/** Whether every payee in `keys` is an active beneficiary on this Pay From account (always true for banks without a list). */
export function useBeneficiariesReady(payFrom: PayFromAccount, keys: string[]) {
  const list = useBankingStore((s) => s.beneficiaries[payFrom.id]);
  return !payFrom.needsBeneficiary || keys.every((k) => list?.[k] === "active");
}

/** The beneficiary-list key for a payee, matching the bulk drawer's row keys. */
export function payeeKey(b: { kind: "contact"; contactId: string; accountId: string } | { kind: "employee"; employeeId: string } | { kind: "other"; name: string; ifsc: string }) {
  return b.kind === "contact" ? `contact:${b.contactId}:${b.accountId}` : b.kind === "employee" ? `employee:${b.employeeId}` : `other:${b.ifsc}:${b.name}`;
}
