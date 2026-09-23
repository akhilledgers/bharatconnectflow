import { useNavigate } from "react-router-dom";
import { BharatConnectMark } from "./layout/BharatConnectMark";

export function ConnectBharatConnectBanner() {
  const navigate = useNavigate();
  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-5 py-3.5">
      <div className="flex items-center gap-2.5 text-sm text-blue-900">
        <BharatConnectMark size={16} />
        <span>Connect BharatConnect to send invoices straight to your customers and get paid faster.</span>
      </div>
      <button
        onClick={() => navigate("/settings/bharatconnect")}
        className="shrink-0 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
      >
        Connect now
      </button>
    </div>
  );
}

export function ConnectBharatConnectCard({ kind }: { kind: "sales" | "purchase" }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-center">
      <BharatConnectMark size={20} className="mx-auto mb-2" />
      <div className="text-sm font-medium text-ink">Not connected to BharatConnect</div>
      <p className="mt-1 text-xs text-faint">
        {kind === "sales"
          ? "Once connected, you can send invoices straight to a customer's BharatConnect ID."
          : "Once connected, bills from your suppliers will arrive here to accept or reject."}
      </p>
      <button
        onClick={() => navigate("/settings/bharatconnect")}
        className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover"
      >
        Connect BharatConnect
      </button>
    </div>
  );
}
