import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { cn } from "../../lib/cn";
import { useBankingStore } from "../../store/useBankingStore";
import { BankLogo } from "./BankLogo";
import { PAY_FROM_BANKS, type ApprovalMode, type BankKey } from "./data";
import { OVERLAY } from "./shared";
import { useEscape } from "./useEscape";

type FieldKey = "customerId" | "corporateId" | "userId" | "aliasId" | "userCode" | "makerCode" | "checkerCode";

interface FieldSpec {
  key: FieldKey;
  label: string;
  placeholder: string;
  hint?: string;
}

/**
 * What each bank's Register Connected Banking API needs from the customer. Anything LEDGERS already
 * knows (business name, the account, LEDGERS's own fintech code) is never asked for.
 */
const BANK_FORMS: Record<
  BankKey,
  { intro?: string; ids: FieldSpec[]; approval: boolean; single: FieldSpec[]; makerChecker: FieldSpec[] }
> = {
  indusind: {
    ids: [{ key: "customerId", label: "Customer ID", placeholder: "e.g. 41238870", hint: "On your welcome letter or net banking profile." }],
    approval: true,
    single: [{ key: "userCode", label: "Net banking user code", placeholder: "User code" }],
    makerChecker: [
      { key: "makerCode", label: "Maker user code", placeholder: "Maker user code" },
      { key: "checkerCode", label: "Checker user code", placeholder: "Checker user code" },
    ],
  },
  icici: {
    intro: "Use your self-created Login ID. If you haven't created one, use your Corporate ID and User ID.",
    ids: [
      { key: "corporateId", label: "Corporate ID", placeholder: "Corporate ID" },
      { key: "userId", label: "User ID", placeholder: "User ID" },
      { key: "aliasId", label: "Alias ID", placeholder: "Alias ID" },
    ],
    approval: false,
    single: [],
    makerChecker: [],
  },
  // Placeholder until Axis's API fields are confirmed.
  axis: {
    ids: [{ key: "corporateId", label: "Corporate ID", placeholder: "Corporate ID" }],
    approval: true,
    single: [{ key: "userId", label: "User ID", placeholder: "User ID" }],
    makerChecker: [
      { key: "makerCode", label: "Maker user ID", placeholder: "Maker user ID" },
      { key: "checkerCode", label: "Checker user ID", placeholder: "Checker user ID" },
    ],
  },
};

const APPROVAL_CHOICES: { value: ApprovalMode; title: string; body: string }[] = [
  { value: "single", title: "One user", body: "One user raises and approves payments." },
  { value: "maker-checker", title: "Maker & checker", body: "A maker raises payments; a checker approves them." },
];

