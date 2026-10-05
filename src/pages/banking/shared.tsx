import { useState, type ClipboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { popoverCls } from "../../components/ui/popover";
import { useBankingStore, type NewAccountInput } from "../../store/useBankingStore";
import { useEscape } from "./useEscape";
import { BankIcon } from "./BankLogo";
import {
  bankKeyFromName,
  digitsOnly,
  fmtINR,
  maskIfsc,
  type BankAccount,
  type Employee,
  type PayeeContact,
  type PayFromAccount,
} from "./data";

// Building blocks shared by the Single and Bulk Transfer drawers.

export const OVERLAY = "fixed inset-0 z-50 bg-black/30 [backdrop-filter:blur(4px)] animate-[fade-in_.15s_ease]";
/** Inline bordered panel (new-account forms, selected beneficiary card). */
export const PANEL = "rounded-md border border-input p-3.5";
const LIST_PANEL = cn(popoverCls, "absolute inset-x-0 top-full z-20 mt-1 overflow-hidden");
const ROW = "cursor-pointer border-b border-border px-3 py-[11px] last:border-b-0 hover:bg-accent/60";

const blockClipboard = (e: ClipboardEvent) => e.preventDefault();

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-xs font-medium text-foreground">{children}</div>;
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

export function ErrorText({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-xs text-destructive", className)}>{children}</div>;
}

export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-xs text-muted-foreground", className)}>{children}</div>;
}

export function VerifiedDot({ size = 16 }: { size?: 14 | 16 }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success-accent)]",
        size === 14 ? "size-3.5" : "size-4",
      )}
    >
      <Check className="size-3" />
    </span>
  );
}

export function Note({ tone, children, className }: { tone: "primary" | "warning"; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md px-3 py-2.5 text-xs",
        tone === "primary"
          ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-accent)]"
          : "bg-[var(--color-warning-soft)] text-[var(--color-warning-accent)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Click-away layer for the custom dropdowns below. */
export function ClickAway({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-10" onClick={onClose} />;
}

/** Select-trigger-looking button (components.md → Select trigger). */
export function SelectButton({ onClick, children, className }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-h-8.5 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-2sm text-foreground shadow-xs shadow-black/5",
        className,
      )}
    >
      {children}
      <ChevronDown className="size-4 shrink-0 opacity-60" />
    </button>
  );
}

