import { X, ArrowRight } from "lucide-react";
import { CircularSpinner } from "../../../../components/layout/CircularSpinner";
import type { Business } from "../../../../types";
import type { useProfileForm } from "./useProfileForm";
import { FIELD_CONFIG } from "./fieldConfig";
import { Button } from "../../../../components/ui/button";
import { cn } from "../../../../lib/cn";

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
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  // The card's footer, pinned to the bottom of the viewport while the card scrolls past.
  return (
    <div className={cn("sticky bottom-0 z-10 rounded-b-xl border-t border-border bg-card", !quiet && "shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.08)]")}>
      {banner && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-[var(--color-warning-soft)] px-5 py-2 text-xs text-[var(--color-warning-accent)]">
          {banner}
          <Button variant="ghost" size="icon-sm" onClick={dismissBanner} aria-label="Dismiss">
            <X />
          </Button>
        </div>
      )}

      {barState === "confirming" && (
        <div className="scrollbar-thin max-h-[320px] overflow-y-auto border-b border-border px-5 py-4">
          <h3 className="mb-1 text-sm font-semibold tracking-tight text-foreground">Confirm changes before sending</h3>
          <p className="mb-3 text-xs text-muted-foreground">These changes need your confirmation before Bharat Connect gets them.</p>
          <div>
            {diffRows(business, form).map((row) => (
              <div key={row.id} className="grid grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-6 border-b border-border py-2.5 text-2sm last:border-b-0">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground line-through">{row.from}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-foreground">{row.to}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex min-h-14 items-center justify-between gap-4 px-5">
        <div className="min-w-0 text-2sm">
          {barState === "clean" && <span className="text-muted-foreground">Up to date</span>}

          {barState === "dirty" && (
            <span className="text-foreground">
              {changedFieldIds.length} field{changedFieldIds.length === 1 ? "" : "s"} changed
            </span>
          )}

          {barState === "invalid" && (
            <Button variant="link" className="!text-destructive" onClick={() => scrollTo("addresses")}>
              {errorCount > 1 ? `${errorCount} issues · ` : ""}Fix: {firstErrorMessage}
            </Button>
          )}

          {barState === "confirming" && <span className="text-foreground">Review the changes above</span>}

          {barState === "sending" && (
            <span className="flex items-center gap-2 text-muted-foreground">
              <CircularSpinner size={14} />
              Sending…
            </span>
          )}

          {barState === "success" && <span className="font-medium text-green-600">Sent to Bharat Connect</span>}

          {barState === "rejected" && (
            <Button variant="link" className="!text-destructive" onClick={() => scrollTo("settlement")}>
              Fix: {form.rejectedMessage}
            </Button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {barState === "confirming" ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelConfirm}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={confirmSend}>
                Confirm &amp; Send
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={pressSave}
              disabled={barState === "clean" || barState === "invalid" || barState === "sending" || barState === "rejected"}
            >
              {barState === "sending" ? "Sending…" : "Save Changes"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
