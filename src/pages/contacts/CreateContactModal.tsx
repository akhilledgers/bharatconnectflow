import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Upload, X } from "lucide-react";
import { useStore } from "../../store/useStore";
import { lookupBcByGstin, lookupGstRegistry } from "../../mock/seed";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import type { Address, LedgerContact } from "../../types";

type BcCheck = { state: "idle" } | { state: "checking" } | { state: "found"; bcId: string } | { state: "not_found" };

const TABS = ["Information", "Billing Address", "Tax Information"] as const;

export function CreateContactModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const createContact = useStore((s) => s.createContact);
  const requestContactDetails = useStore((s) => s.requestContactDetails);
  const business = useStore((s) => s.currentBusiness());
  const connected = business.connectionState === "connected";
  const [tab, setTab] = useState<(typeof TABS)[number]>("Information");

  const [salutation, setSalutation] = useState("Mr");
  const [contactName, setContactName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [pan, setPan] = useState("");
  const [gstin, setGstin] = useState("");
  const [billingAddress, setBillingAddress] = useState<Address | undefined>(undefined);
  const [bcCheck, setBcCheck] = useState<BcCheck>({ state: "idle" });
  const [invite, setInvite] = useState(true);
  const [saving, setSaving] = useState(false);

  function handleGstinChange(value: string) {
    setGstin(value);
    if (value.trim().length !== 15) {
      setBcCheck({ state: "idle" });
      return;
    }

    // Native GST-portal autofill — works regardless of BharatConnect connection.
    const gstMatch = lookupGstRegistry(value);
    if (gstMatch) {
      if (gstMatch.name && !contactName) setContactName(gstMatch.name);
      if (gstMatch.name && !businessName) setBusinessName(gstMatch.name);
      if (!pan) setPan(gstMatch.pan);
      if (gstMatch.address) setBillingAddress(gstMatch.address);
    }

    // BharatConnect status is only searched once this business is itself connected.
    if (!connected) return;
    setBcCheck({ state: "checking" });
    setTimeout(() => {
      const match = lookupBcByGstin(value);
      if (match) {
        setBcCheck({ state: "found", bcId: match.bcId });
        if (!contactName) setContactName(match.name);
        if (!businessName) setBusinessName(match.name);
      } else {
        setBcCheck({ state: "not_found" });
      }
    }, 500);
  }

  const canSave = contactName.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const contact: LedgerContact = {
      id: `ct-${Math.floor(Math.random() * 90000 + 10000)}`,
      salutation,
      name: contactName.trim(),
      displayName: displayName.trim() || undefined,
      type: "customer",
      businessName: businessName.trim() || undefined,
      email: email.trim() || undefined,
      mobile: mobile.trim() || undefined,
      gstin: gstin.trim() || undefined,
      pan: pan.trim() || undefined,
      region: "INDIA",
      billingAddress,
      b2bId: bcCheck.state === "found" ? bcCheck.bcId : bcCheck.state === "not_found" ? null : undefined,
    };
    const shouldInvite = bcCheck.state === "not_found" && invite;
    await createContact(contact, shouldInvite);
    setSaving(false);
    onClose();
    navigate("/contacts");
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-8 pb-4 pt-6">
          <div className="flex gap-1.5">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium ${
                  tab === t ? "border border-gray-200 bg-white text-ink shadow-sm" : "text-faint hover:text-body"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-faint hover:text-body">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-6">
          {tab !== "Information" ? (
            <div className="flex h-48 items-center justify-center text-sm text-faint">
              You can add this after creating the contact.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  AUTOFILL FROM GSTIN
                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white">
                    RECOMMENDED
                  </span>
                </div>
                <input
                  value={gstin}
                  onChange={(e) => handleGstinChange(e.target.value.toUpperCase())}
                  maxLength={15}
                  placeholder="Enter GSTIN to auto-fill name, PAN, address & more"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />

                {connected && (
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700">
                    <BharatConnectMark size={11} />
                    We'll also check if they're on BharatConnect
                  </div>
                )}

                {bcCheck.state === "checking" && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-faint">
                    <CircularSpinner size={12} /> Checking BharatConnect…
                  </div>
                )}
                {bcCheck.state === "found" && (
                  <div className="mt-2 rounded-md border border-emerald-200 bg-white p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      On BharatConnect
                      <span className="font-mono text-emerald-800">{bcCheck.bcId}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-faint">
                      Email and mobile aren't shared by default — you can request them once saved.
                    </p>
                    <button
                      onClick={() => requestContactDetails(contactName || businessName || "them")}
                      className="mt-1.5 text-[11px] font-medium text-primary hover:text-primary-hover"
                    >
                      Request contact details
                    </button>
                  </div>
                )}
                {bcCheck.state === "not_found" && (
                  <div className="mt-2 rounded-md border border-gray-200 bg-white p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-body">
                      <BharatConnectMark size={12} className="grayscale opacity-60" />
                      Not on BharatConnect yet
                    </div>
                    <label className="mt-1.5 flex items-center gap-2 text-xs text-faint">
                      <input
                        type="checkbox"
                        checked={invite}
                        onChange={(e) => setInvite(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      Invite them to BharatConnect once saved
                    </label>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3.5 text-sm text-faint">
                <Upload className="h-4 w-4" />
                Or upload a visiting card to create a contact (.jpeg, .jpg, .png)
              </div>

              <div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-5">
                <div className="col-span-1">
                  <label className="mb-1 block text-xs font-medium text-body">
                    Contact Name <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={salutation}
                      onChange={(e) => setSalutation(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {["Mr", "Ms", "Mrs", "M/s"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Enter Contact Name"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-body">Display Name</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter Display Name"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-body">Entity</label>
                  <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                    <option>Individual</option>
                    <option>Company</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-body">Business Name</label>
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Enter Business Name"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-body">Business Country</label>
                  <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                    <option>INDIA</option>
                  </select>
                </div>
                <div />

                <div>
                  <label className="mb-1 block text-xs font-medium text-body">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter Email"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-body">Mobile</label>
                  <div className="flex gap-1.5">
                    <span className="flex items-center rounded-md border border-gray-300 px-2 text-sm text-body">
                      +91
                    </span>
                    <input
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="Enter Mobile Number"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div />

                <div>
                  <label className="mb-1 block text-xs font-medium text-body">PAN</label>
                  <input
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    maxLength={10}
                    placeholder="Enter PAN"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-body">Reverse Charge Applicable</label>
                  <select className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-8 py-5">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-body hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <span className="text-base leading-none">+</span>
            {saving ? "Adding…" : "Add Contact"}
          </button>
        </div>
      </div>
    </div>
  );
}
