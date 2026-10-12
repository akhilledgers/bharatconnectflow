import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { History, MessageSquareText } from "lucide-react";
import { useStore } from "../../store/useStore";
import type { Invoice, InvoiceNote } from "../../types";
import { Button } from "../../components/ui/button";
import { buttonVariants } from "../../components/ui/button-variants";
import { Callout, popoverCls } from "../../components/ui/popover";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { CircularSpinner } from "../../components/layout/CircularSpinner";


// Sales invoice + Bharat Connect without changing LEDGERS' own layout: one strip above the invoice says what
// happened on Bharat Connect (with the other side's comment behind 💬), the activity sits behind 🕘 in the
// header, and the right-hand card stays exactly LEDGERS'.

const bcNotes = (invoice: Invoice) => (invoice.notes ?? []).filter((n) => n.kind === "bc");

/** Small popover anchored to an icon button. */
function IconPopover({
  icon,
  label,
  children,
  width = "w-80",
  inline,
  align = "right",
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  width?: string;
  /** Small ghost icon (inside the strip) instead of an outline button. */
  inline?: boolean;
  /** Which edge the popover lines up with. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={inline ? "relative inline-flex" : "relative"}>
      <Button
        variant={inline ? "ghost" : "outline"}
        size={inline ? "icon-sm" : "icon"}
        title={label}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={inline ? "!size-6 text-muted-foreground" : undefined}
      >
        {icon}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute top-full z-20 mt-1 ${align === "left" ? "left-0" : "right-0"} ${width} p-3 text-left font-normal ${popoverCls}`}>{children}</div>
        </>
      )}
    </div>
  );
}

/** 🕘 on the right of the strip: everything that happened on Bharat Connect, as a timeline (latest first-visible). */
function ActivityButton({ invoice }: { invoice: Invoice }) {
  const notes = bcNotes(invoice);
  if (notes.length === 0) return null;
  return (
    <IconPopover icon={<History />} label="Activity" inline>
      <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <BharatConnectMark size={12} />
        Activity
      </div>
      <Timeline notes={notes} />
    </IconPopover>
  );
}

/** Dots joined by a line, oldest at the top; only the latest two until "Show earlier". */
function Timeline({ notes }: { notes: InvoiceNote[] }) {
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, notes.length - 2);
  const shown = expanded ? notes : notes.slice(hidden);
  return (
    <div>
      {hidden > 0 && (
        <button onClick={() => setExpanded((e) => !e)} className="mb-2 cursor-pointer text-xs font-medium text-primary hover:text-primary/80">
          {expanded ? "Show less" : `Show ${hidden} earlier`}
        </button>
      )}
      <ol>
        {shown.map((n, i) => (
          <li key={n.id} className="relative flex gap-2.5 pb-3 last:pb-0">
            {i < shown.length - 1 && <span className="absolute left-[3.5px] top-3 h-full border-l border-dashed border-border" />}
            <span className={`relative mt-1 size-2 shrink-0 rounded-full ${i === shown.length - 1 ? "bg-primary" : "bg-muted-foreground/40"}`} />
            <div className="min-w-0 text-xs">
              <div className="font-medium text-foreground">{n.event}</div>
              <div className="text-[11px] text-muted-foreground">{n.at}</div>
              {n.text && <p className="mt-0.5 text-foreground">{n.text}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Remarks icon next to the date: just the other side's remarks (buyerRemarks), e.g. why they returned it. */
function RemarksButton({ invoice }: { invoice: Invoice }) {
  const latest = [...bcNotes(invoice)].reverse().find((n) => n.text && n.author !== "You");
  if (!latest) return null;
  return (
    <IconPopover icon={<MessageSquareText />} label="Remarks" width="w-72" inline align="left">
      <div className="mb-1 text-xs font-semibold text-foreground">Remarks</div>
      <p className="text-xs text-foreground">{latest.text}</p>
    </IconPopover>
  );
}

/** Compact Callout: the strip sits right above the invoice, so it stays light. */
function Strip(props: Parameters<typeof Callout>[0]) {
  return <Callout {...props} className="gap-2.5 !rounded-lg !px-3 !py-1.5" />;
}

export function BcStrip({
  invoice,
  connected,
  onCancelDelete,
}: {
  invoice: Invoice;
  connected: boolean;
  /** Only when Cancel & Delete is allowed (deleteRule: not filed in GSTR-1, no IRN, no receipts). */
  onCancelDelete?: () => void;
}) {
  const invite = useStore((s) => s.inviteToBharatConnect);
  const send = useStore((s) => s.sendInvoiceViaBharatConnect);
  const who = invoice.counterpartyName;
  const status = invoice.bcConfirmationStatus;
  const lastAt = bcNotes(invoice).slice(-1)[0]?.at;
  const when = (
    <span className="inline-flex items-center gap-1 align-middle font-normal text-muted-foreground">
      {lastAt && <span className="ms-1">· {lastAt}</span>}
      <RemarksButton invoice={invoice} />
    </span>
  );
  const mark = <BharatConnectMark size={14} />;
  const cancelDelete = onCancelDelete && (
    <Button variant="outline" size="sm" className="!text-destructive" onClick={onCancelDelete}>
      Cancel &amp; Delete
    </Button>
  );

  if (invoice.deletedAt) {
    return (
      <Strip
        icon={<BharatConnectMark size={14} className="grayscale opacity-60" />}
        title={
          <>
            {status === "cancelled" ? "Cancelled on Bharat Connect and deleted" : "Deleted"}
            <span className="font-normal text-muted-foreground"> · {invoice.deletedAt}</span>
          </>
        }
        actions={<ActivityButton invoice={invoice} />}
      />
    );
  }

  if (!connected) {
    return (
      <Strip
        icon={<BharatConnectMark size={14} className="grayscale opacity-60" />}
        title="Send invoices straight to your customers with Bharat Connect"
        actions={
          <Link to="/settings/bharatconnect" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Onboard to Bharat Connect
          </Link>
        }
      />
    );
  }

  if (invoice.bcSendStatus === "not_sent") {
    return invoice.counterpartyB2bId ? (
      <Strip
        tone="primary"
        icon={mark}
        title="Not sent on Bharat Connect"
        actions={
          <Button variant="primary" size="sm" onClick={() => send(invoice.id)}>
            Send via Bharat Connect
          </Button>
        }
      />
    ) : (
      <Strip
        icon={<BharatConnectMark size={14} className="grayscale opacity-60" />}
        title={`${who} isn't on Bharat Connect yet`}
        actions={
          <Button variant="outline" size="sm" onClick={() => invite(who)}>
            Invite
          </Button>
        }
      />
    );
  }

  if (invoice.bcSendStatus === "sending") {
    return <Strip tone="primary" icon={<CircularSpinner size={14} />} title={`Sending to ${who}…`} />;
  }

  switch (status) {
    case "pending":
      return <Strip tone="primary" icon={mark} title={<>Sent to {who}, waiting for a response{when}</>}
          actions={
            <>
              <ActivityButton invoice={invoice} />
              {cancelDelete}
            </>
          }
        />;
    case "accepted":
      return (
        <Strip
          tone="success"
          icon={mark}
          title={<>Accepted by {who}{when}</>}
          actions={<ActivityButton invoice={invoice} />}
        />
      );
    case "returned":
      return (
        <Strip
          tone="warning"
          icon={mark}
          title={<>Returned by {who}{when}</>}
          actions={
            <>
              <ActivityButton invoice={invoice} />
              {cancelDelete}
            </>
          }
        >
          Cancel and delete it, then create a corrected one.
        </Strip>
      );
    case "rejected":
      return (
        <Strip
          tone="destructive"
          icon={mark}
          title={<>Rejected by {who}{when}</>}
          actions={
            <>
              <ActivityButton invoice={invoice} />
              {cancelDelete}
            </>
          }
        />
      );
    case "failure":
      return (
        <Strip
          tone="destructive"
          icon={mark}
          title={`Couldn't send to ${who}`}
          actions={
            <Button variant="primary" size="sm" onClick={() => send(invoice.id)}>
              Resend
            </Button>
          }
        />
      );
    case "cancelled":
      return <Strip icon={mark} title={<>Cancelled on Bharat Connect{when}</>} actions={<ActivityButton invoice={invoice} />} />;
    default:
      return null;
  }
}
