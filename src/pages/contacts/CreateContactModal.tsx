import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Plus, Upload } from "lucide-react";
import { useStore } from "../../store/useStore";
import { lookupBcByGstin, lookupGstRegistry } from "../../mock/seed";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { CircularSpinner } from "../../components/layout/CircularSpinner";
import type { Address, LedgerContact } from "../../types";
import { Button } from "../../components/ui/button";
import { Sheet } from "../../components/ui/dialog";
import { Checkbox, Input, Label, Select } from "../../components/ui/input";
import { Tabs } from "../../components/ui/tabs";

// LEDGERS' Create Contact: a right-side sheet with Information / Billing Address / Tax Information tabs centred
// at the top, the green "Autofill from GSTIN" box, a visiting-card drop zone, a two-column form, and a footer with
// Cancel + green "Add Contact". Bharat Connect adds its status check under the GSTIN box (only when connected).

const ENTITIES = [
  "Individual",
  "Proprietorship",
  "Partnership",
  "Hindu Undivided Family",
  "Private Limited Company",
  "Public Limited Company",
  "One Person Company",
  "Society/Club/Trust/Association of Persons",
  "Government Department",
  "Public Sector Undertaking",
  "Limited Liability Partnership",
  "Others",
];

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

    // Native GST-portal autofill — works regardless of Bharat Connect connection.
    const gstMatch = lookupGstRegistry(value);
    if (gstMatch) {
      if (gstMatch.name && !contactName) setContactName(gstMatch.name);
      if (gstMatch.name && !businessName) setBusinessName(gstMatch.name);
      if (!pan) setPan(gstMatch.pan);
      if (gstMatch.address) setBillingAddress(gstMatch.address);
    }

    // Bharat Connect status is only searched once this business is itself connected.
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
    <Sheet
      open
      onClose={onClose}
      title="Create Contact"
      header={
        <div className="flex justify-center">
          <Tabs value={tab} onChange={setTab} items={TABS.map((t) => ({ value: t, label: t }))} />
        </div>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleSave} disabled={!canSave || saving}>
            <Plus />
            {saving ? "Adding…" : "Add Contact"}
          </Button>
        </>
      }
    >
      {tab !== "Information" ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">You can add this after creating the contact.</div>
      ) : (
        <div className="space-y-4">
          <div className="mb-3 mt-2 rounded-lg border border-emerald-600/35 bg-emerald-50/90 px-3 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Autofill from GSTIN</span>
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-white">
                Recommended
              </span>
            </div>
            <Input
              value={gstin}
              onChange={(e) => handleGstinChange(e.target.value.toUpperCase())}
              maxLength={15}
              placeholder="Enter GSTIN to auto-fill name, PAN, address & more"
            />
            {connected && (
              <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-800">
                <BharatConnectMark size={11} />
                We'll also check if they're on Bharat Connect
              </div>
            )}
            {bcCheck.state === "checking" && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <CircularSpinner size={12} /> Checking Bharat Connect…
              </div>
            )}
            {bcCheck.state === "found" && (
              <div className="mt-2 rounded-md border border-emerald-600/25 bg-background p-2.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="size-3.5" />
                  On Bharat Connect
                  <span className="tabular-nums text-emerald-800">{bcCheck.bcId}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Email and mobile aren't shared by default. You can request them once saved.</p>
                <button
                  onClick={() => requestContactDetails(contactName || businessName || "them")}
                  className="mt-1.5 cursor-pointer text-[11px] font-medium text-primary hover:text-primary/80"
                >
                  Request contact details
                </button>
              </div>
            )}
            {bcCheck.state === "not_found" && (
              <div className="mt-2 rounded-md border border-border bg-background p-2.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <BharatConnectMark size={12} className="grayscale opacity-60" />
                  Not on Bharat Connect yet
                </div>
                <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={invite} onChange={(e) => setInvite(e.target.checked)} />
                  Invite them to Bharat Connect once saved
                </label>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-input py-3 text-sm text-foreground">
            <Upload className="size-4 opacity-60" />
            Or upload a visiting card to create a contact <span className="text-xs text-muted-foreground">(.jpeg, .jpg, .png)</span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            <div className="space-y-2">
              <Label required>Contact Name</Label>
              <div className="flex">
                <Select value={salutation} onChange={(e) => setSalutation(e.target.value)} wrapperClassName="w-16 shrink-0" className="!rounded-e-none">
                  {["Mr", "Mrs", "Ms", "Miss", "Dr", "Prof", "M/S"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Enter Contact Name" className="!rounded-s-none !border-s-0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Enter Display Name" />
              </div>
              <div className="space-y-2">
                <Label>Entity</Label>
                <Select defaultValue="Individual">
                  {ENTITIES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Enter Business Name" />
            </div>
            <div className="space-y-2">
              <Label>Business Country</Label>
              <Select defaultValue="INDIA">
                <option>INDIA</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter Email" />
            </div>
            <div className="space-y-2">
              <Label>Mobile</Label>
              <div className="flex">
                <Select defaultValue="+91" wrapperClassName="w-28 shrink-0" className="!rounded-e-none">
                  <option value="+91">+91 India</option>
                </Select>
                <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Enter Mobile Number" className="!rounded-s-none !border-s-0" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>PAN</Label>
              <Input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} maxLength={10} placeholder="Enter PAN" />
            </div>
            <div className="space-y-2">
              <Label>Reverse Charge Applicable</Label>
              <Select defaultValue="No">
                <option>No</option>
                <option>Yes</option>
              </Select>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
