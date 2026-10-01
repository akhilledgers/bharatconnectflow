import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";

export function SendViaBharatConnectButton({ invoiceId }: { invoiceId: string }) {
  const connected = useStore((s) => s.currentBusiness().connectionState === "connected");
  const navigate = useNavigate();

  if (!connected) {
    return (
      <div className="text-right">
        <button
          disabled
          className="cursor-not-allowed rounded-full border border-border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground"
        >
          Send via Bharat Connect
        </button>
        <button
          onClick={() => navigate("/settings/bharatconnect")}
          className="mt-1 block w-full text-xs font-medium text-primary hover:text-primary/80"
        >
          Connect to enable
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => navigate(`/sales/invoices/${invoiceId}`)}
      className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
    >
      Send via Bharat Connect
    </button>
  );
}
