import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDownToLine, Copy, Link, Printer, SquarePen, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { useDocPaid } from "../banking/PayDocs";
import { PayDocSection } from "../banking/PayDocSection";
import { amountInWords } from "../invoices/invoiceDoc";
import { money } from "../invoices/kindConfig";
import { NotesSection } from "../invoices/NotesCard";
import type { Invoice, InvoiceNote } from "../../types";
import { EXPENSE_VOUCHERS, voucherDoc, voucherTotal, type ExpenseVoucher } from "./vouchers";

// Same layout as View Bill: the printed voucher (LEDGERS' "Formal" template) on the left, and one card on the
// right with what's due, the Payment section (pay from a connected bank, or record a payment) and notes.
const LINE = "border-[#b6b4b4]";
const TH = "bg-[lightgray] px-[5px] py-[3px] font-normal";
const TD = `border-b ${LINE} px-[5px] py-[3px]`;
const money2 = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ExpenseVoucherViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const v = EXPENSE_VOUCHERS.find((x) => x.number === id);
  const paidHere = useDocPaid(id ?? "");

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
  const paid = !!v.paidBy || paidHere;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          View Expense Voucher - <span># {v.number}</span>
        </span>
        <div className="flex items-center gap-2">
          {(
            [
              [SquarePen, "Edit"],
              [Link, "Copy link"],
              [Copy, "Copy Expense Voucher"],
              [Trash2, "Delete"],
              [Printer, "Print"],
              [ArrowDownToLine, "Download"],
            ] as const
          ).map(([Icon, label]) => (
            <Button key={label} variant="outline" size="icon" title={label} aria-label={label}>
              <Icon />
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_420px]">
        <div className="relative overflow-hidden rounded-lg border border-border bg-white shadow-xs shadow-black/5">
          <PrintedVoucher voucher={v} paid={paid} />
        </div>

        <Card>
          <div className="flex items-center justify-between rounded-t-xl px-4 py-4" style={{ backgroundColor: paid ? "#EBFAF2" : "rgb(255, 238, 243)" }}>
            <h2 className="text-base font-semibold text-gray-800">
              INR {money2(total)} {paid ? "Paid" : "Due"}
            </h2>
            <span className={`rounded-md px-3 py-1 text-xs text-white ${paid ? "bg-green-600" : "bg-red-500"}`}>{paid ? "Paid" : "Not Paid"}</span>
          </div>
          <div className="space-y-5 p-4">
            {v.paidBy ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Payment</h3>
                <div className="rounded-md border border-border px-3 py-2.5 text-xs text-muted-foreground">
                  Paid by {v.paidBy === "Bank" ? "bank transfer" : v.paidBy} on {v.date}
                </div>
              </div>
            ) : (
              <PayDocSection key={`pay-${v.number}`} doc={voucherDoc(v)} payable />
            )}
            <hr className="border-dashed" />
            <VoucherNotes key={`notes-${v.number}`} voucher={v} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function PrintedVoucher({ voucher: v, paid }: { voucher: ExpenseVoucher; paid: boolean }) {
  const business = useStore((s) => s.currentBusiness());
  const contact = useBankingStore((s) => s.contacts.find((c) => c.name === v.party));
  const addr = business.registeredAddress;
  const total = voucherTotal(v);
  return (
    <div className="px-[27px] py-6 text-[10pt] leading-[1.2] text-gray-800">
      <div className="py-2.5">
        <div className="flex size-20 items-center justify-center rounded-md bg-muted text-2xl font-semibold text-muted-foreground">{business.name.charAt(0)}</div>
      </div>
      <div className="py-[5px]">
        <div className="font-bold uppercase">{business.name}</div>
        <p>{addr.line1}</p>
        <p>
          {addr.city} - {addr.pincode}
        </p>
        <p>{addr.state}, INDIA</p>
        {business.gstin && <p>GSTIN: {business.gstin}</p>}
      </div>

      <div className="flex flex-col items-end py-[5px] text-right">
        <h5 className="font-bold uppercase leading-[1.5]">Expense Voucher</h5>
        <p>Number: {v.number}</p>
        <p>Payment Date: {v.date}</p>
        <span className={`my-[5px] w-[100px] border-2 py-0.5 text-center text-[9pt] font-bold tracking-wide ${paid ? "border-green-600 text-green-700" : "border-red-600 text-red-600"}`}>
          {paid ? "PAID" : "NOT PAID"}
        </span>
      </div>

      <div className={`grid grid-cols-2 gap-4 border-t ${LINE} py-[5px]`}>
        <div>
          <h5 className="text-[11pt] font-bold">Paid To</h5>
          <p>{v.party}</p>
          {contact?.accounts[0] && (
            <p className="text-gray-500">
              {contact.accounts[0].bank} {contact.accounts[0].masked}
            </p>
          )}
        </div>
        <div className="text-right">
          <h5 className="text-[11pt] font-bold">Expense Account</h5>
          <p>{v.category}</p>
          {v.paidBy && <p className="text-gray-500">Paid by {v.paidBy === "Bank" ? "bank transfer" : v.paidBy.toLowerCase()}</p>}
        </div>
      </div>

      <table className={`w-full border-collapse border-y ${LINE}`}>
        <thead>
          <tr>
            <th className={`${TH} w-10 text-left`}>
              <small className="text-[10pt]">Sno.</small>
            </th>
            <th className={`${TH} text-left`}>
              <small className="text-[10pt]">Particulars</small>
            </th>
            <th className={`${TH} text-right`}>
              <small className="text-[10pt]">Amount</small>
            </th>
          </tr>
        </thead>
        <tbody>
          {v.items.map((it, i) => (
            <tr key={i}>
              <td className={`${TD} text-left`}>{i + 1}</td>
              <td className={`${TD} text-left`}>{it.name}</td>
              <td className={`${TD} text-right`}>{money2(it.amount)}</td>
            </tr>
          ))}
          <tr>
            <td />
            <td className="px-[5px] py-[5px] text-right font-bold">Total</td>
            <td className="px-[5px] py-[5px] text-right font-bold">INR {money(total)}</td>
          </tr>
        </tbody>
      </table>

      <div className={`mt-[5px] border-t ${LINE} p-[5px] text-right font-bold`}>
        <small className="text-[10pt]">Total in Words: {amountInWords(total)}</small>
      </div>

      <div className={`flex justify-end border-t ${LINE} p-[5px] text-right`}>
        <div>
          <div className="font-bold">
            <small className="text-[10pt]">For {business.name}</small>
          </div>
          <div className="h-16" />
          <small className="text-[10pt]">Authorised Signatory</small>
        </div>
      </div>
    </div>
  );
}

/** Internal notes, same box as on bills. Vouchers aren't in the invoices store, so notes are kept here. */
function VoucherNotes({ voucher: v }: { voucher: ExpenseVoucher }) {
  const [notes, setNotes] = useState<InvoiceNote[]>([]);
  const stub = { id: v.number, kind: "purchase", notes } as unknown as Invoice;
  const add = (text: string) =>
    setNotes((n) => [...n, { id: `n${Date.now()}`, kind: "internal", text, author: "You", at: new Date().toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) }]);
  return <NotesSection invoice={stub} connected={false} mode="internal" onAdd={add} />;
}
