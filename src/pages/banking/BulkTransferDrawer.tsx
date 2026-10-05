import { useState, type ChangeEvent } from "react";
import { Plus, X } from "lucide-react";
import { Badge, type BadgeVariant } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { buttonVariants } from "../../components/ui/button-variants";
import { cn } from "../../lib/cn";
import { useBankingStore } from "../../store/useBankingStore";
import {
  AccountForm,
  AmountInput,
  BeneTypeTabs,
  ContactPicker,
  DrawerFooter,
  EmployeePicker,
  LG,
  Note,
  OtpStep,
  PANEL,
  PayFromSelect,
  ReviewRow,
  SuccessView,
  TransferDrawer,
  type BeneType,
} from "./shared";
import {
  BULK_BANKS_LABEL,
  BULK_TEMPLATE_HREF,
  amountOnly,
  approvalNote,
  bankFromIfsc,
  demoUploadRows,
  fmtINR,
  maskIfsc,
  payFromAccounts,
  type BulkRow,
  type PickedPayee,
} from "./data";

export interface BulkPreset {
  payFromId?: string;
  rows?: BulkRow[];
}

type RowStatus = { label: string; variant: BadgeVariant; error: string | null; blocking: boolean };

function rowStatus(row: BulkRow, duplicate: boolean): RowStatus {
  if (duplicate) return { label: "Duplicate", variant: "destructive", error: "Duplicate account in this batch", blocking: true };
  if (!row.ifscValid) return { label: "Invalid IFSC", variant: "destructive", error: "IFSC code is invalid", blocking: true };
  if (!row.amount || (parseFloat(row.amount) || 0) <= 0)
    return { label: "Missing Amount", variant: "destructive", error: "Enter an amount for this row", blocking: true };
  if (!row.verified) return { label: "Unverified", variant: "warning", error: null, blocking: false };
  return { label: "Verified", variant: "success", error: null, blocking: false };
}

