import { useState, type ReactNode } from "react";
import { useStore } from "../../store/useStore";
import { useBankingStore, usePayFromAccounts } from "../../store/useBankingStore";
import { BulkTransferDrawer, type BulkPreset } from "./BulkTransferDrawer";
import { SingleTransferDrawer, type SingleTransferPreset } from "./SingleTransferDrawer";
import { maskIfsc, type Bill, type BulkRow } from "./data";
import type { Payout } from "./ledgerData";

/** A bill or expense voucher that can be paid straight from where it's listed or viewed. */
export interface PayableDoc {
  number: string;
  party: string;
  date: string;
  dueDate?: string;
  /** What's still owed on it. */
  due: number;
}

type Flow = { kind: "none" } | { kind: "single"; preset: SingleTransferPreset } | { kind: "bulk"; preset: BulkPreset };

const LIVE: Payout["status"][] = ["awaiting", "processing", "paid"];

/** The payment made on this document from Banking, if one is waiting, on its way or done. */
export function useDocPayment(number: string): Payout | undefined {
  return useBankingStore((s) => s.payouts.find((p) => p.docs?.includes(number) && LIVE.includes(p.status)));
}

/** One line on where a document's bank payment stands, for lists and the view page. */
export function paymentLabel(p: Payout) {
  if (p.status === "awaiting") return "Awaiting approval";
  if (p.status === "processing") return "Payment on its way";
  return "Paid from bank";
}

const toBill = (d: PayableDoc): Bill => ({ id: `doc:${d.number}`, number: d.number, date: d.date, dueDate: d.dueDate ?? d.date, amount: d.due });

/**
 * Pay bills / expense vouchers with the Banking payment drawers. One supplier opens New payment with the
 * documents and amount filled in (or on adding their bank account, if they have none); several open bulk
 * transfer, one row per supplier.
 */
export function usePayDocs() {
  const accounts = usePayFromAccounts();
  const [flow, setFlow] = useState<Flow>({ kind: "none" });
  const toast = useStore.getState().pushToast;

  const pay = (docs: PayableDoc[]) => {
    const open = docs.filter((d) => d.due > 0);
    if (!open.length || !accounts.length) return;
    const store = useBankingStore.getState;
    const groups = new Map<string, PayableDoc[]>();
    for (const d of open) groups.set(d.party, [...(groups.get(d.party) ?? []), d]);
    const sum = (ds: PayableDoc[]) => ds.reduce((s, d) => s + d.due, 0);

    const resolved = [...groups].map(([party, ds]) => {
      const contactId = store().vendorForDocs(party, ds.map(toBill));
      const contact = store().contacts.find((c) => c.id === contactId)!;
      return { contact, docs: ds };
    });

    if (resolved.length === 1) {
      const { contact, docs: ds } = resolved[0];
      const account = contact.accounts[0];
      setFlow({
        kind: "single",
        preset: {
          ...(account ? { beneficiary: { kind: "contact", contactId: contact.id, accountId: account.id } } : { addAccountFor: contact.id }),
          billIds: ds.map((d) => toBill(d).id),
          amount: String(sum(ds)),
        },
      });
      return;
    }

    const bulkFrom = accounts.find((a) => a.bulkSupported);
    if (!bulkFrom) return toast("Paying several suppliers at once needs an IndusInd or Axis account. Pay them one by one.", "error");
    const skipped = resolved.filter((r) => !r.contact.accounts.length).map((r) => r.contact.name);
    const rows: BulkRow[] = resolved
      .filter((r) => r.contact.accounts.length)
      .map(({ contact, docs: ds }, i) => {
        const a = contact.accounts[0];
        return {
          id: `r${Date.now()}${i}`,
          key: `contact:${contact.id}:${a.id}`,
          name: contact.name,
          bank: a.bank,
          maskedIfsc: maskIfsc(a.ifsc),
          verified: a.verified,
          amount: String(sum(ds)),
          ifscValid: true,
          docs: ds.map((d) => d.number),
        };
      });
    if (skipped.length) toast(`${skipped.join(", ")} ${skipped.length > 1 ? "have" : "has"} no bank account yet, so left out. Pay from the bill.`, "error");
    if (rows.length) setFlow({ kind: "bulk", preset: { payFromId: bulkFrom.id, rows } });
  };

  const close = () => setFlow({ kind: "none" });
  const drawers: ReactNode =
    flow.kind === "single" ? (
      <SingleTransferDrawer
        preset={flow.preset}
        onClose={close}
        onSwitchToBulk={(payFromId, carry) => setFlow({ kind: "bulk", preset: { payFromId, rows: carry ? [{ ...carry, id: `r${Date.now()}`, ifscValid: true }] : [] } })}
      />
    ) : flow.kind === "bulk" ? (
      <BulkTransferDrawer preset={flow.preset} onClose={close} />
    ) : null;

  return { pay, drawers, canPay: accounts.length > 0 };
}
