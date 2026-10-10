import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Landmark } from "lucide-react";
import { useStore } from "../../store/useStore";
import { useBankingStore } from "../../store/useBankingStore";
import { STATUS_META } from "../../lib/status";
import { STOCK_HOLDING_ID, SHARMA_TRADERS_ID } from "../../mock/seed";
import { BharatConnectMark } from "../layout/BharatConnectMark";
import { CONNECTED_BANKING, last4, type ApprovalMode, type BankConnection } from "../../pages/banking/data";
import { SETUP_OPTIONS } from "../../pages/banking/setups";
import type { ConnectionState } from "../../types";

const STATES: ConnectionState[] = [
  "not_connected",
  "existing_id_found",
  "setting_up",
  "connected",
  "needs_attention",
  "assisted_setup",
];

type Section = "bharat-connect" | "banking";

// The panel unmounts on close; reopening returns to the last section used.
let lastSection: Section | null = null;

const OPTION = "rounded-md border px-2 py-1.5 text-xs font-medium";
const ON = "border-primary bg-primary/10 text-primary";
const OFF = "border-border text-foreground hover:bg-accent";

function Group({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** One-of-many row of option buttons. */
function Choice<T extends string | number | boolean | null>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map(([v, label]) => (
        <button key={label} onClick={() => onChange(v)} className={`flex-1 ${OPTION} ${value === v ? ON : OFF}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function DevPanel() {
  const toggleDevPanel = useStore((s) => s.toggleDevPanel);
  const [section, setSectionRaw] = useState<Section | null>(lastSection);
  const setSection = (s: Section | null) => {
    lastSection = s;
    setSectionRaw(s);
  };

  const title = section === "bharat-connect" ? "Bharat Connect" : section === "banking" ? "Banking" : "Dev panel";

  return (
    <div
      className="fixed bottom-16 left-[262px] z-40 w-80 overflow-y-auto scrollbar-thin rounded-xl border border-border bg-popover p-4 text-sm shadow-2xl"
      style={{ maxHeight: "calc(100vh - 6rem)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          {section && (
            <button onClick={() => setSection(null)} className="-ms-1 rounded-md p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Back">
              <ChevronLeft className="size-4" />
            </button>
          )}
          <div className="truncate font-semibold text-foreground">{title}</div>
        </div>
        <button onClick={() => toggleDevPanel(false)} className="text-muted-foreground hover:text-foreground">
          Close
        </button>
      </div>

      {section === null && <SectionMenu onOpen={setSection} />}
      {section === "bharat-connect" && <BharatConnectOptions />}
      {section === "banking" && <BankingOptions />}
    </div>
  );
}

function SectionMenu({ onOpen }: { onOpen: (s: Section) => void }) {
  const business = useStore((s) => s.currentBusiness());
  const accounts = useBankingStore((s) => s.accounts);
  const connectedCount = accounts.filter((a) => a.active && a.connection === "connected").length;

  const items: { key: Section; icon: ReactNode; label: string; summary: string }[] = [
    {
      key: "bharat-connect",
      icon: <BharatConnectMark size={16} />,
      label: "Bharat Connect",
      summary: `${STATUS_META[business.connectionState].label} · Level ${business.verification.level}`,
    },
    {
      key: "banking",
      icon: <Landmark className="size-4 text-muted-foreground" />,
      label: "Banking",
      summary: connectedCount ? `${connectedCount} account${connectedCount === 1 ? "" : "s"} connected` : "No account connected",
    },
  ];

  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onOpen(item.key)}
          className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left hover:bg-accent"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">{item.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">{item.label}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{item.summary}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

function BharatConnectOptions() {
  const business = useStore((s) => s.currentBusiness());
  const currentBusinessId = useStore((s) => s.currentBusinessId);
  const switchBusiness = useStore((s) => s.switchBusiness);
  const forceConnectionState = useStore((s) => s.forceConnectionState);
  const simulateWebhookConfirm = useStore((s) => s.simulateWebhookConfirm);
  const simulateWebhookReject = useStore((s) => s.simulateWebhookReject);
  const resetConnectFlow = useStore((s) => s.resetConnectFlow);
  const setVerificationLevel = useStore((s) => s.setVerificationLevel);
  const invoices = useStore((s) => s.invoices);
  const simulateInvoiceConfirmation = useStore((s) => s.simulateInvoiceConfirmation);
  const devProfileSaveOutcome = useStore((s) => s.devProfileSaveOutcome);
  const setDevProfileSaveOutcome = useStore((s) => s.setDevProfileSaveOutcome);
  const setGstConnected = useStore((s) => s.setGstConnected);
  const devSetBankState = useStore((s) => s.devSetBankState);

  const awaitingConfirmation = invoices.filter(
    (i) => i.kind === "sales" && i.bcSendStatus === "sent" && i.bcConfirmationStatus === "pending",
  );
  const bankState = business.bankAccounts.some((a) => a.verified) ? "verified" : business.bankAccounts.length > 0 ? "unverified" : "none";

  return (
    <>
      <Group label="Business">
        <Choice
          value={currentBusinessId}
          options={[
            [STOCK_HOLDING_ID, "Stock Holding (co.)"],
            [SHARMA_TRADERS_ID, "Sharma Traders (prop.)"],
          ]}
          onChange={switchBusiness}
        />
      </Group>

      <Group label="Force connection state">
        <div className="grid grid-cols-2 gap-1.5">
          {STATES.map((state) => (
            <button
              key={state}
              onClick={() => {
                forceConnectionState(business.id, state);
                resetConnectFlow(business.id);
              }}
              className={`flex items-center gap-1.5 text-left ${OPTION} font-normal ${business.connectionState === state ? ON : OFF}`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_META[state].dotClass}`} />
              {STATUS_META[state].label}
            </button>
          ))}
        </div>
      </Group>

      <Group
        label="Verification level"
        hint={
          business.verification.level === 1
            ? "Invoicing only. MCC hidden, no documents card."
            : business.verification.level === 2
              ? "+ Paying others. MCC required, documents card appears."
              : "+ Receiving payments. Full verification reached."
        }
      >
        <Choice
          value={business.verification.level}
          options={[
            [1, "Level 1"],
            [2, "Level 2"],
            [3, "Level 3"],
          ]}
          onChange={(level) => setVerificationLevel(business.id, level)}
        />
      </Group>

      <Group label="GST connected in LEDGERS">
        <Choice
          value={business.gstConnected}
          options={[
            [true, "Connected"],
            [false, "Not connected"],
          ]}
          onChange={(v) => setGstConnected(business.id, v)}
        />
      </Group>

      <Group label="Bank account" hint="Shown in the Reach Full Verification dialog (below Level 3).">
        <Choice
          value={bankState}
          options={[
            ["verified", "Verified"],
            ["unverified", "Unverified"],
            ["none", "None"],
          ]}
          onChange={(v) => devSetBankState(business.id, v)}
        />
      </Group>

      <Group label="Profile page — next save">
        <Choice
          value={devProfileSaveOutcome}
          options={[
            [null, "Succeeds"],
            ["reject", "Rejected"],
            ["conflict", "Conflict"],
          ]}
          onChange={setDevProfileSaveOutcome}
        />
      </Group>

      <Group label="Simulate webhook">
        <div className="flex gap-1.5">
          <button
            onClick={() => simulateWebhookConfirm(business.id)}
            className="flex-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Confirm activation
          </button>
          <button
            onClick={() => simulateWebhookReject(business.id)}
            className="flex-1 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            Reject update
          </button>
        </div>
      </Group>

      <Group label="Simulate invoice confirmation">
        {awaitingConfirmation.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No sent invoices are awaiting confirmation right now.</p>
        ) : (
          <div className="space-y-1.5">
            {awaitingConfirmation.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-foreground">{inv.id}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{inv.counterpartyName}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => simulateInvoiceConfirmation(inv.id, "accepted")}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => simulateInvoiceConfirmation(inv.id, "failure")}
                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100"
                  >
                    Fail
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Group>
    </>
  );
}

const SELECT = "h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground";

/** A section that starts closed: the rarely used switches stay out of the way. */
function Fold({ label, summary, children }: { label: string; summary: string; children: ReactNode }) {
  return (
    <details className="group mb-2 rounded-lg border border-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <span className="shrink-0 text-xs font-medium text-foreground">{label}</span>
        <span className="ms-auto min-w-0 truncate text-[11px] text-muted-foreground">{summary}</span>
      </summary>
      <div className="space-y-3 border-t border-border px-3 py-3">{children}</div>
    </details>
  );
}

/** Banking prototype controls: the business's stage first, then quick actions, then the rarely changed switches. */
function BankingOptions() {
  const scenario = useBankingStore((s) => s.scenario);
  const accounts = useBankingStore((s) => s.accounts);
  const setScenario = useBankingStore((s) => s.setScenario);
  const updateAccount = useBankingStore((s) => s.updateAccount);
  const resetData = useBankingStore((s) => s.resetData);
  const approveAwaiting = useBankingStore((s) => s.approveAwaiting);
  const failProcessing = useBankingStore((s) => s.failProcessing);
  const setup = useBankingStore((s) => s.setup);
  const applySetup = useBankingStore((s) => s.applySetup);
  const apiAccounts = accounts.filter((a) => a.bankKey && a.active);
  const verifyLabel = { random: "Random", pass: "Always pass", fail: "Always fail" }[scenario.verify];

  return (
    <>
      <Group label="Business stage" hint="Swaps in that stage's accounts, transactions and payouts.">
        <select value={setup} onChange={(e) => applySetup(e.target.value as typeof setup)} className={SELECT} aria-label="Business stage">
          {SETUP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Group>

      <Group label="Try">
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={approveAwaiting} className={`${OPTION} ${OFF}`} title="The checker approves every payout waiting in net banking">
            Approve payouts
          </button>
          <button onClick={failProcessing} className={`${OPTION} ${OFF}`} title="The next payout with the bank fails">
            Fail a payout
          </button>
          <button onClick={resetData} className={`${OPTION} ${OFF}`} title="Back to this stage's sample data">
            Reset data
          </button>
        </div>
      </Group>

      <Fold label="Bank API" summary={`${verifyLabel} · ${scenario.register === "success" ? "connects" : "rejects"}`}>
        <div className="space-y-1.5">
          <div className="text-[11px] text-muted-foreground">Account verification (penny-less)</div>
          <Choice
            value={scenario.verify}
            options={[
              ["random", "Random"],
              ["pass", "Pass"],
              ["fail", "Fail"],
            ]}
            onChange={(verify) => setScenario({ verify })}
          />
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] text-muted-foreground">Connect / Reconnect banking</div>
          <Choice
            value={scenario.register}
            options={[
              ["success", "Succeeds"],
              ["fail", "Rejected"],
            ]}
            onChange={(register) => setScenario({ register })}
          />
        </div>
      </Fold>

      <Fold label="Accounts" summary={`${apiAccounts.filter((a) => a.connection === "connected").length} live · ${scenario.balance} balance`}>
        {apiAccounts.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] text-muted-foreground">Connected banking</div>
            {apiAccounts.map((a) => {
              const meta = CONNECTED_BANKING[a.bankKey!];
              return (
                <div key={a.id} className="flex items-center gap-1.5">
                  <span className="w-[5.5rem] shrink-0 truncate text-xs" title={a.nickname}>
                    {meta.short} {last4(a.number)}
                  </span>
                  <select
                    aria-label={`${meta.short} ${last4(a.number)} connection`}
                    value={a.connection}
                    onChange={(e) => {
                      const connection = e.target.value as BankConnection;
                      updateAccount(a.id, { connection, ...(connection !== "none" ? { verified: true, syncedMinutesAgo: connection === "expired" ? 2880 : 5 } : {}) });
                    }}
                    className={SELECT}
                  >
                    {([["connected", "Live"], ["expired", "Expired"], ["none", "Off"]] as const).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {meta.approvalChoice && a.connection !== "none" && (
                    <select
                      aria-label={`${meta.short} ${last4(a.number)} approval`}
                      value={a.approval}
                      onChange={(e) => updateAccount(a.id, { approval: e.target.value as ApprovalMode })}
                      className={SELECT}
                    >
                      {([["maker-checker", "Checker"], ["single", "Single"]] as const).map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="space-y-1.5">
          <div className="text-[11px] text-muted-foreground">Bank balance</div>
          <Choice
            value={scenario.balance}
            options={[
              ["normal", "Normal"],
              ["low", "Low"],
            ]}
            onChange={(balance) => setScenario({ balance })}
          />
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] text-muted-foreground">Overview layout</div>
          <Choice
            value={scenario.overviewLayout}
            options={[
              ["split", "Side by side"],
              ["stacked", "Stacked"],
            ]}
            onChange={(overviewLayout) => setScenario({ overviewLayout })}
          />
        </div>
      </Fold>
    </>
  );
}
