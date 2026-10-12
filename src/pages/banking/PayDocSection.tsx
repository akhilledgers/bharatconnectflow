import { useNavigate } from "react-router-dom";
import { BadgeCheck, Clock } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useBankingStore } from "../../store/useBankingStore";
import { CONNECTED_BANKING, last4 } from "./data";
import { paymentLabel, useDocPayment, usePayDocs, type PayableDoc } from "./PayDocs";

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * "Pay" beside the status in a bill / expense voucher's due header. The supplier's account, which of yours it
 * goes from and the amount are all in the payment drawer it opens. Shown only while something is owed, nothing
 * is being paid yet, and a bank is connected.
 */
export function PayDocButton({ doc, payable }: { doc: PayableDoc; payable: boolean }) {
  const payDocs = usePayDocs();
  const payment = useDocPayment(doc.number);
  if (!payable || doc.due <= 0 || payment || !payDocs.canPay) return null;
  return (
    <>
      <Button size="sm" variant="primary" onClick={() => payDocs.pay([doc])}>
        Pay
      </Button>
      {payDocs.drawers}
    </>
  );
}

/** Once a document is being paid from the bank: one line on where that payment stands. */
export function PayDocStatus({ doc }: { doc: PayableDoc }) {
  const navigate = useNavigate();
  const payment = useDocPayment(doc.number);
  const accounts = useBankingStore((s) => s.accounts);
  if (!payment) return null;

  const a = accounts.find((x) => x.id === payment.fromAccountId);
  const bank = a ? (a.bankKey ? CONNECTED_BANKING[a.bankKey].short : a.bank) : "your bank";
  const from = a ? `${bank} ${last4(a.number)}` : bank;
  const detail =
    payment.status === "awaiting"
      ? `Waiting for the checker in ${bank} net banking`
      : `${payment.mode} from ${from}${payment.utr ? ` · UTR ${payment.utr}` : ""}`;

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
