import { useStore } from "../../store/useStore";
import { STATUS_META } from "../../lib/status";
import { STOCK_HOLDING_ID, SHARMA_TRADERS_ID } from "../../mock/seed";
import type { ConnectionState } from "../../types";

const STATES: ConnectionState[] = [
  "not_connected",
  "existing_id_found",
  "setting_up",
  "connected",
  "needs_attention",
  "assisted_setup",
];

export function DevPanel() {
  const business = useStore((s) => s.currentBusiness());
  const currentBusinessId = useStore((s) => s.currentBusinessId);
  const switchBusiness = useStore((s) => s.switchBusiness);
  const forceConnectionState = useStore((s) => s.forceConnectionState);
  const simulateWebhookConfirm = useStore((s) => s.simulateWebhookConfirm);
  const simulateWebhookReject = useStore((s) => s.simulateWebhookReject);
  const toggleDevPanel = useStore((s) => s.toggleDevPanel);
  const resetConnectFlow = useStore((s) => s.resetConnectFlow);
  const setVerificationLevel = useStore((s) => s.setVerificationLevel);
  const invoices = useStore((s) => s.invoices);
  const simulateInvoiceConfirmation = useStore((s) => s.simulateInvoiceConfirmation);

  const awaitingConfirmation = invoices.filter(
    (i) => i.kind === "sales" && i.bcSendStatus === "sent" && i.bcConfirmationStatus === "pending",
  );

  return (
    <div className="fixed bottom-20 right-5 z-40 w-80 overflow-y-auto scrollbar-thin rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-2xl" style={{ maxHeight: "calc(100vh - 6rem)" }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="font-semibold text-ink">Dev panel</div>
        <button onClick={() => toggleDevPanel(false)} className="text-faint hover:text-body">
          Close
        </button>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">Business</div>
        <div className="flex gap-1.5">
          {[STOCK_HOLDING_ID, SHARMA_TRADERS_ID].map((id) => (
            <button
              key={id}
              onClick={() => switchBusiness(id)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs ${
                currentBusinessId === id
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-gray-200 text-body hover:bg-gray-50"
              }`}
            >
              {id === STOCK_HOLDING_ID ? "Stock Holding (co.)" : "Sharma Traders (prop.)"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">Force connection state</div>
        <div className="grid grid-cols-2 gap-1.5">
          {STATES.map((state) => (
            <button
              key={state}
              onClick={() => {
                forceConnectionState(business.id, state);
                resetConnectFlow(business.id);
              }}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs ${
                business.connectionState === state
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-gray-200 text-body hover:bg-gray-50"
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_META[state].dotClass}`} />
              {STATUS_META[state].label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">Verification level</div>
        <div className="grid grid-cols-3 gap-1.5">
          {([1, 2, 3] as const).map((level) => (
            <button
              key={level}
              onClick={() => setVerificationLevel(business.id, level)}
              className={`rounded-md border px-2 py-1.5 text-xs ${
                business.verification.level === level
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-gray-200 text-body hover:bg-gray-50"
              }`}
            >
              Level {level}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-faint">
          {business.verification.level === 1 && "Invoicing only. MCC hidden, no documents card."}
          {business.verification.level === 2 && "+ Paying others. MCC required, documents card appears."}
          {business.verification.level === 3 && "+ Receiving payments. Full verification reached."}
        </p>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">Simulate webhook</div>
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
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">
          Simulate invoice confirmation
        </div>
        {awaitingConfirmation.length === 0 ? (
          <p className="text-[11px] text-faint">No sent invoices are awaiting confirmation right now.</p>
        ) : (
          <div className="space-y-1.5">
            {awaitingConfirmation.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-2 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-ink">{inv.id}</div>
                  <div className="truncate text-[11px] text-faint">{inv.counterpartyName}</div>
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
      </div>
    </div>
  );
}
