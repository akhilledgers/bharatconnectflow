import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useStore } from "../../../store/useStore";
import { baseIdWithoutSuffix, buildExtraId, checkEnding } from "../../../lib/id-standard";
import { mockCheckEndingAvailability } from "../../../mock/api";
import type { Business, IdVisibility } from "../../../types";

const SUGGESTIONS = ["DELHI", "EXPOS", "PROC", "RETL", "B2B"];

export function CreateIdDrawer({ business, onClose }: { business: Business; onClose: () => void }) {
  const createId = useStore((s) => s.createId);
  const pushToast = useStore((s) => s.pushToast);

  const canChooseBasis = business.businessType !== "sole_proprietor" && !!business.gstin;
  const [basedOn, setBasedOn] = useState<"PAN" | "GSTIN">(
    business.bharatConnectIds[0]?.basedOn ?? "PAN",
  );
  const [ending, setEnding] = useState("");
  const [visibility, setVisibility] = useState<IdVisibility>("public");
  const [settlementAccountId, setSettlementAccountId] = useState<string>("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");

  const formatCheck = checkEnding(ending || "AA");
  const base = baseIdWithoutSuffix(business, basedOn);
  const preview = ending ? buildExtraId(base, ending) : `${base}.____@BCB`;

  useEffect(() => {
    if (!ending || !checkEnding(ending).valid) {
      setAvailability("idle");
      return;
    }
    let cancelled = false;
    setAvailability("checking");
    mockCheckEndingAvailability(ending).then((res) => {
      if (cancelled) return;
      setAvailability(res.available ? "available" : "taken");
    });
    return () => {
      cancelled = true;
    };
  }, [ending]);

  const verifiedAccounts = business.bankAccounts.filter((a) => a.verified);
  const canSubmit = ending.length >= 2 && checkEnding(ending).valid && availability === "available";

  function handleCreate() {
    createId(business.id, {
      id: buildExtraId(base, ending),
      label: "Extra",
      basedOn,
      linkedIdentifierValue: basedOn === "GSTIN" ? business.gstin ?? business.pan : business.pan,
      visibility,
      status: "active",
      settlementAccountId: settlementAccountId || null,
    });
    pushToast("BharatConnect ID created.");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto scrollbar-thin bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Create BharatConnect ID</h2>
          <button onClick={onClose} className="text-faint hover:text-body">
            <X className="h-4 w-4" />
          </button>
        </div>

        {canChooseBasis && (
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">Based on</label>
            <select
              value={basedOn}
              onChange={(e) => setBasedOn(e.target.value as "PAN" | "GSTIN")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="PAN">PAN ({business.pan})</option>
              <option value="GSTIN">GSTIN ({business.gstin})</option>
            </select>
            <p className="mt-1.5 text-xs text-faint">
              Extra IDs are built as PAN.ENDING@BCB or GSTIN.ENDING@BCB. Only verified identifiers appear.
            </p>
          </div>
        )}

        <div className="mb-2">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
            Ending, 2 to 5 characters
          </label>
          <input
            value={ending}
            onChange={(e) => setEnding(e.target.value.toUpperCase().slice(0, 5))}
            placeholder="MUMBA"
            className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="mt-1.5 text-xs text-faint">
            Letters A to Z and numbers only. Use a city, branch or product line. No offensive words and no platform
            names.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setEnding(s)}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-body hover:bg-gray-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
          <span className="font-mono text-sm font-medium text-ink">{preview}</span>
          {ending && (
            <span
              className={`text-xs font-medium ${
                !formatCheck.valid
                  ? "text-red-600"
                  : availability === "checking"
                    ? "text-faint"
                    : availability === "available"
                      ? "text-emerald-700"
                      : "text-red-600"
              }`}
            >
              {!formatCheck.valid
                ? formatCheck.reason
                : availability === "checking"
                  ? "Checking…"
                  : availability === "available"
                    ? "Available"
                    : "Already taken"}
            </span>
          )}
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
            Who can find this ID
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setVisibility("public")}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm ${
                visibility === "public" ? "border-primary bg-primary-soft" : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="font-medium text-ink">Public</div>
              <div className="text-xs text-faint">Counterparties can look it up.</div>
            </button>
            <button
              onClick={() => setVisibility("private")}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm ${
                visibility === "private" ? "border-primary bg-primary-soft" : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="font-medium text-ink">Private</div>
              <div className="text-xs text-faint">Shared only by you.</div>
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
            Settlement account (optional)
          </label>
          <select
            value={settlementAccountId}
            onChange={(e) => setSettlementAccountId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">None verified yet</option>
            {verifiedAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.beneficiaryName} · {a.ifsc} ending {a.accountEnding}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-faint">
            Accounts verified in LEDGERS Banking will show up here. Linking one lets this ID receive payments
            without bank details on each invoice.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-body hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canSubmit}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
          >
            Create ID
          </button>
        </div>
      </div>
    </div>
  );
}
