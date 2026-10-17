import { useState, type ChangeEvent, type ReactNode } from "react";
import { Plus, Upload, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { buttonVariants } from "../../components/ui/button-variants";
import { cn } from "../../lib/cn";
import { useBankingStore, usePayFromAccounts } from "../../store/useBankingStore";
import { BeneficiaryGate } from "./BeneficiaryGate";
import { useBeneficiariesReady } from "./beneficiaries";
import {
  AccountForm,
  AmountInput,
  BillPicker,
  DrawerFooter,
  FieldLabel,
  PayeePicker,
  LG,
  UnverifiedTag,
  OtpStep,
  PANEL,
  PayFromSelect,
  PurposeModeRow,
  ReviewRow,
  SuccessView,
  TransferDrawer,
  VerifiedDot,
} from "./shared";
import {
  BULK_BANKS_LABEL,
  BULK_TEMPLATE_HREF,
  PURPOSES,
  RTGS_MIN,
  amountOnly,
  bankFromIfsc,
  demoUploadRows,
  fmtINR,
  maskIfsc,
  oldestBill,
  type Bill,
  type BulkRow,
  type PayeeContact,
  type PickedPayee,
  type Purpose,
  type TransferMode,
} from "./data";

export interface BulkPreset {
  payFromId?: string;
  rows?: BulkRow[];
}

/** What's wrong with a row, if anything, in a few words. Blocking issues stop the batch from going to review. */
function rowIssue(row: BulkRow, duplicate: boolean): string | null {
  if (duplicate) return "Same account twice in this batch";
  if (!row.ifscValid) return "IFSC code is invalid · remove and add again";
  if (!row.amount || (parseFloat(row.amount) || 0) <= 0) return "Enter an amount";
  return null;
}

const DEFAULT_PURPOSE = (key: string): Purpose => (key.startsWith("employee:") ? "salary" : key.startsWith("contact:") ? "vendor" : "other");

export function BulkTransferDrawer({ preset, onClose }: { preset?: BulkPreset; onClose: () => void }) {
  const all = usePayFromAccounts();
  const options = all.filter((a) => a.bulkSupported);
  const [payFromId, setPayFromId] = useState(preset?.payFromId ?? options[0]?.id ?? all[0].id);
  const payFrom = all.find((a) => a.id === payFromId) ?? options[0] ?? all[0];

  const [rows, setRows] = useState<BulkRow[]>(preset?.rows ?? []);
  const [pickerOpen, setPickerOpen] = useState(!preset?.rows?.length);
  const [fileError, setFileError] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<Purpose | "">(preset?.rows?.length ? DEFAULT_PURPOSE(preset.rows[0].key) : "");
  const [purposeOther, setPurposeOther] = useState("");
  const [modeOverride, setModeOverride] = useState<TransferMode | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | "success">(1);
  const [otp, setOtp] = useState("");
  const [snapshot, setSnapshot] = useState<{ count: number; total: string } | null>(null);

  const keyCounts = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.key]: (acc[r.key] ?? 0) + 1 }), {});
  const computed = rows.map((r) => ({ row: r, issue: rowIssue(r, keyCounts[r.key] > 1) }));
  const total = rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const issueCount = computed.filter((c) => c.issue).length;
  const overBalance = total > payFrom.balance;
  // RTGS only when every payment in the batch qualifies.
  const rtgsDisabled = !rows.length || rows.some((r) => (parseFloat(r.amount) || 0) < RTGS_MIN);
  const mode: TransferMode = modeOverride && !(modeOverride === "RTGS" && rtgsDisabled) ? modeOverride : "NEFT";
  const purposeOpt = PURPOSES.find((p) => p.value === purpose);
  const purposeValid = purpose !== "" && (purpose !== "other" || purposeOther.trim() !== "");
  const makerChecker = payFrom.approvalMode === "maker-checker";
  const beneList = useBankingStore((s) => s.beneficiaries[payFrom.id]);
  const beneReady = useBeneficiariesReady(payFrom, rows.map((r) => r.key));
  const reviewDisabled = rows.length === 0 || issueCount > 0 || overBalance || !purposeValid || !beneReady;

  const addRows = (next: BulkRow[]) => {
    if (!next.length) return;
    setRows((prev) => [...prev, ...next]);
    if (!purpose) setPurpose(DEFAULT_PURPOSE(next[0].key));
  };
  const setAmount = (id: string, amount: string) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, amount } : r)));

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv"))
      return setFileError(`"${file.name}" isn't a CSV file. Download the template and re-upload using that format.`);
    if (file.size === 0) return setFileError(`"${file.name}" is empty. Add at least one payee row and re-upload.`);
    // Prototype: any non-empty CSV loads a fixed demo batch covering each row status.
    addRows(demoUploadRows());
    setPickerOpen(false);
    setFileError(null);
  };

  if (step === "success" && snapshot) {
    return (
      <TransferDrawer title="Bulk payment" width={798} step="success" onClose={onClose}>
        <SuccessView
          wide
          title={makerChecker ? "Submitted for approval" : "Transfer initiated"}
          body={
            makerChecker
              ? `${snapshot.count} payments totalling ${snapshot.total} have been submitted. They now need a checker's approval in net banking to complete.`
              : `${snapshot.count} payments totalling ${snapshot.total} have been initiated and are now processing.`
          }
          onDone={onClose}
        />
      </TransferDrawer>
    );
  }

  return (
    <TransferDrawer title="Bulk payment" width={798} step={step} onClose={onClose}>
      {step === 1 && (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-7 py-5">
            <div className="max-w-[440px] shrink-0">
              <PayFromSelect account={payFrom} options={options} note={`Bulk payment works with ${BULK_BANKS_LABEL}.`} onSelect={setPayFromId} />
            </div>

            <div className="flex shrink-0 flex-col gap-1.5">
              <FieldLabel>Pay to</FieldLabel>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button variant={pickerOpen ? "outline" : "primary"} onClick={() => setPickerOpen(true)} disabled={pickerOpen}>
                  <Plus />
                  Add payment
                </Button>
                <label className={buttonVariants({ variant: "outline" })}>
                  <Upload />
                  Upload file
                  <input type="file" accept=".csv" onChange={onUpload} className="hidden" />
                </label>
                <a href={BULK_TEMPLATE_HREF} download="payees-template.csv" className="text-xs font-medium text-primary hover:underline">
                  Download template
                </a>
              </div>
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
                onAdd={(payee, amount, docs) => {
                  addRows([{ ...payee, id: `r${Date.now()}`, amount, ifscValid: true, docs }]);
                  setPickerOpen(false);
                }}
              />
            )}

            {rows.length > 0 && (
              <div className="shrink-0 overflow-hidden rounded-md border border-border">
                <div className="grid grid-cols-[minmax(0,1fr)_160px_32px] gap-3 bg-muted px-3.5 py-2 text-xs font-medium text-muted-foreground">
                  <div>Payee</div>
                  <div>Amount</div>
                  <div />
                </div>
                {computed.map(({ row, issue }) => {
                  const bene = payFrom.needsBeneficiary ? beneList?.[row.key] : undefined;
                  return (
                    <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_160px_32px] items-center gap-3 border-t border-border px-3.5 py-2.5">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-2sm font-semibold">{row.name}</span>
                          {row.verified ? <VerifiedDot size={14} /> : <UnverifiedTag />}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {row.docs?.length ? `${row.docs.join(", ")} · ` : ""}
                          {row.bank} · {row.maskedIfsc}
                          {payFrom.needsBeneficiary &&
                            (bene?.status === "active" ? (
                              <>
                                {" · "}
                                <span className="font-mono">{bene.code}</span>
                              </>
                            ) : bene?.status === "pending" ? (
                              " · Waiting for checker"
                            ) : (
                              ` · Not in ${payFrom.short} beneficiaries`
                            ))}
                        </div>
                        {issue && <div className="mt-0.5 text-xs text-destructive">{issue}</div>}
                      </div>
                      <AmountInput
                        value={row.amount}
                        onChange={(v) => setAmount(row.id, amountOnly(v))}
                        invalid={!row.amount || (parseFloat(row.amount) || 0) <= 0}
                        label={`Amount for ${row.name}`}
                      />
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${row.name}`} onClick={() => setRows((prev) => prev.filter((x) => x.id !== row.id))}>
                        <X />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {rows.length === 0 && !pickerOpen && (
              <div className="shrink-0 rounded-md border border-dashed border-input px-6 py-8 text-center text-xs text-muted-foreground">
                Add payees one by one, or upload a CSV with name, account number, IFSC and amount.
              </div>
            )}

            {rows.length > 0 && (
              <div className="flex max-w-[600px] shrink-0 flex-col gap-[22px]">
                <BeneficiaryGate payFrom={payFrom} payees={rows.map((r) => ({ key: r.key, name: r.name }))} />
                <PurposeModeRow
                  purpose={purpose}
                  onPurpose={setPurpose}
                  purposeOther={purposeOther}
                  onPurposeOther={setPurposeOther}
                  mode={mode}
                  onMode={setModeOverride}
                  rtgsDisabled={rtgsDisabled}
                />
              </div>
            )}
          </div>

          <DrawerFooter wide className="flex-wrap items-center justify-between gap-4 py-3.5">
            <div className="flex flex-wrap gap-[22px] text-xs text-muted-foreground">
              <div>
                <span className="font-bold text-foreground">{rows.length}</span> {rows.length === 1 ? "payee" : "payees"}
              </div>
              <div>
                Total <span className={cn("font-bold", overBalance ? "text-destructive" : "text-foreground")}>{fmtINR(total)}</span>
              </div>
              <div>
                Available <span className="font-bold text-foreground">{fmtINR(payFrom.balance)}</span>
              </div>
              {overBalance ? (
                <div className="font-semibold text-destructive">Exceeds available balance</div>
              ) : (
                issueCount > 0 && <div className="font-semibold text-destructive">{issueCount} need attention</div>
              )}
            </div>
            <Button variant="primary" className={LG} disabled={reviewDisabled} onClick={() => setStep(2)}>
              Review batch
            </Button>
          </DrawerFooter>
        </>
      )}

      {step === 2 && (
        <>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-7 py-6">
            <div className="text-2sm font-semibold text-foreground">Review batch</div>
            <div className="flex max-w-[520px] flex-col gap-3.5 rounded-lg border border-border p-4">
              <ReviewRow label="From">
                {payFrom.bank} · {payFrom.masked}
              </ReviewRow>
              <ReviewRow label="Payees">{rows.length}</ReviewRow>
              <div className="flex justify-between gap-2.5">
                <span className="text-xs text-muted-foreground">Total amount</span>
                <span className="text-[15px] font-bold">{fmtINR(total)}</span>
              </div>
              <ReviewRow label="Mode">{mode} · Bank charges may apply</ReviewRow>
              <ReviewRow label="Purpose">{purpose === "other" ? `${purposeOpt?.label} — ${purposeOther}` : purposeOpt?.label}</ReviewRow>
              {makerChecker && <ReviewRow label="Approval">Checker approves in {payFrom.short} net banking</ReviewRow>}
            </div>
            <div className="max-h-[280px] max-w-[520px] overflow-y-auto rounded-md border border-border">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2.5 border-t border-border px-3.5 py-2.5 first:border-t-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-2sm font-semibold">
                      <span className="truncate">{r.name}</span>
                      {r.verified ? <VerifiedDot size={14} /> : <UnverifiedTag />}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.docs?.length ? `${r.docs.join(", ")} · ` : ""}
                      {r.bank} · {r.maskedIfsc}
                    </div>
                  </div>
                  <div className="shrink-0 text-2sm tabular-nums">{fmtINR(parseFloat(r.amount) || 0)}</div>
                </div>
              ))}
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
                useBankingStore.getState().addPayout({
                  name: `Bulk payment · ${rows.length} payees`,
                  detail: purpose === "other" ? purposeOther || "Other" : (purposeOpt?.label ?? `${rows.length} payments`),
                  amount: total,
                  fromAccountId: payFrom.id,
                  mode,
                  status: makerChecker ? "awaiting" : "processing",
                  batch: { count: rows.length, paid: 0, failed: 0 },
                  docs: rows.some((r) => r.docs?.length) ? rows.flatMap((r) => r.docs ?? []) : undefined,
                });
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

type AddPanel =
  | { type: "new-contact"; name: string }
  | { type: "contact-account"; contactId: string }
  | { type: "employee-account"; employeeId: string }
  | { type: "one-off" };

/** "Add payment" card: pick a contact / employee / one-off payee, then an amount (or a vendor's unpaid bills). */
function AddPayment({ onCancel, onAdd }: { onCancel: () => void; onAdd: (payee: PickedPayee, amount: string, docs?: string[]) => void }) {
  const contacts = useBankingStore((s) => s.contacts);
  const employees = useBankingStore((s) => s.employees);
  const store = useBankingStore.getState;
  const [selected, setSelected] = useState<PickedPayee | null>(null);
  const [panel, setPanel] = useState<AddPanel | null>(null);
  const [amount, setAmount] = useState("");
  const [bills, setBills] = useState<Bill[]>([]);
  const [billIds, setBillIds] = useState<string[]>([]);

  const pick = (payee: PickedPayee, contact?: PayeeContact) => {
    setSelected(payee);
    setPanel(null);
    // Vendors with unpaid bills: pre-select the oldest bill and fill its amount, as in New payment.
    const open = contact?.category === "vendor" ? (contact.bills ?? []) : [];
    setBills(open);
    if (open.length) {
      const oldest = oldestBill(open);
      setBillIds([oldest.id]);
      setAmount(String(oldest.amount));
    } else {
      setBillIds([]);
    }
  };
  const addDisabled = !selected || (parseFloat(amount) || 0) <= 0;
  const docs = bills.filter((b) => billIds.includes(b.id)).map((b) => b.number);

  const body = (() => {
    if (selected)
      return (
        <>
          <div className={cn(PANEL, "flex items-start justify-between gap-2.5 p-3")}>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-2sm font-semibold">
                {selected.name}
                {selected.verified && <VerifiedDot size={14} />}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {selected.bank} · {selected.maskedIfsc}
              </div>
            </div>
            <Button
              variant="link"
              className="shrink-0 text-xs"
              onClick={() => {
                setSelected(null);
                setBills([]);
                setBillIds([]);
                setAmount("");
              }}
            >
              Change
            </Button>
          </div>
          {bills.length > 0 && (
            <BillPicker
              bills={bills}
              value={billIds}
              onChange={(ids, sum) => {
                setBillIds(ids);
                setAmount(sum > 0 ? String(sum) : "");
              }}
            />
          )}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Amount</FieldLabel>
            <AmountInput value={amount} onChange={(v) => setAmount(amountOnly(v))} />
          </div>
          <Button variant="primary" disabled={addDisabled} onClick={() => selected && onAdd(selected, amount, docs.length ? docs : undefined)}>
            Add to batch
          </Button>
        </>
      );

    const compactForm = (title: string, onSubmit: Parameters<typeof AccountForm>[0]["onSubmit"]) => (
      <AccountForm title={title} labelled={false} onCancel={() => setPanel(null)} onSubmit={onSubmit} />
    );
    let sub: ReactNode = null;
    if (panel?.type === "new-contact")
      sub = compactForm(`New contact: ${panel.name}`, (input) => {
        const { contact, account } = store().addContact(panel.name, input);
        pick({ key: `contact:${contact.id}:${account.id}`, name: contact.name, bank: account.bank, maskedIfsc: maskIfsc(account.ifsc), verified: account.verified });
      });
    else if (panel?.type === "contact-account") {
      const contactId = panel.contactId;
      const contact = contacts.find((c) => c.id === contactId);
      sub = compactForm(`New account for ${contact?.name ?? ""}`, (input) => {
        const account = store().addContactAccount(contactId, input);
        pick(
          { key: `contact:${contactId}:${account.id}`, name: contact?.name ?? "", bank: account.bank, maskedIfsc: maskIfsc(account.ifsc), verified: account.verified },
          contact,
        );
      });
    } else if (panel?.type === "employee-account") {
      const employeeId = panel.employeeId;
      const name = employees.find((e) => e.id === employeeId)?.name ?? "";
      sub = compactForm(`Add account for ${name}`, (input) => {
        const account = store().setEmployeeAccount(employeeId, input);
        pick({ key: `employee:${employeeId}`, name, bank: account.bank, maskedIfsc: maskIfsc(account.ifsc), verified: account.verified });
      });
    } else if (panel?.type === "one-off")
      sub = (
        <AccountForm
          withPayeeName
          labelled={false}
          onCancel={() => setPanel(null)}
          onSubmit={({ name, accountNumber, ifsc, verified, saveAsContact }) => {
            if (saveAsContact) store().addContact(name, { accountNumber, ifsc, verified });
            pick({ key: `other:${Date.now()}`, name, bank: bankFromIfsc(ifsc), maskedIfsc: maskIfsc(ifsc), verified });
          }}
        />
      );
    if (sub) return sub;

    return (
      <PayeePicker
        onSelectContact={(c, a) => pick({ key: `contact:${c.id}:${a.id}`, name: c.name, bank: a.bank, maskedIfsc: maskIfsc(a.ifsc), verified: a.verified }, c)}
        onAddContact={(name) => setPanel({ type: "new-contact", name })}
        onAddContactAccount={(c) => setPanel({ type: "contact-account", contactId: c.id })}
        onSelectEmployee={(e) =>
          e.account && pick({ key: `employee:${e.id}`, name: e.name, bank: e.account.bank, maskedIfsc: maskIfsc(e.account.ifsc), verified: e.account.verified })
        }
        onEmployeeNeedsAccount={(e) => setPanel({ type: "employee-account", employeeId: e.id })}
        onOneOff={() => setPanel({ type: "one-off" })}
      />
    );
  })();

  return (
    <div className={cn(PANEL, "flex max-w-[440px] shrink-0 flex-col gap-3")}>
      <div className="flex items-center justify-between">
        <div className="text-2sm font-semibold">Add payment</div>
        <Button variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Cancel">
          <X />
        </Button>
      </div>
      {body}
    </div>
  );
}
