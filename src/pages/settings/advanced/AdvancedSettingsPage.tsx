import { useSearchParams } from "react-router-dom";
import { Tabs } from "../../../components/ui/tabs";
import { HrSettingsTab } from "./HrSettingsTab";

// v4 /business/advanced-settings. Only the HR tab is built in this prototype; the other tabs exist so
// the page reads like the real one.

type Tab = "invoice" | "quote" | "receipt" | "series" | "audit" | "inventory" | "hr" | "po";

const TABS: { value: Tab; label: string }[] = [
  { value: "invoice", label: "Invoice" },
  { value: "quote", label: "Quote" },
  { value: "receipt", label: "Receipt" },
  { value: "series", label: "Series" },
  { value: "audit", label: "Audit Log" },
  { value: "inventory", label: "Inventory" },
  { value: "hr", label: "HR" },
  { value: "po", label: "Purchase Order" },
];

export function AdvancedSettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "hr";
  return (
    <div>
      <h1 className="mb-5 text-xl font-medium text-foreground">Advanced Settings</h1>
      <div className="rounded-xl border border-border bg-card shadow-xs shadow-black/5">
        <Tabs<Tab> variant="line" value={tab} onChange={(t) => setParams({ tab: t })} items={TABS} />
        <div className="p-5">
          {tab === "hr" ? <HrSettingsTab /> : <div className="py-16 text-center text-sm text-muted-foreground">Not part of this prototype — see the HR tab.</div>}
        </div>
      </div>
    </div>
  );
}
