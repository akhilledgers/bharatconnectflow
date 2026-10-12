import { useNavigate, useParams } from "react-router-dom";
import { ArrowDownToLine, Link, Printer, SquarePen, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Textarea } from "../../components/ui/input";
import { useStore } from "../../store/useStore";
import { useDocPayment } from "../banking/PayDocs";
import { PayDocSection } from "../banking/PayDocSection";
import { money } from "../invoices/kindConfig";
import { EXPENSE_VOUCHERS, voucherDoc, voucherTotal } from "./vouchers";

// As on LEDGERS' View Expense Voucher: the voucher on the left; on the right, what's due, paying it from a
// connected bank, and notes.
export function ExpenseVoucherViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const v = EXPENSE_VOUCHERS.find((x) => x.number === id);
  const payment = useDocPayment(id ?? "");

  if (!v) {
    return (
      <div className="rounded-xl border border-dashed border-input bg-card px-8 py-16 text-center">
        <div className="text-lg font-medium text-foreground">Expense voucher not found</div>
        <button onClick={() => navigate("/expenses/vouchers")} className="mt-3 text-sm font-medium text-primary hover:text-primary/80">
          Back to expense vouchers
        </button>
      </div>
    );
  }

  const total = voucherTotal(v);
  const paid = !!v.paidBy || payment?.status === "paid";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Voucher Number - <span># {v.number}</span>
        </span>
        <div className="flex items-center gap-2">
          {(
            [
              [Link, "Copy link"],
              [SquarePen, "Edit"],
              [Trash2, "Delete"],
              [ArrowDownToLine, "Download"],
              [Printer, "Print"],
            ] as const
          ).map(([Icon, label]) => (
            <Button key={label} variant="outline" size="icon" title={label} aria-label={label}>
              <Icon />
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-border bg-white p-8 text-[13px] text-gray-800 shadow-xs shadow-black/5">
          <div className="flex items-start justify-between border-b border-gray-200 pb-4">
            <div>
              <div className="text-base font-semibold">{business.name}</div>
              <div className="mt-1 text-xs text-gray-500">{business.gstin ? `GSTIN ${business.gstin}` : business.pan}</div>
            </div>
            <div className="text-right">
              <div className="text-base font-semibold tracking-wide">EXPENSE VOUCHER</div>
              <div className="mt-1 text-xs text-gray-500"># {v.number}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 py-4 text-xs">
            <div>
              <div className="text-gray-500">Paid to</div>
              <div className="mt-0.5 font-medium">{v.party}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-500">Payment date</div>
              <div className="mt-0.5 font-medium">{v.date}</div>
            </div>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="w-10 px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Particulars</th>
                <th className="px-2 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {v.items.map((it, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-2 py-2">{it.name}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{money(it.amount)}</td>
                </tr>
              ))}
              <tr>
                <td />
                <td className="px-2 py-3 text-right font-semibold">Total</td>
                <td className="px-2 py-3 text-right font-semibold tabular-nums">INR {money(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Card>
          <div className="flex items-center justify-between rounded-t-xl px-4 py-4" style={{ backgroundColor: paid ? "#EBFAF2" : "rgb(255, 238, 243)" }}>
            <h2 className="text-base font-semibold text-gray-800">
              INR {money(total)} {paid ? "Paid" : "Due"}
            </h2>
            <span className={`rounded-md px-3 py-1 text-xs text-white ${paid ? "bg-green-600" : "bg-red-500"}`}>{paid ? "Paid" : "Not Paid"}</span>
          </div>
          <div className="space-y-5 p-4">
            <PayDocSection doc={voucherDoc(v)} payable={!v.paidBy} />
            {v.paidBy && <div className="text-xs text-muted-foreground">Paid by {v.paidBy.toLowerCase()} on {v.date}</div>}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">Notes</h3>
              <Textarea placeholder="Add notes" rows={3} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
