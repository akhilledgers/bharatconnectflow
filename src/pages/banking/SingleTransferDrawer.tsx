import { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/cn";
import { useBankingStore, usePayFromAccounts } from "../../store/useBankingStore";
import {
  AccountForm,
  AmountInput,
  BeneTypeTabs,
  ClickAway,
  DrawerFooter,
  EmployeePicker,
  ContactPicker,
  ErrorText,
  Field,
  FieldLabel,
  Hint,
  LG,
  Note,
  OtpStep,
  PANEL,
  PayFromSelect,
  ReviewRow,
  SelectButton,
  SuccessView,
  TransferDrawer,
  VerifiedDot,
  type BeneType,
} from "./shared";
import {
  MODES,
  PURPOSES,
  RTGS_MIN,
  amountOnly,
  approvalNote,
  autoMode,
  bankFromIfsc,
  fmtINR,
  maskIfsc,
  oldestBill,
  type PayeeContact,
  type PickedPayee,
  type Purpose,
  type TransferMode,
} from "./data";

type Beneficiary =
  | { kind: "contact"; contactId: string; accountId: string }
  | { kind: "employee"; employeeId: string }
  | { kind: "other"; name: string; bank: string; ifsc: string };

/** Inline panel replacing the picker while a new contact / extra account is being entered. */
type AddPanel = { type: "new-contact"; name: string } | { type: "contact-account"; contactId: string } | { type: "employee-account"; employeeId: string };

export interface SingleTransferPreset {
  payFromId?: string;
  beneficiary?: Beneficiary;
  billIds?: string[];
  amount?: string;
}

const DEFAULT_PURPOSE: Record<BeneType, Purpose> = { contact: "vendor", employee: "salary", other: "other" };

export function SingleTransferDrawer({
  preset,
  onClose,
  onSwitchToBulk,
}: {
  preset?: SingleTransferPreset;
  onClose: () => void;
  onSwitchToBulk: (payFromId: string, carry: (PickedPayee & { amount: string }) | null) => void;
}) {
  const contacts = useBankingStore((s) => s.contacts);
  const employees = useBankingStore((s) => s.employees);
  const store = useBankingStore.getState;

  const accounts = usePayFromAccounts();
  const [payFromId, setPayFromId] = useState(accounts.find((a) => a.id === preset?.payFromId)?.id ?? accounts[0].id);
  const payFrom = accounts.find((a) => a.id === payFromId) ?? accounts[0];

  const [beneType, setBeneTypeRaw] = useState<BeneType>("contact");
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(preset?.beneficiary ?? null);
  const [panel, setPanel] = useState<AddPanel | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [amount, setAmount] = useState(preset?.amount ?? "");
  const [billIds, setBillIds] = useState<string[]>(preset?.billIds ?? []);
  const [billOpen, setBillOpen] = useState(false);
  const [billSearch, setBillSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const [modeExpanded, setModeExpanded] = useState(false);
  const [modeOverride, setModeOverride] = useState<TransferMode | null>(null);
  const [purpose, setPurpose] = useState<Purpose | "">(preset?.beneficiary ? "vendor" : "");
  const [purposeOpen, setPurposeOpen] = useState(false);
  const [purposeOther, setPurposeOther] = useState("");

  const [step, setStep] = useState<1 | 2 | 3 | "success">(1);
  const [otp, setOtp] = useState("");
  const [snapshot, setSnapshot] = useState<{ amount: string; name: string; mode: TransferMode } | null>(null);

  // ---- resolve the beneficiary for display ----
  let bene: { name: string; bank: string; ifsc: string; verified: boolean } | null = null;
  let beneContact: PayeeContact | null = null;
  if (beneficiary?.kind === "contact") {
    beneContact = contacts.find((c) => c.id === beneficiary.contactId) ?? null;
    const a = beneContact?.accounts.find((x) => x.id === beneficiary.accountId);
    if (beneContact && a) bene = { name: beneContact.name, bank: a.bank, ifsc: a.ifsc, verified: a.verified };
  } else if (beneficiary?.kind === "employee") {
    const e = employees.find((x) => x.id === beneficiary.employeeId);
    if (e?.account) bene = { name: e.name, bank: e.account.bank, ifsc: e.account.ifsc, verified: e.account.verified };
  } else if (beneficiary?.kind === "other") {
    bene = { name: beneficiary.name, bank: beneficiary.bank, ifsc: beneficiary.ifsc, verified: true };
  }

  const bills = beneContact?.category === "vendor" ? (beneContact.bills ?? []) : [];
  const pastTransfers = beneContact?.pastTransfers ?? [];

  // ---- amount, mode, purpose ----
  const amountNum = parseFloat(amount) || 0;
  const amountError =
    amount !== "" && amountNum <= 0 ? "Enter a valid amount" : amountNum > payFrom.balance ? "Amount exceeds available balance" : null;
  const rtgsDisabled = amountNum < RTGS_MIN;
  const mode: TransferMode = modeOverride && !(modeOverride === "RTGS" && rtgsDisabled) ? modeOverride : autoMode(amountNum);
  const purposeOpt = PURPOSES.find((p) => p.value === purpose);
  const purposeValid = purpose !== "" && (purpose !== "other" || purposeOther.trim() !== "");
  const reviewDisabled = !bene || amountNum <= 0 || !!amountError || !purposeValid;
  const makerChecker = payFrom.approvalMode === "maker-checker";

  const pick = (b: Beneficiary, kind: BeneType, extra?: { contact?: PayeeContact }) => {
    setBeneficiary(b);
    setPanel(null);
    setVerifyError(null);
    if (!purpose) setPurpose(DEFAULT_PURPOSE[kind]);
    // Vendors with unpaid bills: pre-select the oldest bill and fill its amount.
    const c = extra?.contact;
    if (c?.category === "vendor" && c.bills?.length) {
      const oldest = oldestBill(c.bills);
      setBillIds([oldest.id]);
      setAmount(String(oldest.amount));
    }
  };

  const clearBeneficiary = () => {
    setBeneficiary(null);
    setVerifyError(null);
    setVerifying(false);
    setBillIds([]);
    setHistoryOpen(false);
    setBillOpen(false);
  };

  const setBeneType = (t: BeneType) => {
    setBeneTypeRaw(t);
    clearBeneficiary();
    setPanel(null);
    setBillSearch("");
  };

  const verifySelected = async () => {
    if (!beneficiary) return;
    setVerifying(true);
    setVerifyError(null);
    const ok = await store().verifyAccount();
    setVerifying(false);
    if (!ok) return setVerifyError("Couldn't verify this account. Check the details or try a different account.");
    if (beneficiary.kind === "contact") store().markContactAccountVerified(beneficiary.contactId, beneficiary.accountId);
    if (beneficiary.kind === "employee") store().markEmployeeAccountVerified(beneficiary.employeeId);
  };

  const toggleBill = (id: string) => {
    const next = billIds.includes(id) ? billIds.filter((x) => x !== id) : [...billIds, id];
    const sum = bills.filter((b) => next.includes(b.id)).reduce((acc, b) => acc + b.amount, 0);
    setBillIds(next);
    setAmount(sum > 0 ? String(sum) : "");
  };

  const switchToBulk = () => {
    if (!payFrom.bulkSupported) return;
    const carry =
      bene && beneficiary && amountNum > 0 && !amountError
        ? {
            key:
              beneficiary.kind === "contact"
                ? `contact:${beneficiary.contactId}:${beneficiary.accountId}`
                : beneficiary.kind === "employee"
                  ? `employee:${beneficiary.employeeId}`
                  : `other:${beneficiary.name}:${beneficiary.ifsc}`,
            name: bene.name,
            bank: bene.bank,
            maskedIfsc: maskIfsc(bene.ifsc),
            verified: bene.verified,
            amount,
          }
        : null;
    onSwitchToBulk(payFrom.id, carry);
  };

  const confirm = () => {
    if (otp.length !== 6 || !bene) return;
    const billRefs = bills.filter((b) => billIds.includes(b.id)).map((b) => b.number);
    store().addPayout({
      name: bene.name,
      detail: billRefs.length ? billRefs.join(", ") : purpose === "other" ? purposeOther || "Other" : (purposeOpt?.label ?? "Payment"),
      amount: amountNum,
      fromAccountId: payFrom.id,
      mode,
      status: makerChecker ? "awaiting" : "processing",
    });
    setSnapshot({ amount: fmtINR(amountNum), name: bene.name, mode });
    setStep("success");
  };

  if (step === "success" && snapshot) {
    return (
      <TransferDrawer title="Fund Transfer" width={520} step="success" onClose={onClose}>
        <SuccessView
          title={makerChecker ? "Submitted for approval" : "Transfer initiated"}
          body={
            makerChecker
              ? `${snapshot.amount} to ${snapshot.name} via ${snapshot.mode} has been submitted. It now needs a checker's approval in netbanking to complete.`
              : `${snapshot.amount} sent to ${snapshot.name} via ${snapshot.mode}. This transfer is now processing.`
          }
          onDone={onClose}
        />
      </TransferDrawer>
    );
  }

  const selectedCard = bene && (
    <div className={cn(PANEL, "flex items-start justify-between gap-2.5 p-3")}>
      <div className="min-w-0">
        <div className="text-2sm font-semibold">{bene.name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {bene.bank} · {maskIfsc(bene.ifsc)}
        </div>
        {beneficiary?.kind === "other" ? (
          <div className="mt-1.5 flex items-center gap-[5px] text-xs font-semibold text-[var(--color-success-accent)]">
            <VerifiedDot size={14} /> Verified one-off payee
          </div>
        ) : bene.verified ? (
          <div className="mt-1.5 flex items-center gap-[5px] text-xs font-semibold text-[var(--color-success-accent)]">
            <VerifiedDot size={14} /> Verified · {bene.name} · {bene.bank}
          </div>
        ) : (
          <>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="warning">Unverified</Badge>
              {verifying ? (
                <span className="text-xs text-muted-foreground">Verifying…</span>
              ) : (
                <Button variant="link" className="text-xs" onClick={verifySelected}>
                  Verify Now
                </Button>
              )}
            </div>
            {verifyError && <ErrorText className="mt-1.5">{verifyError}</ErrorText>}
          </>
        )}
      </div>
      <Button variant="link" className="shrink-0 text-xs" onClick={clearBeneficiary}>
        Change
      </Button>
    </div>
  );

  const contactName = (id: string) => contacts.find((c) => c.id === id)?.name ?? "";
  const employeeName = (id: string) => employees.find((e) => e.id === id)?.name ?? "";

  const picker = (() => {
    if (bene) return selectedCard;
    if (panel?.type === "new-contact")
      return (
        <AccountForm
          title={`New contact: ${panel.name}`}
          onCancel={() => setPanel(null)}
          onSubmit={(input) => {
            const { contact, account } = store().addContact(panel.name, input);
            pick({ kind: "contact", contactId: contact.id, accountId: account.id }, "contact");
          }}
        />
      );
    if (panel?.type === "contact-account")
      return (
        <AccountForm
          title={`New account for ${contactName(panel.contactId)}`}
          onCancel={() => setPanel(null)}
          onSubmit={(input) => {
            const account = store().addContactAccount(panel.contactId, input);
            pick({ kind: "contact", contactId: panel.contactId, accountId: account.id }, "contact");
          }}
        />
      );
    if (panel?.type === "employee-account")
      return (
        <AccountForm
          title={`Add account for ${employeeName(panel.employeeId)}`}
          onCancel={() => setPanel(null)}
          onSubmit={(input) => {
            store().setEmployeeAccount(panel.employeeId, input);
            pick({ kind: "employee", employeeId: panel.employeeId }, "employee");
          }}
        />
      );
    if (beneType === "contact")
      return (
        <ContactPicker
          onSelect={(c, a) => pick({ kind: "contact", contactId: c.id, accountId: a.id }, "contact", { contact: c })}
          onAddNew={(name) => setPanel({ type: "new-contact", name })}
          onAddAccount={(c) => setPanel({ type: "contact-account", contactId: c.id })}
        />
      );
    if (beneType === "employee")
      return (
        <EmployeePicker
          onSelect={(e) => pick({ kind: "employee", employeeId: e.id }, "employee")}
          onNeedsAccount={(e) => setPanel({ type: "employee-account", employeeId: e.id })}
        />
      );
    return (
      <AccountForm
        withPayeeName
        onSubmit={({ name, accountNumber, ifsc, verified, saveAsContact }) => {
          if (saveAsContact) store().addContact(name, { accountNumber, ifsc, verified });
          pick({ kind: "other", name, bank: bankFromIfsc(ifsc), ifsc }, "other");
        }}
      />
    );
  })();

  const billSearchLc = billSearch.trim().toLowerCase();
  const visibleBills = bills.filter((b) => billSearchLc === "" || b.number.toLowerCase().includes(billSearchLc) || String(b.amount).includes(billSearchLc));
  const billSum = bills.filter((b) => billIds.includes(b.id)).reduce((acc, b) => acc + b.amount, 0);

  return (
    <TransferDrawer title="Fund Transfer" width={520} step={step} onClose={onClose}>
      <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto overflow-x-hidden px-6 pb-6 pt-5">
        {step === 1 && (
          <>
            <PayFromSelect account={payFrom} options={accounts} note={approvalNote(payFrom.approvalMode)} onSelect={setPayFromId} />

            <Field label="Beneficiary Type">
              <BeneTypeTabs value={beneType} onChange={setBeneType} />
            </Field>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <FieldLabel>Beneficiary</FieldLabel>
                <Button variant="link" className="text-xs" disabled={!payFrom.bulkSupported} onClick={switchToBulk}>
                  Paying multiple people? Switch to Bulk Transfer
                </Button>
              </div>
              {picker}
            </div>

            <div className="flex flex-col gap-1.5">
              {bills.length > 0 && (
                <>
                  <FieldLabel>Unpaid Bills</FieldLabel>
                  <div className="relative">
                    {billOpen && <ClickAway onClose={() => setBillOpen(false)} />}
                    <SelectButton onClick={() => setBillOpen(!billOpen)} className="z-20">
                      <span className={billIds.length ? "text-foreground" : "text-muted-foreground"}>
                        {billIds.length
                          ? `${billIds.length} bill${billIds.length > 1 ? "s" : ""} selected · ${fmtINR(billSum)}`
                          : "Select Unpaid Bills"}
                      </span>
                    </SelectButton>
                    {billOpen && (
                      <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md shadow-black/5">
                        <input
                          value={billSearch}
                          onChange={(e) => setBillSearch(e.target.value)}
                          placeholder="Search by invoice number or amount"
                          className="h-9 w-full border-b border-border bg-transparent px-3 text-2sm outline-none"
                        />
                        <div className="max-h-[220px] overflow-y-auto">
                          {visibleBills.map((b) => (
                            <div
                              key={b.id}
                              onClick={() => toggleBill(b.id)}
                              className="flex cursor-pointer items-center gap-2.5 border-b border-border px-3 py-[11px] last:border-b-0 hover:bg-accent/60"
                            >
                              <input type="checkbox" readOnly checked={billIds.includes(b.id)} className="pointer-events-none size-4.5 accent-primary" />
                              <div className="min-w-0 flex-1">
                                <div className="text-2sm font-semibold">{b.number}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  Billed {b.date} · Due {b.dueDate}
                                </div>
                              </div>
                              <div className="text-2sm font-semibold tabular-nums">{fmtINR(b.amount)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
              <FieldLabel>Amount</FieldLabel>
              <AmountInput value={amount} onChange={(v) => setAmount(amountOnly(v))} />
              {amountError ? <ErrorText>{amountError}</ErrorText> : <Hint>Available balance: {fmtINR(payFrom.balance)}</Hint>}
              {pastTransfers.length > 0 && (
                <>
                  <Button variant="link" className="mt-0.5 self-start text-xs" onClick={() => setHistoryOpen(!historyOpen)}>
                    View past transfers to this payee
                  </Button>
                  {historyOpen && (
                    <div className="rounded-md border border-border">
                      {pastTransfers.map((t) => (
                        <div key={t.date} className="flex justify-between border-b border-border px-3 py-[9px] text-xs last:border-b-0">
                          <span className="text-muted-foreground">
                            {t.date} · {t.mode}
                          </span>
                          <span className="font-semibold tabular-nums">{fmtINR(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel>Transfer Mode</FieldLabel>
              {!modeExpanded ? (
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-[11px]">
                  <div>
                    <span className="text-2sm font-semibold">{mode}</span>
                    <span className="text-xs text-muted-foreground"> · {MODES.find((m) => m.value === mode)!.note} · Bank charges may apply</span>
                  </div>
                  <Button variant="link" className="shrink-0 text-xs" onClick={() => setModeExpanded(true)}>
                    Change
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    {MODES.map((m) => {
                      const disabled = m.value === "RTGS" && rtgsDisabled;
                      return (
                        <div
                          key={m.value}
                          onClick={() => {
                            if (disabled) return;
                            setModeOverride(m.value);
                            setModeExpanded(false);
                          }}
                          className={cn(
                            "flex-1 cursor-pointer rounded-md border border-border p-2.5 text-center",
                            !disabled && mode === m.value && "border-[1.5px] border-primary bg-[var(--color-primary-soft)]",
                            disabled && "cursor-not-allowed opacity-45",
                          )}
                        >
                          <div className="text-2sm font-bold">{m.value}</div>
                          <div className="mt-[3px] text-[11px] text-muted-foreground">{m.label}</div>
                        </div>
                      );
                    })}
                  </div>
                  {rtgsDisabled && <Hint>RTGS is available for transfers of ₹2,00,000 and above.</Hint>}
                  <Hint>Bank charges may apply.</Hint>
                  <Button variant="link" className="self-start text-xs" onClick={() => setModeExpanded(false)}>
                    Done
                  </Button>
                </div>
              )}
            </div>

            <div className="relative flex flex-col gap-1.5">
              <FieldLabel>Purpose</FieldLabel>
              {purposeOpen && <ClickAway onClose={() => setPurposeOpen(false)} />}
              <SelectButton onClick={() => setPurposeOpen(!purposeOpen)} className={cn(purposeOpen && "z-20")}>
                <span className={purpose ? "text-foreground" : "text-muted-foreground"}>{purposeOpt?.label ?? "Select Purpose"}</span>
              </SelectButton>
              {purposeOpen && (
                <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md shadow-black/5">
                  {PURPOSES.map((p) => (
                    <div
                      key={p.value}
                      onClick={() => {
                        setPurpose(p.value);
                        setPurposeOpen(false);
                      }}
                      className="cursor-pointer border-b border-border px-3 py-2.5 text-2sm last:border-b-0 hover:bg-accent/60"
                    >
                      {p.label}
                    </div>
                  ))}
                </div>
              )}
              {purpose === "other" && (
                <Input value={purposeOther} onChange={(e) => setPurposeOther(e.target.value)} placeholder="Describe the purpose" className="mt-1" />
              )}
            </div>
          </>
        )}

        {step === 2 && bene && (
          <div className="flex flex-col gap-4">
            <div className="text-2sm font-semibold text-foreground">Review Transfer Details</div>
            <div className="flex flex-col gap-3.5 rounded-lg border border-border p-4">
              <ReviewRow label="From">
                {payFrom.bank} · {payFrom.masked}
              </ReviewRow>
              <ReviewRow label="To">
                {bene.name}
                <br />
                <span className="font-normal text-muted-foreground">
                  {bene.bank} · {maskIfsc(bene.ifsc)}
                </span>
              </ReviewRow>
              <div className="flex justify-between gap-2.5">
                <span className="text-xs text-muted-foreground">Amount</span>
                <span className="text-[15px] font-bold">{fmtINR(amountNum)}</span>
              </div>
              <ReviewRow label="Mode">{mode} · Bank charges may apply</ReviewRow>
              <ReviewRow label="Purpose">{purpose === "other" ? `${purposeOpt?.label} — ${purposeOther}` : purposeOpt?.label}</ReviewRow>
            </div>
            {bene.verified ? (
              <Note tone="primary">Verified beneficiary · Funds are sent only to confirmed accounts.</Note>
            ) : (
              <Note tone="warning">This beneficiary hasn't been verified yet. Confirm the account details are correct before proceeding.</Note>
            )}
            {makerChecker && (
              <Note tone="warning">
                Confirming here only initiates this transfer. It will need a checker's approval in netbanking to complete — LEDGERS does not
                complete this step.
              </Note>
            )}
          </div>
        )}

        {step === 3 && <OtpStep bankName={payFrom.bank} value={otp} onChange={setOtp} />}
      </div>

      {step === 1 && (
        <DrawerFooter>
          <Button variant="primary" className={cn(LG, "w-full")} disabled={reviewDisabled} onClick={() => setStep(2)}>
            Review Transfer
          </Button>
        </DrawerFooter>
      )}
      {step === 2 && (
        <DrawerFooter>
          <Button className={cn(LG, "flex-1")} onClick={() => setStep(1)}>
            Back
          </Button>
          <Button
            variant="primary"
            className={cn(LG, "flex-[2]")}
            onClick={() => {
              setOtp("");
              setStep(3);
            }}
          >
            Continue to OTP
          </Button>
        </DrawerFooter>
      )}
      {step === 3 && (
        <DrawerFooter>
          <Button className={cn(LG, "flex-1")} onClick={() => setStep(2)}>
            Back
          </Button>
          <Button variant="primary" className={cn(LG, "flex-[2]")} disabled={otp.length !== 6} onClick={confirm}>
            {makerChecker ? "Verify & Submit" : "Verify & Pay"}
          </Button>
        </DrawerFooter>
      )}
    </TransferDrawer>
  );
}
