import { useState, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Input, Select } from "../../components/ui/input";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { useHrmsStore } from "../../store/useHrmsStore";
import { CASH_PARENT } from "./cash";
import { FY_START } from "./data";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const toDMY = (iso: string) => iso.split("-").reverse().join("-");
const fyLabel = (iso: string) => {
  const y = Number(iso.slice(0, 4));
  return `FY ${String(y).slice(2)}–${String(y + 1).slice(2)}`;
};
/** Opening balances are taken at the start of a financial year: this one and the few before it. */
const FY_STARTS = [0, 1, 2, 3].map((n) => `${Number(FY_START.slice(0, 4)) - n}${FY_START.slice(4)}`);
const amountOnly = (v: string) => v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

/**
 * Add account → Cash account: a sub-account under Cash in hand (branch petty cash…) with its opening balance.
 * Renders the body and footer of the Add account drawer; `top` is the type choice above the fields.
 */
export function CashAccountForm({ top, onClose }: { top: ReactNode; onClose: () => void }) {
  const taken = useBankingStore((s) => s.cashAccounts).map((a) => a.name.trim().toLowerCase());
  // The business's branches, as set up in Settings (shared with HRMS).
  const branches = useHrmsStore((s) => s.branches);
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingDate, setOpeningDate] = useState(FY_START);

  const clash = taken.includes(name.trim().toLowerCase());
  const canSave = name.trim() !== "" && !clash;

  const save = () => {
    if (!canSave) return;
    const account = useBankingStore.getState().addCashAccount({
      name: name.trim(),
      branch: branch.trim(),
      opening: { amount: Number(openingAmount || 0), date: toDMY(openingDate) },
    });
    useStore.getState().pushToast(`${account.name} added under ${CASH_PARENT}`);
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

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="cash-name" className="text-xs font-medium">
            Name
          </label>
          <Input id="cash-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Petty cash – Mumbai" autoFocus aria-invalid={clash || undefined} />
          {clash && <div className="text-xs text-destructive">A cash account with this name already exists.</div>}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="cash-branch" className="text-xs font-medium">
            Branch <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Select
            id="cash-branch"
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              // A new branch account is usually that branch's petty cash: suggest the name while it's empty.
              if (e.target.value && !name.trim()) setName(`Petty cash – ${e.target.value}`);
            }}
          >
            <option value="">No branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="text-sm font-medium">Opening balance</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="cash-opening" className="text-xs font-medium">
                Amount (₹)
              </label>
              <Input id="cash-opening" value={openingAmount} onChange={(e) => setOpeningAmount(amountOnly(e.target.value))} inputMode="decimal" placeholder="0" className="tabular-nums" />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="cash-opening-date" className="text-xs font-medium">
                As on
              </label>
              <Select id="cash-opening-date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)}>
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
