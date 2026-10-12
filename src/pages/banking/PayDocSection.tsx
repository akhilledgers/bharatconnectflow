import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Clock } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../components/ui/button";
import { Input, Select } from "../../components/ui/input";
import { useStore } from "../../store/useStore";
import { useBankingStore, usePayFromAccounts } from "../../store/useBankingStore";
import { CONNECTED_BANKING, fmtINR, last4 } from "./data";
import { paymentLabel, useDocPayment, usePayDocs, type PayableDoc } from "./PayDocs";

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MODES = ["Cash", "UPI", "Cheque", "Bank transfer"] as const;
const todayIso = () => new Date().toISOString().slice(0, 10);
const dmy = (iso: string) => iso.split("-").reverse().join("-");

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A finished or in-flight payment, as one bordered line. */
function StatusCard({ done, title, detail, action }: { done: boolean; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
      <div className="min-w-0 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          {done ? <BadgeCheck className="size-3.5 text-green-600" /> : <Clock className="size-3.5 text-amber-500" />}
          {title}
        </div>
        <div className="mt-0.5 truncate text-muted-foreground">{detail}</div>
      </div>
      {action}
    </div>
  );
}

/**
 * The Payment section of a bill or expense voucher: pay what's due from a connected bank (supplier's account,
 * which of yours it goes from), or record a payment made some other way. Once paid, where it stands.
 */
export function PayDocSection({ doc, payable }: { doc: PayableDoc; payable: boolean }) {
  const navigate = useNavigate();
  const payDocs = usePayDocs();
  const payment = useDocPayment(doc.number);
  const recorded = useBankingStore((s) => s.recordedDocs[doc.number]);
  const accounts = useBankingStore((s) => s.accounts);
  const contact = useBankingStore((s) => s.contacts.find((c) => c.name.toLowerCase() === doc.party.toLowerCase()));
  const payFrom = usePayFromAccounts();

  const [tab, setTab] = useState<"bank" | "record">(payDocs.canPay ? "bank" : "record");
  const [fromId, setFromId] = useState(payFrom[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [mode, setMode] = useState<(typeof MODES)[number]>("Cash");
  const [paidFrom, setPaidFrom] = useState(accounts.find((a) => a.active)?.id ?? "");
  const [reference, setReference] = useState("");

  const accountName = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.bankKey ? CONNECTED_BANKING[a.bankKey].short : a.bank} ${last4(a.number)}` : "your bank";
  };

  const heading = <h3 className="text-sm font-semibold text-gray-700">Payment</h3>;

  if (payment) {
    const bank = accountName(payment.fromAccountId);
    const detail =
      payment.status === "awaiting"
        ? `Waiting for the checker in ${bank.split(" ")[0]} net banking`
        : payment.status === "processing"
          ? `${payment.mode} from ${bank}`
          : `${payment.mode} from ${bank}${payment.utr ? ` · UTR ${payment.utr}` : ""}`;
    return (
      <div className="space-y-3">
        {heading}
        <StatusCard
          done={payment.status === "paid"}
          title={`${paymentLabel(payment)} · INR ${money(payment.amount)}`}
          detail={detail}
          action={
            <button onClick={() => navigate("/banking?tab=payouts")} className="shrink-0 text-xs font-medium text-primary hover:underline">
              {payment.ref}
            </button>
          }
        />
      </div>
    );
  }

  if (recorded) {
    return (
      <div className="space-y-3">
        {heading}
        <StatusCard
          done
          title={`Paid · INR ${money(doc.due)}`}
          detail={[recorded.mode, dmy(recorded.date), recorded.reference && `Ref ${recorded.reference}`].filter(Boolean).join(" · ")}
        />
      </div>
    );
  }

  if (!payable || doc.due <= 0) return null;
  const supplierAccount = contact?.accounts[0];

  const record = () => {
    useBankingStore.getState().recordDocPayment(doc.number, { date, mode, reference: reference.trim() || undefined });
    useStore.getState().pushToast(`Payment recorded for ${doc.number}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        {heading}
        <div role="tablist" className="inline-flex rounded-md border border-border bg-muted/60 p-0.5 text-xs">
          {(
            [
              ["bank", "Pay from bank"],
              ["record", "Record payment"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={tab === v}
              onClick={() => setTab(v)}
              className={cn("rounded px-2.5 py-1 font-medium", tab === v ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "bank" ? (
        <div className="space-y-3">
          <Row label="Pay to">
            <div className="truncate text-xs font-medium text-foreground">{doc.party}</div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              {supplierAccount ? (
                <>
                  {supplierAccount.bank} {supplierAccount.masked}
                  {supplierAccount.verified && <BadgeCheck className="size-3.5 text-green-600" aria-label="Verified" />}
                </>
              ) : (
                "No bank account yet · you'll add it next"
              )}
            </div>
          </Row>
          {payDocs.canPay ? (
            <>
              <Row label="From">
                <Select selectSize="sm" value={fromId} onChange={(e) => setFromId(e.target.value)} aria-label="Pay from">
                  {payFrom.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.short} {a.masked} · {fmtINR(a.balance)}
                    </option>
                  ))}
                </Select>
              </Row>
              <Button variant="primary" className="w-full" onClick={() => payDocs.pay([doc], fromId)}>
                Pay INR {money(doc.due)}
              </Button>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
              Connect your Axis, ICICI or IndusInd account to pay from here.
              <button onClick={() => navigate("/banking")} className="shrink-0 font-medium text-primary hover:underline">
                Connect bank
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Row label="Payment date">
            <Input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className="h-7 text-xs" aria-label="Payment date" />
          </Row>
          <Row label="Mode">
            <Select selectSize="sm" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} aria-label="Payment mode">
              {MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Row>
          {mode !== "Cash" && (
            <Row label="Paid from">
              <Select selectSize="sm" value={paidFrom} onChange={(e) => setPaidFrom(e.target.value)} aria-label="Paid from">
                {accounts
                  .filter((a) => a.active)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {accountName(a.id)}
                    </option>
                  ))}
              </Select>
            </Row>
          )}
          <Row label="Reference">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={mode === "Cheque" ? "Cheque number" : "Optional"} className="h-7 text-xs" aria-label="Reference" />
          </Row>
          <Button variant="outline" className="w-full" onClick={record}>
            Record INR {money(doc.due)}
          </Button>
        </div>
      )}
      {payDocs.drawers}
    </div>
  );
}
