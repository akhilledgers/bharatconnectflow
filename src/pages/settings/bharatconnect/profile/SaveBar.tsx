import { X, ArrowRight } from "lucide-react";
import { CircularSpinner } from "../../../../components/layout/CircularSpinner";
import type { Business } from "../../../../types";
import type { useProfileForm } from "./useProfileForm";
import { FIELD_CONFIG } from "./fieldConfig";

function accountLabel(business: Business, id: string | null): string {
  if (!id) return "None selected";
  const a = business.bankAccounts.find((b) => b.id === id);
  return a ? `${a.beneficiaryName} · ending ${a.accountEnding}` : id;
}

function diffRows(business: Business, form: ReturnType<typeof useProfileForm>) {
  const { saved, draft, changedFieldIds } = form;
  return changedFieldIds.map((id) => {
    const label = FIELD_CONFIG[id]?.label ?? id;
    switch (id) {
      case "settlementAccountId":
        return { id, label: "Settlement account", from: accountLabel(business, saved.settlementAccountId), to: accountLabel(business, draft.settlementAccountId) };
      case "useAsDefault":
        return { id, label: "Use as default", from: saved.useAsDefault ? "Yes" : "No", to: draft.useAsDefault ? "Yes" : "No" };
      case "mcc":
        return { id, label, from: saved.mcc ?? "Not set", to: draft.mcc ?? "Not set" };
      case "additionalAddresses":
        return { id, label, from: `${saved.additionalAddresses.length} address(es)`, to: `${draft.additionalAddresses.length} address(es)` };
      case "additionalMobiles":
        return { id, label, from: saved.additionalMobiles.join(", ") || "None", to: draft.additionalMobiles.join(", ") || "None" };
      case "additionalEmails":
        return { id, label, from: saved.additionalEmails.join(", ") || "None", to: draft.additionalEmails.join(", ") || "None" };
      case "primaryMobile":
        return { id, label, from: saved.primaryMobile, to: draft.primaryMobile };
      case "primaryEmail":
        return { id, label, from: saved.primaryEmail, to: draft.primaryEmail };
      case "tradeName":
        return { id, label, from: saved.tradeName, to: draft.tradeName };
      default:
        return { id, label, from: "", to: "" };
    }
  });
}

export function SaveBar({ business, form }: { business: Business; form: ReturnType<typeof useProfileForm> }) {
  const { barState, changedFieldIds, errors, banner, dismissBanner, pressSave, cancelConfirm, confirmSend } = form;
  const errorCount = Object.keys(errors).length;
  const firstErrorMessage = errorCount > 0 ? Object.values(errors)[0] : null;

  const quiet = barState === "clean";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 md:left-64">
      {banner && (
        <div className="mx-auto max-w-6xl px-8">
          <div className="max-w-[760px]">
            <div className="mb-2 flex items-center justify-between rounded-t-lg border border-b-0 border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              {banner}
              <button onClick={dismissBanner} className="text-amber-700 hover:text-amber-900">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {barState === "confirming" && (
        <div className="mx-auto max-w-6xl px-8">
          <div className="max-w-[760px] max-h-[320px] overflow-y-auto scrollbar-thin rounded-t-xl border border-b-0 border-gray-200 bg-white p-5 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
            <h3 className="mb-3 text-sm font-semibold text-ink">Confirm changes before sending</h3>
            <div className="divide-y divide-gray-100">
              {diffRows(business, form).map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_1.4fr] gap-4 py-2.5 text-sm">
                  <span className="text-faint">{row.label}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-faint line-through">{row.from}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint" />
                    <span className="text-ink">{row.to}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={cancelConfirm}
                className="rounded-full border border-gray-300 px-5 py-2 text-sm font-medium text-body hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmSend}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                Confirm &amp; send
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`h-16 border-t bg-white ${
          quiet ? "border-gray-100" : "border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
        }`}
      >
        <div className="mx-auto max-w-6xl px-8">
        <div className="flex h-16 max-w-[760px] items-center justify-between">
          {barState === "clean" && <span className="text-sm text-faint">Up to date</span>}

          {barState === "dirty" && (
            <span className="text-sm text-body">
              {changedFieldIds.length} field{changedFieldIds.length === 1 ? "" : "s"} changed
            </span>
          )}

          {barState === "invalid" && (
            <button
              onClick={() => document.getElementById("addresses")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="text-left text-sm font-medium text-red-700 hover:text-red-800"
            >
              {errorCount > 1 ? `${errorCount} issues — ` : ""}Fix: {firstErrorMessage}
            </button>
          )}

          {barState === "confirming" && <span className="text-sm text-body">Review the changes above</span>}

          {barState === "sending" && (
            <span className="flex items-center gap-2 text-sm text-body">
              <CircularSpinner size={14} />
              Sending…
            </span>
          )}

          {barState === "success" && <span className="text-sm font-medium text-emerald-700">Sent to BharatConnect</span>}

          {barState === "rejected" && (
            <button
              onClick={() => document.getElementById("settlement")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="text-left text-sm font-medium text-red-700 hover:text-red-800"
            >
              Fix: {form.rejectedMessage}
            </button>
          )}

          {barState !== "confirming" && (
            <button
              onClick={pressSave}
              disabled={barState === "clean" || barState === "invalid" || barState === "sending" || barState === "rejected"}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {barState === "sending" ? "Sending…" : "Save"}
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
