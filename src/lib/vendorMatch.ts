import type { Invoice, LedgerContact } from "../types";

// Who in LEDGERS' Contacts sent this bill. A sure match (same B2B ID or GSTIN) is mapped straight away; a likely
// one (same PAN in another state, or the same name) is suggested for the user to confirm; otherwise the user picks
// an existing contact or creates one. A contact is never created when one already exists.

export type VendorMatch =
  | { kind: "exact"; contact: LedgerContact; by: "B2B ID" | "GSTIN" }
  | { kind: "suggest"; contact: LedgerContact; by: "PAN" | "name" }
  | { kind: "none" };

const NOISE = /\b(m\/s|private|pvt|limited|ltd|llp|co|company|and|the)\b/g;
const normVendor = (s?: string) =>
  (s ?? "")
    .toLowerCase()
    .replace(/[.&,()-]/g, " ")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();

/** PAN is characters 3–12 of a GSTIN. */
const panOf = (c: { pan?: string; gstin?: string | null }) => c.pan ?? (c.gstin && c.gstin.length === 15 ? c.gstin.slice(2, 12) : undefined);

export function matchVendor(bill: Invoice, contacts: LedgerContact[]): VendorMatch {
  const byId = bill.counterpartyB2bId && contacts.find((c) => c.b2bId === bill.counterpartyB2bId);
  if (byId) return { kind: "exact", contact: byId, by: "B2B ID" };
  const byGstin = bill.counterpartyGstin && contacts.find((c) => c.gstin === bill.counterpartyGstin);
  if (byGstin) return { kind: "exact", contact: byGstin, by: "GSTIN" };

  const pan = panOf({ gstin: bill.counterpartyGstin });
  const byPan = pan && contacts.find((c) => panOf(c) === pan);
  if (byPan) return { kind: "suggest", contact: byPan, by: "PAN" };

  const name = normVendor(bill.counterpartyName);
  const byName =
    name &&
    contacts.find((c) =>
      [c.businessName, c.name, c.displayName].some((n) => {
        const m = normVendor(n);
        return m.length > 2 && (m === name || name.startsWith(m + " ") || m.startsWith(name + " "));
      }),
    );
  if (byName) return { kind: "suggest", contact: byName, by: "name" };
  return { kind: "none" };
}
