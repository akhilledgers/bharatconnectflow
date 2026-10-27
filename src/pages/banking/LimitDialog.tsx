import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { accountName, type CompanyAccount } from "./data";
import { OVERLAY } from "./shared";
import { useEscape } from "./useEscape";

/** OD / CC / credit card: set or change the limit. Clearing it turns the limit alerts off. */
export function LimitDialog({ account, onClose }: { account: CompanyAccount; onClose: () => void }) {
  const [value, setValue] = useState(account.limit ? String(account.limit) : "");
  useEscape(onClose);
  const label = account.type === "Credit card" ? "Credit limit (₹)" : "Sanctioned limit (₹)";

  const save = () => {
    const limit = value ? Number(value) : undefined;
    useBankingStore.getState().updateAccount(account.id, { limit });
    useStore.getState().pushToast(limit ? `Limit set for ${accountName(account)}` : `Limit removed for ${accountName(account)}`);
    onClose();
  };

  return (
    <>
      <div className={OVERLAY} onClick={onClose} />
      <form
        role="dialog"
        aria-modal="true"
        aria-label={`Limit for ${accountName(account)}`}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="fixed left-1/2 top-1/2 z-50 flex w-[400px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-background shadow-lg animate-[fade-in_.15s_ease]"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="text-sm font-semibold">{accountName(account)} limit</div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="flex flex-col gap-1.5 px-5 py-4">
          <label htmlFor="limit-value" className="text-xs font-medium">
            {label}
          </label>
          <Input
            id="limit-value"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
            inputMode="decimal"
            placeholder="e.g. 500000"
            className="tabular-nums"
          />
          <p className="text-xs text-muted-foreground">Used to show what&apos;s available and warn near the limit. Leave empty for no limit.</p>
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-5 py-3">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </>
  );
}
