import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input, Select } from "../../components/ui/input";
import { useBankingStore } from "../../store/useBankingStore";
import type { BusinessType } from "../../types";
import { AccountPicker } from "./AccountPicker";
import { isCashId } from "./cash";
import { accountName, fmtINR, groupOf, isDeposit } from "./data";
import { nextRef } from "./ledgerData";
import { CHARGE_HEADS, DEDUCTIONS, MODES, isOtherId, referenceLabel, type DeductionKind, type Mode } from "./otherAccounts";

type Kind = DeductionKind | "Discount received";
type Row = { kind: Kind; head: string; amount: string };

/** What was recorded, for the document to keep (receipt / payment row, settled amount). */
export interface RecordedMoney {
  ref: string;
  date: string;
  amount: number;
  accountId: string;
  /** "Axis ••9012", "Main cash", "Director – Ravi Kumar". */
  accountLabel: string;
  mode: string;
  reference?: string;
  tds?: number;
  deductions: { kind: "Discount" | "Charges"; head?: string; amount: number }[];
}

const toDMY = (iso: string) => iso.split("-").reverse().join("-");
const num = (s: string) => Math.round((Number(s) || 0) * 100) / 100;

/**
 * Record money received against an invoice, or paid against a bill / expense voucher, from the document itself.
 * Received in / Paid from is any account: Banking's own (reconciled), a person's, or a chart-of-accounts head.
 * Less than due: say what was held back (TDS, a discount, charges deducted) or leave the rest due.
 * The entry also lands in Banking: that account's books, a cash book, or a person's account.
 */
export function RecordMoney({
  direction,
  due,
  party,
  doc,
  businessType,
  onRecorded,
}: {
  direction: "in" | "out";
  due: number;
  party: string;
  /** "invoice LP-45", "bill 2026-08": for the Banking entry's note. */
  doc: string;
  businessType: BusinessType;
  onRecorded: (r: RecordedMoney) => Promise<void> | void;
}) {
  const accounts = useBankingStore((s) => s.accounts);
  const out = direction === "out";
  const [accountId, setAccountId] = useState(() => (accounts.find((a) => a.active && isDeposit(a)) ?? accounts[0])?.id ?? "");
  const [mode, setMode] = useState<Mode>("NEFT / RTGS / IMPS");
  const [reference, setReference] = useState("");
  const [day, setDay] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [amountText, setAmountText] = useState(String(due));
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const bank = accounts.find((a) => a.id === accountId);
  // A mode only means something for a bank account; cash, cards, gateways, wallets and other accounts have none.
  const asksMode = !!bank && groupOf(bank) === "bank";
  const amount = num(amountText);
  const short = Math.round((due - amount) * 100) / 100;
  const held = rows.reduce((s, r) => s + num(r.amount), 0);
  const leftDue = Math.round((short - held) * 100) / 100;
  const canSave = amount > 0 && amount <= due && held <= Math.max(0, short) && rows.every((r) => num(r.amount) > 0) && !saving;
  // What can make up the difference: a customer may deduct TDS, take a discount or deduct charges; when paying,
  // you deduct TDS or are given a discount.
  const kinds: Kind[] = out ? ["TDS", "Discount received"] : [...DEDUCTIONS];

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = (kind: Kind) => setRows((rs) => [...rs, { kind, head: CHARGE_HEADS[0], amount: String(Math.max(0, Math.round((short - rs.reduce((s, r) => s + num(r.amount), 0)) * 100) / 100)) }]);

  const save = async () => {
    setSaving(true);
    const b = useBankingStore.getState();
    const ref = nextRef([...b.bookEntries, ...b.cashEntries, ...b.otherEntries], out ? "VOU" : "REC");
    const date = toDMY(day);
    const accountLabel = bank ? accountName(bank) : ((b.cashAccounts.find((a) => a.id === accountId) ?? b.otherAccounts.find((a) => a.id === accountId))?.name ?? "");
    b.addEntry(accountId, date, out ? -amount : amount, { kind: out ? "Payment voucher" : "Receipt", ref, party }, { note: `For ${doc}, not in bank yet` });
    await onRecorded({
      ref,
      date,
      amount,
      accountId,
      accountLabel,
      mode: asksMode ? mode : isCashId(accountId) ? "Cash" : isOtherId(accountId) ? "Journal" : accountLabel,
      reference: asksMode ? reference || undefined : undefined,
      tds: rows.filter((r) => r.kind === "TDS").reduce((s, r) => s + num(r.amount), 0) || undefined,
      deductions: rows
        .filter((r) => r.kind !== "TDS")
        .map((r) => (r.kind === "Charges they deducted" ? { kind: "Charges" as const, head: r.head, amount: num(r.amount) } : { kind: "Discount" as const, amount: num(r.amount) })),
    });
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <AccountPicker label={out ? "Paid from" : "Received in"} value={accountId} onChange={setAccountId} businessType={businessType} includeCards={out} />
      {asksMode && (
        <div className="grid grid-cols-2 gap-2">
          <Select aria-label="Mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            {MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
          <Input aria-label={referenceLabel(mode)} placeholder={referenceLabel(mode)} value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" aria-label={out ? "Payment date" : "Receipt date"} value={day} onChange={(e) => setDay(e.target.value)} />
        <div className="relative">
          <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-2sm text-muted-foreground">₹</span>
          <Input aria-label={out ? "Amount paid" : "Amount received"} inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ""))} className="ps-7 tabular-nums" />
        </div>
      </div>

      {/* Less than due: say what made up the difference, or leave the rest due. */}
      {amount > 0 && short > 0 && (
        <div className="space-y-2 rounded-md border border-border p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium">Short by {fmtINR(short)}</span>
            {leftDue > 0 && (
              <Select selectSize="sm" aria-label="Account for the difference" value="" onChange={(e) => e.target.value && addRow(e.target.value as Kind)} wrapperClassName="w-40">
                <option value="">{rows.length ? "+ Add another" : "Leave it due"}</option>
                {kinds.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            )}
          </div>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {r.kind === "Charges they deducted" ? (
                <Select selectSize="sm" aria-label="Charge" value={r.head} onChange={(e) => setRow(i, { head: e.target.value })} wrapperClassName="min-w-0 flex-1">
                  {CHARGE_HEADS.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </Select>
              ) : (
                <span className="flex-1">{r.kind}</span>
              )}
              <div className="w-24 shrink-0">
                <Input inputSize="sm" aria-label={`${r.kind} amount`} inputMode="decimal" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value.replace(/[^\d.]/g, "") })} className="text-right tabular-nums" />
              </div>
              <button type="button" aria-label="Remove" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="cursor-pointer text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {rows.length > 0 && (
            <div className={leftDue < 0 ? "text-destructive" : "text-muted-foreground"}>
              {leftDue < 0 ? `More than the shortfall by ${fmtINR(-leftDue)}` : leftDue > 0 ? `${fmtINR(leftDue)} stays due` : "Fully settled"}
            </div>
          )}
        </div>
      )}
      {amount > due && <div className="text-xs text-destructive">More than the {fmtINR(due)} due</div>}

      <div className="flex justify-end">
        <Button variant={out ? "outline" : "primary"} disabled={!canSave} onClick={save}>
          {saving ? "Recording…" : out ? "Record payment" : "Record receipt"}
        </Button>
      </div>
    </div>
  );
}
