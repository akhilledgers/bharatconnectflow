import { useState, type ReactNode } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import { cn } from "../../lib/cn";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { BankLogo } from "./BankLogo";
import { APPROVAL_CHOICES, BANK_CONNECTORS, approvalPlace, type ConnectField } from "./bankConnectors";
import { last4, type ApprovalMode } from "./data";
import { OVERLAY } from "./shared";
import { useEscape } from "./useEscape";

/**
 * Connect (or reconnect) Connected Banking for one account. Generic: what to ask comes from the bank's entry
 * in BANK_CONNECTORS. Order: the bank's IDs, then how payments are approved, then the user codes that choice needs.
 */
export function RegisterBankDialog({
  accountId,
  onClose,
  onMakeTransfer,
}: {
  accountId: string;
  onClose: () => void;
  onMakeTransfer: () => void;
}) {
  const registerBank = useBankingStore((s) => s.registerBank);
  const checkConnection = useBankingStore((s) => s.checkConnection);
  const stored = useBankingStore((s) => s.accounts.find((a) => a.id === accountId)!);
  const bank = BANK_CONNECTORS[stored.bankKey!];
  const masked = last4(stored.number);
  // Captured on open: the store flips the account to "connected" before the success screen shows.
  const [reconnect] = useState(stored.connection === "expired");
  const verb = reconnect ? "Reconnect" : "Connect";
  useEscape(onClose);

  const [values, setValues] = useState<Record<string, string>>({});
  const [approval, setApproval] = useState<ApprovalMode | null>(bank.approval ? (reconnect ? stored.approval : null) : "single");
  // A connection that's already waiting (on the bank, or on the customer's approval) opens on that step.
  const [phase, setPhase] = useState<"form" | "verifying" | "requested" | "approve" | "connected">(
    stored.connection === "requested" ? "requested" : stored.connection === "pending" ? "approve" : "form",
  );
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whereOpen, setWhereOpen] = useState<string | null>(null);

  const approvalFields = !bank.approval ? [] : approval === "maker-checker" ? bank.makerChecker : approval === "single" ? bank.single : [];
  const fields = [...bank.ids, ...approvalFields];
  const val = (k: string) => (values[k] ?? "").trim();
  const sameMakerChecker = approval === "maker-checker" && val("makerCode") !== "" && val("makerCode") === val("checkerCode");
  const canSubmit = approval !== null && fields.every((f) => val(f.key) !== "") && !sameMakerChecker && phase === "form";

  const set = (f: ConnectField, v: string) => {
    setValues((prev) => ({ ...prev, [f.key]: f.numeric ? v.replace(/\D/g, "") : v.toUpperCase().replace(/\s/g, "") }));
    setError(null);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setPhase("verifying");
    const ok = await registerBank(accountId, bank.approval ? approval! : undefined);
    const now = useBankingStore.getState().accounts.find((a) => a.id === accountId)?.connection;
    if (ok) return setPhase(now === "requested" ? "requested" : now === "pending" ? "approve" : "connected");
    setPhase("form");
    setError(`${bank.name} couldn't match these details to account ${masked}. Check them in ${approvalPlace(bank.key)} and try again.`);
  };

  const check = async () => {
    setChecking(true);
    setNotYet(false);
    const next = await checkConnection(accountId);
    setChecking(false);
    const was = phase === "requested" ? "requested" : "pending";
    // Approved: no success screen, just close and say so.
    if (next === "connected") {
      useStore.getState().pushToast(`${bank.name} ${masked} connected`);
      return onClose();
    }
    if (next === was) return setNotYet(true);
    setPhase(next === "requested" ? "requested" : "approve");
  };

  const later = () => {
    useStore
      .getState()
      .pushToast(
        phase === "requested"
          ? `Request sent to ${bank.short} for ${masked}. Check its status from Accounts.`
          : `${bank.short} ${masked} is waiting for your approval in ${approvalPlace(bank.key)}. We'll keep checking.`,
      );
    onClose();
  };

  const field = (f: ConnectField, autoFocus = false) => (
    <div key={f.key} className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`reg-${f.key}`} className="text-xs font-medium text-foreground">
          {f.label}
        </label>
        {f.where && (
          <button
            type="button"
            onClick={() => setWhereOpen(whereOpen === f.key ? null : f.key)}
            aria-expanded={whereOpen === f.key}
            className="cursor-pointer text-xs text-primary hover:underline"
          >
            Where do I find it?
          </button>
        )}
      </div>
      <Input
        id={`reg-${f.key}`}
        value={values[f.key] ?? ""}
        onChange={(e) => set(f, e.target.value)}
        placeholder={f.placeholder}
        inputMode={f.numeric ? "numeric" : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={phase !== "form"}
        aria-invalid={f.key === "checkerCode" && sameMakerChecker ? true : undefined}
        className={cn(!f.numeric && "uppercase placeholder:normal-case", f.numeric && "tabular-nums")}
      />
      {whereOpen === f.key && <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">{f.where}</p>}
    </div>
  );

  return (
    <>
      <div className={OVERLAY} onClick={phase === "verifying" ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${verb} ${bank.name}`}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-80px)] w-[512px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg animate-[fade-in_.15s_ease]"
      >
        <Button variant="ghost" size="icon-sm" className="absolute end-4 top-4" onClick={onClose} disabled={phase === "verifying"} aria-label="Close">
          <X />
        </Button>

        {phase === "requested" || (phase === "approve" && bank.netBankingApproval) ? (
          <div className="flex flex-col gap-5 px-6 pb-6 pt-6">
            <div className="flex flex-col gap-3 pe-8">
              <BankLogo bank={bank.key} size="sm" />
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {phase === "requested" ? `Request sent to ${bank.short}` : `Approve in ${approvalPlace(bank.key)}`}
                </h2>
                <p className="mt-1 text-2sm text-muted-foreground">
                  {phase === "requested"
                    ? `Account ${masked}`
                    : `${bank.bankActivation ? `${bank.short} has activated it.` : "Details verified."} Approve LEDGERS to start using account ${masked}.`}
                </p>
              </div>
            </div>

            {phase === "requested" ? (
              // Where the connection stands: sent, with the bank, then the customer's approval.
              <ol className="flex flex-col gap-2.5">
                <ProgressStep state="done">Request sent</ProgressStep>
                <ProgressStep state="current">{bank.short} activates it</ProgressStep>
                <ProgressStep state="next">Approve in {approvalPlace(bank.key)}</ProgressStep>
              </ol>
            ) : (
              <>
                <ol className="flex flex-col gap-2.5">
                  {bank.netBankingApproval!.steps.map((step, i) => (
                    <li key={step} className="flex items-center gap-3 text-2sm">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-xs font-semibold text-[var(--color-primary-accent)]">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <a
                  href={bank.netBankingApproval!.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-md border border-input px-3 text-2sm font-medium hover:bg-accent"
                >
                  Open {approvalPlace(bank.key)} <ExternalLink className="size-3.5 opacity-60" />
                </a>
              </>
            )}

            {notYet && (
              <p role="status" className="text-xs text-muted-foreground">
                {phase === "requested" ? `Not activated by ${bank.short} yet.` : "Not approved yet. It can take a few minutes to show after you approve."}
              </p>
            )}
            <div className="-mx-6 -mb-6 flex justify-end gap-2.5 border-t border-border px-6 py-4">
              <Button onClick={later} disabled={checking}>
                Later
              </Button>
              <Button variant="primary" onClick={check} disabled={checking}>
                {checking ? (
                  <>
                    <CircularSpinner size={14} className="!text-primary-foreground" /> Checking…
                  </>
                ) : phase === "requested" ? (
                  "Check status"
                ) : (
                  "I've approved it"
                )}
              </Button>
            </div>
          </div>
        ) : phase === "connected" ? (
          <div className="flex flex-col items-center gap-4 px-6 pb-8 pt-10 text-center">
            <div className="flex size-[52px] items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success-accent)]">
              <Check className="size-6" />
            </div>
            <div>
              <div className="text-base font-semibold">
                {bank.name} {reconnect ? "reconnected" : "connected"}
              </div>
              <p className="mt-1.5 text-2sm leading-relaxed text-muted-foreground">
                Account {masked} is live. Balance and statements sync automatically.
                {approval === "maker-checker" ? ` Payments you start here go to your checker in ${bank.short} net banking.` : ""}
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
          <form
            className="flex min-h-0 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex flex-col gap-4 overflow-y-auto px-6 pb-6 pt-6">
              <div className="flex flex-col gap-3 pe-8">
                <BankLogo bank={bank.key} size="sm" />
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {verb} account <span className="tabular-nums">{masked}</span>
                  </h2>
                  {reconnect && <p className="mt-1 text-2sm text-muted-foreground">The connection expired. Re-enter your details to resume syncing.</p>}
                </div>
              </div>

              {bank.intro && <p className="text-xs text-muted-foreground">{bank.intro}</p>}
              {bank.ids.map((f, i) => field(f, i === 0))}

              {bank.approval && (
                <div className="flex flex-col gap-1.5">
                  <div id="reg-approval" className="text-xs font-medium text-foreground">
                    Approval in {bank.short} net banking
                  </div>
                  <div role="radiogroup" aria-labelledby="reg-approval" className="grid grid-cols-2 gap-2">
                    {APPROVAL_CHOICES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={approval === c.value}
                        disabled={phase !== "form"}
                        onClick={() => setApproval(c.value)}
                        className={cn(
                          "flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left",
                          approval === c.value ? "border-primary bg-[var(--color-primary-soft)]" : "border-input hover:bg-accent/60",
                        )}
                      >
                        <span className="text-2sm font-medium text-foreground">{c.title}</span>
                        <span className="text-xs text-muted-foreground">{c.body}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {approvalFields.length > 0 && <div className={cn("grid gap-3", approvalFields.length > 1 && "grid-cols-2")}>{approvalFields.map((f) => field(f))}</div>}
              {sameMakerChecker && <p className="-mt-1 text-xs text-destructive">Maker and checker must be different users.</p>}

              {error && (
                <div role="alert" className="rounded-md bg-[var(--color-destructive-soft)] px-3 py-2.5 text-xs leading-snug text-destructive">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 border-t border-border px-6 py-4">
              <Button type="button" onClick={onClose} disabled={phase === "verifying"}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!canSubmit && phase === "form"}>
                {phase === "verifying" ? (
                  <>
                    <CircularSpinner size={14} className="!text-primary-foreground" /> {bank.bankActivation ? "Sending to" : "Verifying with"} {bank.short}…
                  </>
                ) : (
                  verb
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

/** One line of the connection's progress: a tick when done, a spinner for the step it's on, grey for what's next. */
function ProgressStep({ state, children }: { state: "done" | "current" | "next"; children: ReactNode }) {
  return (
    <li className={cn("flex items-center gap-3 text-2sm", state === "next" && "text-muted-foreground")}>
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          state === "done" ? "bg-[var(--color-success-soft)] text-[var(--color-success-accent)]" : "bg-muted",
        )}
      >
        {state === "done" ? <Check className="size-3.5" /> : state === "current" ? <CircularSpinner size={12} /> : <span className="size-1.5 rounded-full bg-muted-foreground/50" />}
      </span>
      {children}
    </li>
  );
}