export function BulkTransferDrawer({ preset, onClose }: { preset?: BulkPreset; onClose: () => void }) {
  const scenario = useBankingStore((s) => s.scenario);
  const all = payFromAccounts(scenario);
  const options = all.filter((a) => a.bulkSupported);
  const [payFromId, setPayFromId] = useState(preset?.payFromId ?? options[0]?.id ?? all[0].id);
  const payFrom = all.find((a) => a.id === payFromId) ?? options[0] ?? all[0];

  const [rows, setRows] = useState<BulkRow[]>(preset?.rows ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | "success">(1);
  const [listOpen, setListOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [snapshot, setSnapshot] = useState<{ count: number; total: string } | null>(null);

  const keyCounts = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.key]: (acc[r.key] ?? 0) + 1 }), {});
  const computed = rows.map((r) => ({ row: r, status: rowStatus(r, keyCounts[r.key] > 1) }));
  const total = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const errorCount = computed.filter((c) => c.status.blocking).length;
  const unverifiedCount = computed.filter((c) => c.status.label === "Unverified").length;
  const makerChecker = payFrom.approvalMode === "maker-checker";

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv"))
      return setFileError(`"${file.name}" isn't a CSV file. Download the template and re-upload using that format.`);
    if (file.size === 0) return setFileError(`"${file.name}" is empty. Add at least one beneficiary row and re-upload.`);
    // Prototype: any non-empty CSV loads a fixed demo batch covering each row status.
    setRows((prev) => [...prev, ...demoUploadRows()]);
    setFileError(null);
  };

  if (step === "success" && snapshot) {
    return (
      <TransferDrawer title="Bulk Transfer" width={798} step="success" onClose={onClose}>
        <SuccessView
          wide
          title={makerChecker ? "Submitted for approval" : "Transfer initiated"}
          body={
            makerChecker
              ? `${snapshot.count} transfers totalling ${snapshot.total} have been submitted. They now need a checker's approval in netbanking to complete.`
              : `${snapshot.count} transfers totalling ${snapshot.total} have been initiated and are now processing.`
          }
          onDone={onClose}
        />
      </TransferDrawer>
    );
  }

  return (
    <TransferDrawer title="Bulk Transfer" width={798} step={step} onClose={onClose}>
      {step === 1 && (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-7 py-5">
            <div className="max-w-[340px] shrink-0">
              <PayFromSelect
                account={payFrom}
                options={options}
                note={`Bulk transfer is limited to supported banks (${BULK_BANKS_LABEL}, for now). ${approvalNote(payFrom.approvalMode)}`}
                onSelect={setPayFromId}
              />
            </div>

            <div className="flex shrink-0 gap-2.5">
              <Button variant="primary" onClick={() => setPickerOpen(true)}>
                <Plus />
                Add Payment
              </Button>
              <label className={buttonVariants({ variant: "outline" })}>
                Upload File
                <input type="file" onChange={onUpload} className="hidden" />
              </label>
              <a href={BULK_TEMPLATE_HREF} download="beneficiaries-template.csv" className="self-center text-xs font-medium text-primary hover:underline">
                Download Template
              </a>
            </div>

            {fileError && (
              <div className="flex max-w-[600px] shrink-0 items-start justify-between gap-2.5 rounded-md bg-[var(--color-destructive-soft)] px-3 py-2.5">
                <span className="text-xs leading-snug text-destructive">{fileError}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => setFileError(null)} aria-label="Dismiss">
                  <X />
                </Button>
              </div>
            )}

            {pickerOpen && (
              <AddPayment
                onCancel={() => setPickerOpen(false)}
                onAdd={(payee, amount) => {
                  setRows((prev) => [...prev, { ...payee, id: `r${Date.now()}`, amount, ifscValid: true }]);
                  setPickerOpen(false);
                }}
              />
            )}

            {rows.length > 0 && (
              <div className="shrink-0 overflow-hidden rounded-md border border-border">
                <div className="grid grid-cols-[1fr_120px_140px_40px] gap-2 bg-muted px-3.5 py-2.5 text-xs font-semibold uppercase tracking-[0.02em] text-muted-foreground">
                  <div>Beneficiary</div>
                  <div>Amount</div>
                  <div>Status</div>
                  <div />
                </div>
                {computed.map(({ row, status }) => (
                  <div key={row.id} className="grid grid-cols-[1fr_120px_140px_40px] items-center gap-2 border-t border-border px-3.5 py-3">
                    <div>
                      <div className="text-2sm font-semibold">{row.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {row.bank} · {row.maskedIfsc}
                      </div>
                    </div>
                    <div className="text-2sm tabular-nums">{row.amount ? fmtINR(parseFloat(row.amount) || 0) : "—"}</div>
                    <div>
                      <Badge variant={status.variant} className={cn(status.variant === "destructive" && "text-destructive")}>
                        {status.label}
                      </Badge>
                      {status.error && <div className="mt-[3px] text-[11px] text-destructive">{status.error}</div>}
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => setRows((prev) => prev.filter((x) => x.id !== row.id))}>
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DrawerFooter wide className="flex-wrap items-center justify-between gap-4 py-3.5">
            <div className="flex flex-wrap gap-[22px] text-xs text-muted-foreground">
              <div>
                <span className="font-bold text-foreground">{rows.length}</span> beneficiaries
              </div>
              <div>
                Total <span className="font-bold text-foreground">{fmtINR(total)}</span>
              </div>
              <div>
                Available <span className="font-bold text-foreground">{fmtINR(payFrom.balance)}</span>
              </div>
              {errorCount > 0 && <div className="font-semibold text-destructive">{errorCount} need attention</div>}
            </div>
            <Button variant="primary" className={LG} disabled={rows.length === 0 || errorCount > 0} onClick={() => setStep(2)}>
              Review Batch
            </Button>
          </DrawerFooter>
        </>
      )}

      {step === 2 && (
        <>
          <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-7 py-6">
            <div className="text-2sm font-semibold text-foreground">Review Batch</div>
            <div className="flex max-w-[440px] flex-col gap-3.5 rounded-lg border border-border p-4">
              <ReviewRow label="From">
                {payFrom.bank} · {payFrom.masked}
              </ReviewRow>
              <ReviewRow label="Beneficiaries">{rows.length}</ReviewRow>
              <div className="flex justify-between gap-2.5">
                <span className="text-xs text-muted-foreground">Total amount</span>
                <span className="text-[15px] font-bold">{fmtINR(total)}</span>
              </div>
            </div>
            {unverifiedCount > 0 && (
              <Note tone="warning" className="max-w-[440px]">
                {unverifiedCount} beneficiaries are unverified. You can still proceed — verification isn't required to send.
              </Note>
            )}
            {makerChecker && (
              <Note tone="warning" className="max-w-[440px]">
                Confirming here only initiates this batch. It will need a checker's approval in netbanking to complete.
              </Note>
            )}
            <div>
              <Button variant="link" className="text-xs" onClick={() => setListOpen(!listOpen)}>
                {listOpen ? "Hide Beneficiary List" : `Show All ${rows.length} Beneficiaries`}
              </Button>
              {listOpen && (
                <div className="mt-2.5 max-w-[520px] rounded-md border border-border">
                  {rows.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2.5 border-t border-border px-3.5 py-2.5 first:border-t-0">
                      <div>
                        <div className="text-2sm font-semibold">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.bank} · {r.maskedIfsc}
                        </div>
                      </div>
                      <div className="text-2sm tabular-nums">{fmtINR(parseFloat(r.amount) || 0)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DrawerFooter wide>
            <Button className={cn(LG, "max-w-[200px] flex-1")} onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              variant="primary"
              className={cn(LG, "max-w-[280px] flex-[2]")}
              onClick={() => {
                setOtp("");
                setStep(3);
              }}
            >
              Continue to OTP
            </Button>
          </DrawerFooter>
        </>
      )}

      {step === 3 && (
        <>
          <div className="flex flex-1 flex-col overflow-y-auto px-7 py-6">
            <div className="max-w-[360px]">
              <OtpStep bankName={payFrom.bank} suffix=" to authorize this batch" value={otp} onChange={setOtp} />
            </div>
          </div>
          <DrawerFooter wide>
            <Button className={cn(LG, "max-w-[200px] flex-1")} onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              variant="primary"
              className={cn(LG, "max-w-[280px] flex-[2]")}
              disabled={otp.length !== 6}
              onClick={() => {
                setSnapshot({ count: rows.length, total: fmtINR(total) });
                setStep("success");
              }}
            >
              {makerChecker ? "Verify & Submit" : "Verify & Pay"}
            </Button>
          </DrawerFooter>
        </>
      )}
    </TransferDrawer>
  );
}

type AddPanel = { type: "new-contact"; name: string } | { type: "contact-account"; contactId: string } | { type: "employee-account"; employeeId: string };

/** "Add Payment" card: pick a contact / employee / one-off payee, then an amount. */
function AddPayment({ onCancel, onAdd }: { onCancel: () => void; onAdd: (payee: PickedPayee, amount: string) => void }) {
  const contacts = useBankingStore((s) => s.contacts);
  const employees = useBankingStore((s) => s.employees);
  const store = useBankingStore.getState;
  const [beneType, setBeneTypeRaw] = useState<BeneType>("contact");
  const [selected, setSelected] = useState<PickedPayee | null>(null);
  const [panel, setPanel] = useState<AddPanel | null>(null);
  const [amount, setAmount] = useState("");

  const setBeneType = (t: BeneType) => {
    setBeneTypeRaw(t);
    setPanel(null);
  };
  const pick = (payee: PickedPayee) => {
    setSelected(payee);
    setPanel(null);
  };
  const addDisabled = !selected || (parseFloat(amount) || 0) <= 0;

  const body = (() => {
    if (selected)
      return (
        <>
          <div className={cn(PANEL, "flex items-start justify-between gap-2.5 p-3")}>
            <div className="min-w-0">
              <div className="text-2sm font-semibold">{selected.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {selected.bank} · {selected.maskedIfsc}
              </div>
            </div>
            <Button variant="link" className="shrink-0 text-xs" onClick={() => setSelected(null)}>
              Change
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-medium text-foreground">Amount</div>
            <AmountInput value={amount} onChange={(v) => setAmount(amountOnly(v))} />
          </div>
          <Button variant="primary" disabled={addDisabled} onClick={() => selected && onAdd(selected, amount)}>
            Add to Batch
          </Button>
        </>
      );

    const compactForm = (title: string, onSubmit: Parameters<typeof AccountForm>[0]["onSubmit"]) => (
      <AccountForm title={title} labelled={false} onCancel={() => setPanel(null)} onSubmit={onSubmit} />
    );
    let sub = null;
    if (panel?.type === "new-contact")
      sub = compactForm(`New contact: ${panel.name}`, (input) => {
        const { contact, account } = store().addContact(panel.name, input);
        pick({ key: `contact:${contact.id}:${account.id}`, name: contact.name, bank: account.bank, maskedIfsc: maskIfsc(account.ifsc), verified: account.verified });
      });
    else if (panel?.type === "contact-account") {
      const contactId = panel.contactId;
      const name = contacts.find((c) => c.id === contactId)?.name ?? "";
      sub = compactForm(`New account for ${name}`, (input) => {
        const account = store().addContactAccount(contactId, input);
        pick({ key: `contact:${contactId}:${account.id}`, name, bank: account.bank, maskedIfsc: maskIfsc(account.ifsc), verified: account.verified });
      });
    } else if (panel?.type === "employee-account") {
      const employeeId = panel.employeeId;
      const name = employees.find((e) => e.id === employeeId)?.name ?? "";
      sub = compactForm(`Add account for ${name}`, (input) => {
        const account = store().setEmployeeAccount(employeeId, input);
        pick({ key: `employee:${employeeId}`, name, bank: account.bank, maskedIfsc: maskIfsc(account.ifsc), verified: account.verified });
      });
    }

    return (
      <>
        <BeneTypeTabs value={beneType} onChange={setBeneType} />
        {beneType === "contact" && (
          <ContactPicker
            onSelect={(c, a) => pick({ key: `contact:${c.id}:${a.id}`, name: c.name, bank: a.bank, maskedIfsc: maskIfsc(a.ifsc), verified: a.verified })}
            onAddNew={(name) => setPanel({ type: "new-contact", name })}
            onAddAccount={(c) => setPanel({ type: "contact-account", contactId: c.id })}
          />
        )}
        {beneType === "employee" && (
          <EmployeePicker
            onSelect={(e) =>
              e.account &&
              pick({ key: `employee:${e.id}`, name: e.name, bank: e.account.bank, maskedIfsc: maskIfsc(e.account.ifsc), verified: e.account.verified })
            }
            onNeedsAccount={(e) => setPanel({ type: "employee-account", employeeId: e.id })}
          />
        )}
        {beneType === "other" && (
          <AccountForm
            withPayeeName
            labelled={false}
            onSubmit={({ name, accountNumber, ifsc, verified, saveAsContact }) => {
              if (saveAsContact) store().addContact(name, { accountNumber, ifsc, verified });
              pick({ key: `other:${Date.now()}`, name, bank: bankFromIfsc(ifsc), maskedIfsc: maskIfsc(ifsc), verified });
            }}
          />
        )}
        {sub}
      </>
    );
  })();

  return (
    <div className={cn(PANEL, "flex max-w-[440px] shrink-0 flex-col gap-3")}>
      <div className="flex items-center justify-between">
        <div className="text-2sm font-semibold">Add Payment</div>
        <Button variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Cancel">
          <X />
        </Button>
      </div>
      {body}
    </div>
  );
}