export function RegisterBankDialog({
  bank,
  onClose,
  onMakeTransfer,
}: {
  bank: BankKey;
  onClose: () => void;
  onMakeTransfer: () => void;
}) {
  const registerBank = useBankingStore((s) => s.registerBank);
  const account = PAY_FROM_BANKS.find((b) => b.key === bank)!;
  const form = BANK_FORMS[bank];
  useEscape(onClose);

  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [approval, setApproval] = useState<ApprovalMode | null>(form.approval ? null : "single");
  const [phase, setPhase] = useState<"form" | "verifying" | "connected">("form");
  const [error, setError] = useState<string | null>(null);

  const approvalFields = approval === "maker-checker" ? form.makerChecker : approval === "single" ? form.single : [];
  const fields = [...form.ids, ...approvalFields];
  const val = (k: FieldKey) => (values[k] ?? "").trim();
  const sameMakerChecker = approval === "maker-checker" && val("makerCode") !== "" && val("makerCode") === val("checkerCode");
  const canSubmit = approval !== null && fields.every((f) => val(f.key) !== "") && !sameMakerChecker && phase === "form";

  const set = (k: FieldKey, v: string) => {
    setValues((prev) => ({ ...prev, [k]: v.toUpperCase().replace(/\s/g, "") }));
    setError(null);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setPhase("verifying");
    const ok = await registerBank(bank, form.approval ? approval! : undefined);
    if (ok) return setPhase("connected");
    setPhase("form");
    setError(
      `${account.bank} couldn't match these details to account ${account.masked}. Check them in ${account.short} net banking and try again.`,
    );
  };

  const field = (f: FieldSpec) => (
    <div key={f.key} className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={`reg-${f.key}`} className="text-xs font-medium text-foreground">
        {f.label}
      </label>
      <Input
        id={`reg-${f.key}`}
        value={values[f.key] ?? ""}
        onChange={(e) => set(f.key, e.target.value)}
        placeholder={f.placeholder}
        autoComplete="off"
        disabled={phase !== "form"}
        aria-invalid={f.key === "checkerCode" && sameMakerChecker ? true : undefined}
        className="uppercase placeholder:normal-case"
      />
      {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
    </div>
  );

  return (
    <>
      <div className={OVERLAY} onClick={phase === "verifying" ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Connect ${account.bank}`}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-80px)] w-[512px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg animate-[fade-in_.15s_ease]"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute end-4 top-4"
          onClick={onClose}
          disabled={phase === "verifying"}
          aria-label="Close"
        >
          <X />
        </Button>

        {phase === "connected" ? (
          <div className="flex flex-col items-center gap-4 px-6 pb-8 pt-10 text-center">
            <div className="flex size-[52px] items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success-accent)]">
              <Check className="size-6" />
            </div>
            <div>
              <div className="text-base font-semibold">{account.bank} connected</div>
              <p className="mt-1.5 text-2sm leading-relaxed text-muted-foreground">
                Account {account.masked} is live in LEDGERS. Balance and statements now sync automatically.
                {approval === "maker-checker"
                  ? ` Payments you start here go to your checker for approval in ${account.short} net banking.`
                  : " You can send payments from Banking → Fund Transfer."}
              </p>
            </div>
            <div className="mt-2 flex w-full gap-2.5">
              <Button className="h-10 flex-1 px-4 text-sm" onClick={onClose}>
                Done
              </Button>
              <Button variant="primary" className="h-10 flex-[2] px-4 text-sm" onClick={onMakeTransfer}>
                Make a transfer
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 overflow-y-auto px-6 pb-6 pt-6">
              <div className="flex flex-col gap-3 pe-8">
                <BankLogo bank={bank} size="sm" />
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Connect current account <span className="tabular-nums">{account.masked}</span>
                  </h2>
                  <p className="mt-1 text-2sm text-muted-foreground">Send payments, check balance and sync statements from LEDGERS.</p>
                </div>
              </div>

              {form.intro && <p className="text-xs text-muted-foreground">{form.intro}</p>}
              {form.ids.map(field)}

              {form.approval && (
                <div className="flex flex-col gap-1.5">
                  <div id="reg-approval" className="text-xs font-medium text-foreground">
                    Payment approval
                  </div>
                  <div role="radiogroup" aria-labelledby="reg-approval" className="flex gap-1 rounded-lg border border-border/80 bg-muted/80 p-1">
                    {APPROVAL_CHOICES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={approval === c.value}
                        disabled={phase !== "form"}
                        onClick={() => setApproval(c.value)}
                        className={cn(
                          "h-8 flex-1 cursor-pointer rounded-md px-3 text-2sm text-foreground",
                          approval === c.value && "bg-background font-medium shadow-lg shadow-black/5",
                        )}
                      >
                        {c.title}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {APPROVAL_CHOICES.find((c) => c.value === approval)?.body ?? `As set up in your ${account.short} net banking.`}
                  </p>
                </div>
              )}

              {approvalFields.length > 0 && (
                <div className={cn("grid gap-3", approvalFields.length > 1 && "grid-cols-2")}>{approvalFields.map(field)}</div>
              )}
              {sameMakerChecker && <p className="-mt-1 text-xs text-destructive">Maker and checker must be different users.</p>}

              {error && (
                <div role="alert" className="rounded-md bg-[var(--color-destructive-soft)] px-3 py-2.5 text-xs leading-snug text-destructive">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border px-6 py-4">
              <Button onClick={onClose} disabled={phase === "verifying"}>
                Cancel
              </Button>
              <Button variant="primary" onClick={submit} disabled={!canSubmit && phase === "form"}>
                {phase === "verifying" ? (
                  <>
                    <CircularSpinner size={14} className="!text-primary-foreground" /> Verifying with {account.short}…
                  </>
                ) : (
                  `Connect ${account.short}`
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
