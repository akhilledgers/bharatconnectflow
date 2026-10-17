import { useState, type ReactNode } from "react";
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
    description: "",
    label: "Comment",
    picks: [],
    preset: "Accepted",
    button: "Accept Bill",
    variant: "success",
  },
  return: {
    title: "Return for correction?",
    description: "",
    label: "Comment",
    picks: ["Wrong amount", "Wrong quantity", "Wrong GST", "Wrong details"],
    preset: "",
    button: "Return to Supplier",
    variant: "primary",
  },
  reject: {
    title: "Reject this bill?",
    description: "",
    label: "Comment",
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
  children,
  canSubmit = true,
}: {
  decision: BuyerResponse;
  supplier: string;
  onCancel: () => void;
  onSubmit: (decision: BuyerResponse, comment: string) => Promise<void>;
  /** Extra step shown above the comment (the items list on Accept). */
  children?: ReactNode;
  canSubmit?: boolean;
}) {
  const copy = RESPONSE_COPY[decision];
  const [comment, setComment] = useState(copy.preset);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <div>
        <div className="text-sm font-medium text-foreground">{copy.title}</div>
        {copy.description && <p className="text-xs text-muted-foreground">{copy.description.replace("The supplier", supplier)}</p>}
      </div>
      {children}
      <CommentField label={copy.label} value={comment} onChange={setComment} max={REMARKS_MAX} required picks={copy.picks} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Back
        </Button>
        <Button
          variant={copy.variant}
          size="sm"
          disabled={!comment.trim() || !canSubmit || busy}
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
  children,
  canSubmit = true,
}: {
  decision: BuyerResponse | null;
  supplier: string;
  onClose: () => void;
  onSubmit: (decision: BuyerResponse, comment: string) => Promise<void>;
  /** Shown above the comment (e.g. "Fill the missing details in Items" on Accept). */
  children?: ReactNode;
  canSubmit?: boolean;
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
      description={copy.description ? copy.description.replace("The supplier", supplier) : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={copy.variant}
            disabled={!comment.trim() || !canSubmit || busy}
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
      {children}
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
export function CancelDialog({
  open,
  onClose,
  onSubmit,
  title = "Cancel invoice?",
  description = "This can't be revoked.",
  confirmLabel = "Cancel Invoice",
  picks = [],
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** One-tap reasons above the field. */
  picks?: string[];
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
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
            {busy ? "Cancelling…" : confirmLabel}
          </Button>
        </>
      }
    >
      <CommentField label="Reason" value={reason} onChange={setReason} max={REMARKS_MAX} required picks={picks} placeholder="Raised by mistake" />
    </Dialog>
  );
}
