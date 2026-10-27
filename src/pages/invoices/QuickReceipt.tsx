import { useStore } from "../../store/useStore";
import { receiptValue } from "../../lib/receipts";
import type { BusinessType, Invoice } from "../../types";
import { RecordMoney } from "../banking/RecordMoney";
import { useDocPayment } from "../banking/PayDocs";
import { billNumber } from "./payBill";

/**
 * Record a receipt (sales invoice) or a payment already made (bill) from the document itself, as on LEDGERS'
 * right-hand card. Either way it's kept on the document as a receipt row and lands in Banking.
 */
export function QuickReceipt({ invoice, businessType }: { invoice: Invoice; businessType: BusinessType }) {
  const sales = invoice.kind === "sales";
  // A bill being paid from the bank through LEDGERS shows that payment instead.
  const payment = useDocPayment(billNumber(invoice));
  const due = Math.max(0, Math.round((invoice.amount - (invoice.receipts ?? []).reduce((s, r) => s + receiptValue(r), 0)) * 100) / 100);
  if (!sales && payment) return null;
  const card = (
    <RecordMoney
      direction={sales ? "in" : "out"}
      due={due}
      party={invoice.counterpartyName}
      doc={`${sales ? "invoice" : "bill"} ${invoice.billNo ?? invoice.id}`}
      businessType={businessType}
      onRecorded={(r) =>
        useStore.getState().recordReceipt(invoice.id, {
          id: r.ref.replace(/^(REC|VOU) /, ""),
          date: r.date,
          amount: r.amount,
          mode: r.mode,
          depositTo: r.accountLabel,
          reference: r.reference,
          tds: r.tds,
          deductions: r.deductions,
          receivedIn: r.accountId,
        })
      }
    />
  );
  return sales ? (
    card
  ) : (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Paid outside LEDGERS? Record it</div>
      {card}
    </div>
  );
}