export function PayFromSelect({
  account,
  options,
  note,
  onSelect,
}: {
  account: PayFromAccount;
  options: PayFromAccount[];
  note: ReactNode;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("relative flex flex-col gap-1.5", open && "z-30")}>
      <FieldLabel>Pay From</FieldLabel>
      {open && <ClickAway onClose={() => setOpen(false)} />}
      <SelectButton onClick={() => setOpen(!open)} className={cn("py-2", open && "z-20")}>
        <AccountLine account={account} />
      </SelectButton>
      <Hint>{note}</Hint>
      {open && (
        <div className={LIST_PANEL}>
          {options.map((a) => (
            <div
              key={a.id}
              className={ROW}
              onClick={() => {
                onSelect(a.id);
                setOpen(false);
              }}
            >
              <AccountLine account={a} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountLine({ account }: { account: PayFromAccount }) {
  return (
    <div className="flex items-center gap-2.5">
      {bankKeyFromName(account.bank) && <BankIcon bank={bankKeyFromName(account.bank)!} size={28} />}
      <div>
        <div className="text-2sm font-semibold">
          {account.bank} · {account.masked}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">Available balance: {fmtINR(account.balance)}</div>
      </div>
    </div>
  );
}

export function AmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center rounded-md border border-input px-3 shadow-xs shadow-black/5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
      <span className="text-2sm text-muted-foreground">₹</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        inputMode="decimal"
        className="h-8 flex-1 bg-transparent px-1.5 text-2sm tabular-nums text-foreground outline-none"
      />
    </div>
  );
}

export type BeneType = "contact" | "employee" | "other";

export function BeneTypeTabs({ value, onChange }: { value: BeneType; onChange: (v: BeneType) => void }) {
  return (
    <div role="tablist" className="flex gap-1 rounded-lg border border-border/80 bg-muted/80 p-1">
      {(["contact", "employee", "other"] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          className={cn(
            "h-8 flex-1 cursor-pointer rounded-md px-3 text-2sm capitalize text-foreground",
            value === t && "bg-background shadow-lg shadow-black/5",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/**
 * Account number + confirm + IFSC + "Verify Account". Used for a new contact, another account on a
 * contact/employee, and a one-off ("Other") payee. `labelled` is the single-transfer look (labels
 * above fields); the bulk picker uses placeholder-only fields.
 */
export function AccountForm({
  title,
  labelled = true,
  withPayeeName = false,
  bordered = true,
  onCancel,
  onSubmit,
}: {
  title?: ReactNode;
  labelled?: boolean;
  /** One-off payee: adds Payee Name and "Save as Contact". */
  withPayeeName?: boolean;
  bordered?: boolean;
  onCancel?: () => void;
  onSubmit: (input: NewAccountInput & { name: string; saveAsContact: boolean }) => void;
}) {
  const [name, setName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [saveAsContact, setSaveAsContact] = useState(false);
  const [verify, setVerify] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const mismatch = confirm !== "" && accountNumber !== confirm;
  const disabled =
    (withPayeeName && name.trim() === "") || accountNumber.trim().length < 6 || mismatch || confirm === "" || ifsc.trim().length !== 11;

  const submit = () => {
    if (disabled) return;
    const finish = () => onSubmit({ name: name.trim(), accountNumber, ifsc, verified: verify, saveAsContact });
    if (!verify) return finish();
    setVerifying(true);
    setTimeout(finish, 1100);
  };

  const field = (label: string, input: ReactNode) =>
    labelled ? (
      <div className="flex flex-col gap-[5px]">
        <FieldLabel>{label}</FieldLabel>
        {input}
      </div>
    ) : (
      input
    );
  const ph = (long: string, short: string) => (labelled ? long : short);

  return (
    <div className={cn("flex flex-col gap-3", bordered && PANEL)}>
      {title && (
        <div className="flex items-center justify-between">
          <div className="text-2sm font-semibold">{title}</div>
          {onCancel && (
            <Button variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Cancel">
              <X />
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        {withPayeeName &&
          field("Payee Name", <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={ph("Full name", "Payee name")} />)}
        {field(
          "Account Number",
          <Input
            type="password"
            value={accountNumber}
            onChange={(e) => setAccountNumber(digitsOnly(e.target.value))}
            onCopy={blockClipboard}
            onCut={blockClipboard}
            onPaste={blockClipboard}
            placeholder={ph("Enter Account Number", "Account number")}
            className="tabular-nums"
          />,
        )}
        {field(
          "Confirm Account Number",
          <Input
            value={confirm}
            onChange={(e) => setConfirm(digitsOnly(e.target.value))}
            placeholder={ph("Re-enter Account Number", "Confirm account number")}
            className="tabular-nums"
          />,
        )}
        {mismatch && <ErrorText>Account numbers don't match</ErrorText>}
        {field(
          "IFSC Code",
          <Input
            value={ifsc}
            onChange={(e) => setIfsc(e.target.value.toUpperCase().slice(0, 11))}
            placeholder={ph("e.g. ICIC0000567", "IFSC code")}
            className="uppercase tabular-nums"
          />,
        )}
        {withPayeeName && (
          <CheckRow checked={saveAsContact} onChange={setSaveAsContact}>
            Save as Contact for Future Transfers
          </CheckRow>
        )}
        <CheckRow checked={verify} onChange={setVerify}>
          Verify Account
        </CheckRow>
        {verifying ? (
          <div className="py-1.5 text-center text-xs text-muted-foreground">Verifying account…</div>
        ) : (
          <Button variant="primary" className="w-full" disabled={disabled} onClick={submit}>
            Add Account
          </Button>
        )}
      </div>
    </div>
  );
}

function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4.5 cursor-pointer accent-primary" />
      {children}
    </label>
  );
}

/** "Search contacts…" with an expandable contact → account list and an "add as new contact" card. */
export function ContactPicker({
  onSelect,
  onAddNew,
  onAddAccount,
}: {
  onSelect: (contact: PayeeContact, account: BankAccount) => void;
  onAddNew: (name: string) => void;
  onAddAccount: (contact: PayeeContact) => void;
}) {
  const contacts = useBankingStore((s) => s.contacts);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const trimmed = search.trim();
  const filtered = trimmed === "" ? contacts : contacts.filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()));
  const showAddNew = trimmed !== "" && filtered.length === 0;
  const dropdownOpen = open || !!expandedId;
  const close = () => {
    setOpen(false);
    setExpandedId(null);
  };

  return (
    <div className="relative flex flex-col gap-1.5">
      {dropdownOpen && <ClickAway onClose={close} />}
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        placeholder="Search contacts..."
        className="relative z-20"
      />
      {dropdownOpen && (
        <div className={cn(LIST_PANEL, "flex max-h-[360px] flex-col gap-2 overflow-y-auto p-2")}>
          {showAddNew ? (
            <div
              onClick={() => {
                close();
                onAddNew(trimmed);
              }}
              className="cursor-pointer rounded-md border border-dashed border-input p-3 text-center text-2sm text-foreground hover:bg-accent/60"
            >
              + Add "{trimmed}" as a new contact
            </div>
          ) : (
            <div className="rounded-md border border-border">
              {filtered.map((c) => {
                const expanded = expandedId === c.id;
                return (
                  <div key={c.id} className="border-b border-border last:border-b-0">
                    <div
                      onClick={() => setExpandedId(expanded ? null : c.id)}
                      className="flex cursor-pointer items-center justify-between gap-2 px-3 py-[11px] hover:bg-accent/60"
                    >
                      <div className="text-2sm font-semibold">
                        {c.name}
                        <span className="text-xs font-normal text-muted-foreground">
                          {" "}
                          · {c.accounts.length === 1 ? "1 account" : `${c.accounts.length} accounts`}
                        </span>
                      </div>
                      <ChevronDown className={cn("size-4 shrink-0 opacity-60 transition-transform duration-200", expanded && "rotate-180")} />
                    </div>
                    {expanded && (
                      <>
                        {c.accounts.map((a) => (
                          <div
                            key={a.id}
                            onClick={() => {
                              close();
                              setSearch("");
                              onSelect(c, a);
                            }}
                            className="flex cursor-pointer items-center justify-between gap-2 border-t border-border bg-muted py-2.5 pe-3 ps-[22px] hover:bg-accent"
                          >
                            <div className="text-2sm font-medium">
                              {a.bank} · {maskIfsc(a.ifsc)}
                            </div>
                            {a.verified ? <VerifiedDot /> : <Badge variant="warning">Unverified</Badge>}
                          </div>
                        ))}
                        <div
                          onClick={() => {
                            close();
                            onAddAccount(c);
                          }}
                          className="cursor-pointer border-t border-border bg-muted py-2.5 pe-3 ps-[22px] text-xs font-semibold text-primary hover:bg-accent"
                        >
                          Add Another Bank Account
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** "Search employees…" with an inline list; missing employees route to HRMS (placeholder). */
export function EmployeePicker({
  onSelect,
  onNeedsAccount,
}: {
  onSelect: (employee: Employee) => void;
  onNeedsAccount: (employee: Employee) => void;
}) {
  const employees = useBankingStore((s) => s.employees);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const trimmed = search.trim();
  const filtered = trimmed === "" ? employees : employees.filter((e) => e.name.toLowerCase().includes(trimmed.toLowerCase()));
  const notFound = trimmed !== "" && filtered.length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        placeholder="Search employees..."
      />
      {redirecting ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-border p-3.5 text-center">
          <div className="size-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <div className="text-2sm text-muted-foreground">Redirecting to HRMS to add "{trimmed}"… (Placeholder in this prototype.)</div>
          <button type="button" onClick={() => setRedirecting(false)} className="cursor-pointer text-xs font-semibold text-primary hover:underline">
            Back
          </button>
        </div>
      ) : (
        open && (
          <div className="max-h-[280px] overflow-y-auto rounded-md border border-border">
            {notFound ? (
              <div className="flex flex-col gap-2 p-3.5">
                <div className="text-2sm text-foreground">Can't find "{trimmed}" in the employee list.</div>
                <Button size="sm" className="self-start" onClick={() => setRedirecting(true)}>
                  Add in HRMS
                </Button>
              </div>
            ) : (
              filtered.map((e) => (
                <div
                  key={e.id}
                  onClick={() => {
                    setOpen(false);
                    setSearch("");
                    if (e.account) onSelect(e);
                    else onNeedsAccount(e);
                  }}
                  className={cn(ROW, "flex items-center justify-between gap-2")}
                >
                  <div className="min-w-0">
                    <div className="text-2sm font-semibold">
                      {e.name}
                      <span className="text-xs font-normal text-muted-foreground"> · {e.role}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {e.account ? `${e.account.bank} · ${maskIfsc(e.account.ifsc)}` : "No bank account on file"}
                    </div>
                  </div>
                  {e.account && (e.account.verified ? <VerifiedDot /> : <Badge variant="warning">Unverified</Badge>)}
                </div>
              ))
            )}
          </div>
        )
      )}
    </div>
  );
}

/** Right-floating drawer with the "Step n of 3" header shared by both flows. */
export function TransferDrawer({
  title,
  width,
  step,
  onClose,
  children,
}: {
  title: string;
  width: 520 | 798;
  step: 1 | 2 | 3 | "success";
  onClose: () => void;
  children: ReactNode;
}) {
  useEscape(onClose);
  const wide = width === 798;
  return (
    <>
      <div className={OVERLAY} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "fixed bottom-5 end-5 top-5 z-50 flex max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg animate-[drawer-in_.4s_cubic-bezier(.4,0,.2,1)]",
          wide ? "w-[798px]" : "w-[520px]",
        )}
      >
        {step !== "success" && (
          <div className={cn("flex flex-col gap-3 border-b border-border pb-4 pt-5", wide ? "px-7" : "px-6")}>
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">{title}</div>
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
                <X />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3].map((n) => (
                  <div key={n} className={cn("h-[3px] flex-1 rounded-sm", step >= n ? "bg-primary" : "bg-border")} />
                ))}
              </div>
              <div className="whitespace-nowrap text-xs font-semibold text-muted-foreground">Step {step} of 3</div>
            </div>
          </div>
        )}
        {children}
      </div>
    </>
  );
}

export function DrawerFooter({ wide, className, children }: { wide?: boolean; className?: string; children: ReactNode }) {
  return <div className={cn("flex gap-2.5 border-t border-border py-4", wide ? "px-7" : "px-6", className)}>{children}</div>;
}

/** Large (40px) button size from the design; the app's Button tops out at 34px. */
export const LG = "h-10 px-4 text-sm";

export function OtpStep({ bankName, suffix, value, onChange }: { bankName: string; suffix?: string; value: string; onChange: (v: string) => void }) {
  const [resent, setResent] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[15px] font-semibold">Enter OTP</div>
        <div className="mt-1 text-2sm leading-normal text-muted-foreground">
          Enter the 6-digit code sent to your registered mobile number for {bankName}
          {suffix ?? ""}.
        </div>
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(digitsOnly(e.target.value).slice(0, 6))}
        placeholder="000000"
        inputMode="numeric"
        autoFocus
        className="h-12 text-center text-xl tracking-[6px] tabular-nums"
      />
      <button type="button" onClick={() => setResent(true)} className="cursor-pointer self-center text-xs font-semibold text-primary hover:underline">
        Resend OTP
      </button>
      {resent && <div className="text-center text-xs text-muted-foreground">Code resent.</div>}
    </div>
  );
}

export function SuccessView({ title, body, onDone, wide }: { title: string; body: string; onDone: () => void; wide?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-[52px] items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success-accent)]">
        <Check className="size-6" />
      </div>
      <div className="text-base font-semibold">{title}</div>
      <div className={cn("text-2sm leading-relaxed text-muted-foreground", wide && "max-w-[440px]")}>{body}</div>
      <Button variant="primary" className={cn(LG, "mt-2", wide ? "w-[280px]" : "w-full")} onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

export function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-2sm font-semibold">{children}</span>
    </div>
  );
}
