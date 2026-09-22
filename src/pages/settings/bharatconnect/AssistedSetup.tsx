import { useStore } from "../../../store/useStore";
import type { Business } from "../../../types";

export function AssistedSetup({ business }: { business: Business }) {
  const pushToast = useStore((s) => s.pushToast);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-ink">Let's set this up together</h1>
      <p className="mb-6 text-sm text-faint">
        PAN {business.pan} isn't on the Income Tax portal yet, so we can't verify ownership automatically.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-body">
          This happens with newly issued PANs or ones not yet e-filed. Our team can verify your business manually
          and get {business.name} connected — it usually takes one business day.
        </p>
        <button
          onClick={() => pushToast("Our team will reach out to help with setup.")}
          className="mt-5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Contact us
        </button>
      </div>
    </div>
  );
}
