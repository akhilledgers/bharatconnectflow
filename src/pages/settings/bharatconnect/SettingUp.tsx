import type { Business } from "../../../types";

export function SettingUp({ business }: { business: Business }) {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-ink">Setting up BharatConnect</h1>
      <p className="mb-6 text-sm text-faint">
        Your registration for {business.name} is with BharatConnect. You can leave this page — we'll email and
        notify you in-app the moment it's confirmed.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white px-6 py-8">
        <div className="space-y-4">
          {["Details sent to BharatConnect", "ID created", "Waiting for confirmation"].map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                  i < 2 ? "bg-emerald-100 text-emerald-600" : "bg-primary-soft text-primary"
                }`}
              >
                {i < 2 ? "✓" : 3}
              </span>
              <span className="text-ink">{label}</span>
              {i === 2 && (
                <span className="ml-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
