import { useState } from "react";
import { Tabs } from "../../components/ui/tabs";
import { tableCls, thCls } from "../../components/ui/table";
import { CURRENT_MONTH, fyLabel } from "./months";
import { EmptyRow, panelCls } from "./shared";

// v4 /hrms/manage-tax-declaration: Tax Declaration / Prior Earning tabs for the FY. Empty in Demo
// Ledgers too; kept so links from Payroll Computation and the dashboard land somewhere real.

export function TaxDeclarationPage() {
  const [tab, setTab] = useState<"declaration" | "prior">("declaration");
  return (
    <div>
      <h1 className="mb-5 text-xl font-medium text-foreground">Tax Declaration</h1>
      <div className={panelCls}>
        <div className="flex min-h-14 items-center justify-between border-b border-border px-5">
          <Tabs<"declaration" | "prior">
            value={tab}
            onChange={setTab}
            items={[
              { value: "declaration", label: "Tax Declaration" },
              { value: "prior", label: "Prior Earning" },
            ]}
          />
          <span className="text-sm text-muted-foreground">FY → {fyLabel(CURRENT_MONTH).replace("–", "-")}</span>
        </div>
        <table className={tableCls}>
          <thead>
            <tr className="bg-muted/40">
              {["Emp ID", "Emp Name", "Amount", "Document Name", "Status", "Actions"].map((h) => (
                <th key={h} className={thCls}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <EmptyRow colSpan={6}>No records found! There are no tax declaration records available at the moment.</EmptyRow>
          </tbody>
        </table>
      </div>
    </div>
  );
}
