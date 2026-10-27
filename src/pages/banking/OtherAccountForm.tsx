import { useState, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Input, Select } from "../../components/ui/input";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { FY_START, accountName, type CompanyAccount } from "./data";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const toDMY = (iso: string) => iso.split("-").reverse().join("-");
const fyLabel = (iso: string) => {
  const y = Number(iso.slice(0, 4));
  return `FY ${String(y).slice(2)}–${String(y + 1).slice(2)}`;
};
const FY_STARTS = [0, 1, 2, 3].map((n) => `${Number(FY_START.slice(0, 4)) - n}${FY_START.slice(4)}`);
const amountOnly = (v: string) => v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

type OtherType = "Credit card" | "Payment gateway" | "Wallet";

/** What each kind asks, and nothing more: who it's with, and its balance as on an FY start. */
const SETUP: Record<OtherType, { who: string; options: string[]; balanceLabel: string }> = {
  "Credit card": {
    who: "Issuer",
    options: ["HDFC Bank", "ICICI Bank", "Axis Bank", "SBI Card", "Kotak Mahindra Bank", "IndusInd Bank", "American Express", "Other"],
    balanceLabel: "Amount owed (₹)",
  },
  "Payment gateway": {
    who: "Provider",
    options: ["Razorpay", "PayU", "Cashfree", "PhonePe", "Paytm", "CCAvenue", "Stripe", "Other"],
    balanceLabel: "Awaiting payout (₹)",
  },
  Wallet: {
    who: "Provider",
    options: ["Paytm", "Amazon Pay", "PhonePe", "MobiKwik", "Fuel card", "Travel card", "Other"],
    balanceLabel: "Balance (₹)",
  },
};

/**
 * Add account → Credit card, Payment gateway or Wallet. Statements (PDF, Excel, CSV) are uploaded later from
 * Accounts and reconciled in Transactions like any bank account. Renders the drawer's body and footer.
 */
export function OtherAccountForm({ type, top, onClose }: { type: OtherType; top: ReactNode; onClose: () => void }) {
  const cfg = SETUP[type];
  const card = type === "Credit card";
  const [who, setWho] = useState("");
  const [other, setOther] = useState("");
  const [digits, setDigits] = useState("");
  const [nickname, setNickname] = useState("");
  const [limit, setLimit] = useState("");
  const [amount, setAmount] = useState("");
  const [asOn, setAsOn] = useState(FY_START);

  const name = who === "Other" ? other.trim() : who;
  const canSave = name !== "" && (!card || digits.length === 4);

  const save = () => {
    if (!canSave) return;
    const opening = Number(amount || 0);
    const account = useBankingStore.getState().addCompanyAccount({
      type: type as CompanyAccount["type"],
      bank: name,
      number: card ? digits : "",
      ifsc: "",
      nickname: nickname.trim(),
      primary: false,
      // A card's opening amount is owed: it sits as a negative balance, like an overdraft.
      opening: { amount: card ? -opening : opening, date: toDMY(asOn) },
      limit: card && limit ? Number(limit) : undefined,
    });
    useStore.getState().pushToast(`${accountName(account)} added. Upload its statements from Accounts.`);
    onClose();
  };

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        {top}

        <div className={card ? "grid grid-cols-[minmax(0,1fr)_7rem] gap-3" : "flex flex-col"}>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="other-who" className="text-xs font-medium">
              {cfg.who}
            </label>
            <Select id="other-who" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Select…</option>
              {cfg.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          </div>
          {card && (
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="other-digits" className="text-xs font-medium">
                Last 4 digits
              </label>
              <Input id="other-digits" value={digits} onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="4421" className="tabular-nums" />
            </div>
          )}
        </div>
        {who === "Other" && <Input aria-label={`${cfg.who} name`} value={other} onChange={(e) => setOther(e.target.value)} placeholder={`${cfg.who} name`} autoFocus />}

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="other-nickname" className="text-xs font-medium">
            Nickname <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input id="other-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={card ? "e.g. Corporate card" : "e.g. Online store"} />
        </div>

        {card && (
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="other-limit" className="text-xs font-medium">
              Credit limit (₹) <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input id="other-limit" value={limit} onChange={(e) => setLimit(amountOnly(e.target.value))} inputMode="decimal" placeholder="e.g. 200000" className="tabular-nums" />
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="text-sm font-medium">Opening balance</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="other-amount" className="text-xs font-medium">
                {cfg.balanceLabel}
              </label>
              <Input id="other-amount" value={amount} onChange={(e) => setAmount(amountOnly(e.target.value))} inputMode="decimal" placeholder="0" className="tabular-nums" />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="other-as-on" className="text-xs font-medium">
                As on
              </label>
              <Select id="other-as-on" value={asOn} onChange={(e) => setAsOn(e.target.value)}>
                {FY_STARTS.map((d) => (
                  <option key={d} value={d}>
                    {fmtDate(d)} · {fyLabel(d)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2.5 border-t border-border px-6 py-4">
        <Button type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!canSave}>
          Add account
        </Button>
      </div>
    </form>
  );
}
