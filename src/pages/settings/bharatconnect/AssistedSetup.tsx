import { MessageCircle } from "lucide-react";
import { useStore } from "../../../store/useStore";
import type { Business } from "../../../types";

export function AssistedSetup({ business }: { business: Business }) {
  const pushToast = useStore((s) => s.pushToast);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-foreground">Let's set this up together</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        PAN {business.pan} isn't on the Income Tax portal yet, so we can't verify ownership automatically.
      </p>

      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-foreground">
          This happens with newly issued PANs or ones not yet e-filed. Our team can verify your business manually
          and get {business.name} connected — it usually takes one business day.
        </p>
        <button
          onClick={() => pushToast("Our team will reach out to help with setup.")}
          className="mt-5 flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
        >
          <MessageCircle className="h-4 w-4" />
          Contact us
        </button>
      </div>
    </div>
  );
}
