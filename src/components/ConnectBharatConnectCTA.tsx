import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useStore } from "../store/useStore";
import { isBannerSnoozed } from "../lib/status";
import { BharatConnectMark } from "./layout/BharatConnectMark";

export function ConnectBharatConnectBanner({
  message = "Get paid faster — onboard to Bharat Connect and send invoices instantly.",
}: {
  message?: string;
}) {
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const snoozeBanner = useStore((s) => s.snoozeBanner);
  const connected = business.connectionState === "connected";

  if (connected) return null;
  if (isBannerSnoozed(business.bannerSnoozedUntil)) return null;

  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-5 py-3.5">
      <div className="flex items-center gap-2.5 text-sm text-blue-900">
        <BharatConnectMark size={16} />
        <span>{message}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          onClick={() => navigate("/settings/bharatconnect")}
          className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
        >
          Onboard Now
        </button>
        <button
          onClick={() => snoozeBanner(business.id)}
          title="Remind me in 7 days"
          className="text-blue-400 hover:text-blue-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ConnectBharatConnectCard({ kind }: { kind: "sales" | "purchase" }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-dashed border-input bg-muted/50 p-5 text-center">
      <BharatConnectMark size={20} className="mx-auto mb-2" />
      {/* Heading carries the reason; no extra grey sentence between it and the button. */}
      <div className="text-sm font-medium text-foreground">
        {kind === "sales" ? "Send this invoice in seconds" : "Receive bills like this automatically"}
      </div>
      <button
        onClick={() => navigate("/settings/bharatconnect")}
        className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
      >
        Onboard to Bharat Connect
      </button>
    </div>
  );
}
