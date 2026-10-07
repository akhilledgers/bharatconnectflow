import { useState } from "react";
import type { BuyerResponse } from "../../types";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Textarea } from "../../components/ui/input";

// Comment limits come from the API: buyerRemarks / supplierRemarks are required, 1–100 characters;
// invoiceRemarks on a send or re-send is optional, up to 256.
const REMARKS_MAX = 100;
const INVOICE_REMARKS_MAX = 256;

const RESPONSE_COPY: Record<BuyerResponse, { title: string; description: string; label: string; picks: string[]; preset: string; button: string; variant: "success" | "primary" | "destructive" }> = {
  accept: {
    title: "Accept this bill?",
    description: "The supplier is told you've accepted it. You can then pay it.",
    label: "Comment for the supplier",
    picks: [],
    preset: "Accepted",
    button: "Accept Bill",
    variant: "success",
  },
  return: {
    title: "Return this bill?",
    description: "The supplier can correct it and send it again.",
    label: "What needs fixing?",
    picks: ["Wrong amount", "Wrong quantity", "Wrong GST", "Wrong details"],
    preset: "",
    button: "Return to Supplier",
    variant: "primary",
  },
  reject: {
    title: "Reject this bill?",
    description: "The supplier can't change a rejected bill. They can only cancel it.",
    label: "Why are you rejecting it?",
    picks: ["Not ordered", "Duplicate", "Wrong business"],
    preset: "",
    button: "Reject Bill",
    variant: "destructive",
  },
};

function CommentField({
  label,
  value,
  onChange,
  max,
  required,
  picks = [],
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  required?: boolean;
  picks?: string[];
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium text-foreground">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {value.length}/{max}
        </span>
      </div>
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picks.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`cursor-pointer rounded-md border px-2 py-1 text-xs ${
                value === p ? "border-primary bg-primary/10 text-primary" : "border-input text-foreground hover:bg-accent"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <Textarea rows={3} maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/**
 * Buyer's Accept / Return / Reject, inline in the bill's Bharat Connect card instead of a popup.
 * Same copy, quick picks and required comment (buyerRemarks, 1–100) as the dialog.
 */
export function InlineResponse({
  decision,
  supplier,
  onCancel,
  onSubmit,
}: {
  decision: BuyerResponse;
  supplier: string;
  onCancel: () => void;
  onSubmit: (decision: BuyerResponse, comment: string) => Promise<void>;
}) {
  const copy = RESPONSE_COPY[decision];
  const [comment, setComment] = useState(copy.preset);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <div>
        <div className="text-sm font-medium text-foreground">{copy.title}</div>
        <p className="text-xs text-muted-foreground">{copy.description.replace("The supplier", supplier)}</p>
      </div>
      <CommentField label={copy.label} value={comment} onChange={setComment} max={REMARKS_MAX} required picks={copy.picks} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Back
        </Button>
        <Button
          variant={copy.variant}
          size="sm"
          disabled={!comment.trim() || busy}
          onClick={async () => {
            setBusy(true);
            await onSubmit(decision, comment.trim());
            setBusy(false);
          }}
        >
          {busy ? "Sending…" : copy.button}
        </Button>
      </div>
    </div>
  );
}

/** Buyer's Accept / Return / Reject on a bill (reqConfirmInvoice). The comment is required. */
export function ResponseDialog({
  decision,
  supplier,
  onClose,
  onSubmit,
}: {
  decision: BuyerResponse | null;
  supplier: string;
  onClose: () => void;
  onSubmit: (decision: BuyerResponse, comment: string) => Promise<void>;
}) {
  const copy = decision ? RESPONSE_COPY[decision] : null;
  const [comment, setComment] = useState(copy?.preset ?? "");
  const [busy, setBusy] = useState(false);
  if (!decision || !copy) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={copy.title}
      description={copy.description.replace("The supplier", supplier)}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={copy.variant}
            disabled={!comment.trim() || busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit(decision, comment.trim());
              setBusy(false);
              onClose();
            }}
          >
            {busy ? "Sending…" : copy.button}
          </Button>
        </>
      }
    >
      <CommentField label={copy.label} value={comment} onChange={setComment} max={REMARKS_MAX} required picks={copy.picks} />
    </Dialog>
  );
}

/** Supplier re-sends after a return. In the real product this opens the invoice editor first. */
export function ResendDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (note: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit and resend"
      description="Your changes go to the buyer as a revised version."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit(note.trim());
              setBusy(false);
              onClose();
            }}
          >
            {busy ? "Sending…" : "Resend Invoice"}
          </Button>
        </>
      }
    >
      <CommentField label="What changed? (optional)" value={note} onChange={setNote} max={INVOICE_REMARKS_MAX} placeholder="Corrected GST to 12%" />
    </Dialog>
  );
}

/** Supplier cancels a sent, returned or rejected invoice (reqStatusChangeInvoice). Reason is required. */
export function CancelDialog({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cancel this invoice?"
      description="The buyer is told it's cancelled. This can't be undone."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Keep Invoice
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || busy}
            onClick={async () => {
              setBusy(true);
              await onSubmit(reason.trim());
              setBusy(false);
              onClose();
            }}
          >
            {busy ? "Cancelling…" : "Cancel Invoice"}
          </Button>
        </>
      }
    >
      <CommentField label="Reason" value={reason} onChange={setReason} max={REMARKS_MAX} required placeholder="Raised by mistake" />
    </Dialog>
  );
}
