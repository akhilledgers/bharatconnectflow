import { useNavigate } from "react-router-dom";
import { BadgeCheck, Clock, IndianRupee } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useBankingStore } from "../../store/useBankingStore";
import { CONNECTED_BANKING, last4 } from "./data";
import { paymentLabel, useDocPayment, usePayDocs, type PayableDoc } from "./PayDocs";

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * On a bill or expense voucher: pay what's due straight from a connected bank, and once paid, where that
 * payment stands. Without a connected bank it points to Banking.
 */
export function PayDocSection({ doc, payable }: { doc: PayableDoc; payable: boolean }) {
  const navigate = useNavigate();
  const payDocs = usePayDocs();
  const payment = useDocPayment(doc.number);
  const accounts = useBankingStore((s) => s.accounts);

  if (payment) {
    const from = accounts.find((a) => a.id === payment.fromAccountId);
    const bank = from ? (from.bankKey ? CONNECTED_BANKING[from.bankKey].short : from.bank) : "your bank";
    const fromName = from ? `${bank} ${last4(from.number)}` : bank;
    const detail =
      payment.status === "awaiting"
        ? `Waiting for the checker in ${bank} net banking`
        : payment.status === "processing"
          ? `${payment.mode} from ${fromName}`
          : `From ${fromName}${payment.utr ? ` · UTR ${payment.utr}` : ""}`;
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
        <div className="min-w-0 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            {payment.status === "paid" ? <BadgeCheck className="size-3.5 text-green-600" /> : <Clock className="size-3.5 text-amber-500" />}
            {paymentLabel(payment)} · INR {money(payment.amount)}
          </div>
          <div className="mt-0.5 truncate text-muted-foreground">{detail}</div>
        </div>
        <button onClick={() => navigate("/banking?tab=payouts")} className="shrink-0 text-xs font-medium text-primary hover:underline">
          {payment.ref}
        </button>
      </div>
    );
  }

  if (!payable || doc.due <= 0) return null;
  return (
    <>
      {payDocs.canPay ? (
        <Button variant="primary" className="w-full" onClick={() => payDocs.pay([doc])}>
          <IndianRupee />
          Pay INR {money(doc.due)}
        </Button>
      ) : (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          Pay straight from your bank account
          <button onClick={() => navigate("/banking")} className="shrink-0 font-medium text-primary hover:underline">
            Connect bank
          </button>
        </div>
      )}
      {payDocs.drawers}
    </>
  );
}
