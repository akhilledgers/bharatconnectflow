import { Link } from "react-router-dom";
import { CheckCircle2, X } from "lucide-react";
import { useStore } from "../../store/useStore";
import type { Invoice } from "../../types";
import { Button } from "../../components/ui/button";
import { buttonVariants } from "../../components/ui/button-variants";
import { Callout } from "../../components/ui/popover";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { CircularSpinner } from "../../components/layout/CircularSpinner";

/**
 * Shown on a sales invoice's view page right after it's created: the user reviews the document
 * below, then sends it via BharatConnect from here. Follows the invoice through sending → sent,
 * so the result of the click is visible in the same place.
 */
export function ReviewAndSendCallout({ invoice, onDismiss }: { invoice: Invoice; onDismiss: () => void }) {
  const business = useStore((s) => s.currentBusiness());
  const sendInvoiceViaBharatConnect = useStore((s) => s.sendInvoiceViaBharatConnect);
  const inviteToBharatConnect = useStore((s) => s.inviteToBharatConnect);
  const connected = business.connectionState === "connected";

  const dismiss = (
    <Button variant="ghost" size="icon-sm" onClick={onDismiss} aria-label="Dismiss">
      <X />
    </Button>
  );
  const mark = <BharatConnectMark size={22} />;

  if (!connected) {
    return (
      <Callout
        tone="primary"
        icon={mark}
        title={`Invoice ${invoice.id} created. Review it below.`}
        actions={
          <>
            {/* Outline: the sidebar's connect card already carries the page's filled Connect button. */}
            <Link to="/settings/bharatconnect" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Connect BharatConnect
            </Link>
            {dismiss}
          </>
        }
      >
        Connect BharatConnect to send invoices straight to your buyers, instead of emailing a PDF.
      </Callout>
    );
  }

  if (!invoice.counterpartyB2bId) {
    return (
      <Callout
        tone="primary"
        icon={<BharatConnectMark size={22} className="grayscale opacity-60" />}
        title={`Invoice ${invoice.id} created. ${invoice.counterpartyName} isn't on BharatConnect yet.`}
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => inviteToBharatConnect(invoice.counterpartyName)}>
              Invite to BharatConnect
            </Button>
            {dismiss}
          </>
        }
      >
        Invite them so you can send this and future invoices to them directly.
      </Callout>
    );
  }

  if (invoice.bcSendStatus === "sending") {
    return (
      <Callout tone="primary" icon={mark} title={`Sending ${invoice.id} to ${invoice.counterpartyName}…`}>
        <span className="inline-flex items-center gap-1.5">
          <CircularSpinner size={12} /> Delivering to <span className="font-mono">{invoice.counterpartyB2bId}</span>
        </span>
      </Callout>
    );
  }

  if (invoice.bcSendStatus === "sent") {
    return (
      <Callout
        tone="success"
        icon={<CheckCircle2 className="size-5 text-green-600" />}
        title={`Sent via BharatConnect to ${invoice.counterpartyName}.`}
        actions={dismiss}
      >
        Waiting for them to confirm. You'll see the confirmation status in the BharatConnect card on the right.
      </Callout>
    );
  }

  return (
    <Callout
      tone="primary"
      icon={mark}
      title={`Invoice ${invoice.id} created. Review it below, then send it to ${invoice.counterpartyName}.`}
      actions={
        <>
          <Button variant="primary" size="sm" onClick={() => sendInvoiceViaBharatConnect(invoice.id)}>
            Send via BharatConnect
          </Button>
          {dismiss}
        </>
      }
    >
      It will be delivered to their BharatConnect ID <span className="font-mono">{invoice.counterpartyB2bId}</span>.
    </Callout>
  );
}
