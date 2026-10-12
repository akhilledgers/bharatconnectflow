import { useEffect, type ReactNode } from "react";
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
 * below, then sends it via Bharat Connect from here. Follows the invoice through sending → sent,
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
  const mark = <BharatConnectMark size={14} />;

  if (!connected) {
    return (
      <Strip
        tone="primary"
        icon={mark}
        title={`Invoice ${invoice.id} created. Review it below.`}
        actions={
          <>
            {/* Outline: the sidebar's connect card already carries the page's filled Connect button. */}
            <Link to="/settings/bharatconnect" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Onboard to Bharat Connect
            </Link>
            {dismiss}
          </>
        }
      />
    );
  }

  if (!invoice.counterpartyB2bId) {
    return (
      <Strip
        tone="primary"
        icon={<BharatConnectMark size={14} className="grayscale opacity-60" />}
        title={`Invoice ${invoice.id} created. ${invoice.counterpartyName} isn't on Bharat Connect yet.`}
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => inviteToBharatConnect(invoice.counterpartyName)}>
              Invite
            </Button>
            {dismiss}
          </>
        }
      >
        Invite them so you can send this and future invoices to them directly.
      </Strip>
    );
  }

  if (invoice.bcSendStatus === "sending") {
    return (
      <Strip tone="primary" icon={<CircularSpinner size={14} />} title={`Sending to ${invoice.counterpartyName}…`} />
    );
  }

  if (invoice.bcSendStatus === "sent") {
    return <SentCallout name={invoice.counterpartyName} onDismiss={onDismiss} dismiss={dismiss} />;
  }

  return (
    <Strip
      tone="primary"
      icon={mark}
      title={`Invoice ${invoice.id} created. Send via Bharat Connect?`}
      actions={
        <>
          <Button variant="primary" size="sm" onClick={() => sendInvoiceViaBharatConnect(invoice.id)}>
            Send Now
          </Button>
          {dismiss}
        </>
      }
    />
  );
}

/** "Sent" confirmation; the Bharat Connect card already shows the status, so it clears itself. */
function SentCallout({ name, onDismiss, dismiss }: { name: string; onDismiss: () => void; dismiss: ReactNode }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return <Strip tone="success" icon={<CheckCircle2 className="size-4 text-green-600" />} title={`Sent to ${name}.`} actions={dismiss} />;
}

/** Same compact strip as the Bharat Connect strip (BcStrip): sits right above the invoice. */
function Strip(props: Parameters<typeof Callout>[0]) {
  return <Callout {...props} className="gap-2.5 !rounded-lg !px-3 !py-1.5" />;
}
