import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "../../store/useStore";
import type { CatalogSide } from "../../types";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Checkbox, Input, Label, Select, Textarea } from "../../components/ui/input";
import { CATALOG_UNITS, EXPENSE_TYPES, GST_RATES } from "../../mock/catalog";

// LEDGERS' Create Catalog form: shared fields on top (name, units, GST, HSN/SAC, CESS), then Sales on the
// left and Purchase on the right, each with price, description, expense type, non-taxable and SKU.

interface SideDraft {
  on: boolean;
  price: string;
  inclusive: boolean;
  description: string;
  expenseType: string;
  nonTaxable: string;
  sku: string;
}

const emptySide = (on: boolean): SideDraft => ({ on, price: "", inclusive: true, description: "", expenseType: "", nonTaxable: "", sku: "" });

export function CreateCatalogDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addCatalogItem = useStore((s) => s.addCatalogItem);
  const [type, setType] = useState<"goods" | "services">("goods");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("UNT-UNITS");
  const [gst, setGst] = useState("5");
  const [hsn, setHsn] = useState("");
  const [cessType, setCessType] = useState<"flat" | "percent">("flat");
  const [cess, setCess] = useState("");
  const [sales, setSales] = useState(emptySide(true));
  const [purchase, setPurchase] = useState(emptySide(false));

  const sideOk = (s: SideDraft) => !s.on || Number(s.price) > 0;
  const valid = name.trim() && hsn.trim() && (sales.on || purchase.on) && sideOk(sales) && sideOk(purchase);

  const reset = () => {
    setType("goods");
    setName("");
    setUnit("UNT-UNITS");
    setGst("5");
    setHsn("");
    setCess("");
    setSales(emptySide(true));
    setPurchase(emptySide(false));
  };
  const close = () => {
    reset();
    onClose();
  };
  const toSide = (s: SideDraft): CatalogSide | undefined =>
    s.on
      ? {
          price: Number(s.price),
          taxInclusive: s.inclusive,
          description: s.description.trim() || undefined,
          expenseType: s.expenseType || undefined,
          nonTaxable: s.nonTaxable ? Number(s.nonTaxable) : undefined,
          sku: s.sku.trim() || undefined,
        }
      : undefined;

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Create Catalog"
      className="!max-w-[700px]"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="success"
            disabled={!valid}
            onClick={() => {
              addCatalogItem({
                type,
                name: name.trim(),
                unit,
                gstRate: Number(gst),
                hsn: hsn.trim(),
                cessType: cess ? cessType : undefined,
                cess: cess ? Number(cess) : undefined,
                sales: toSide(sales),
                purchase: toSide(purchase),
              });
              close();
            }}
          >
            <Plus />
            Add Catalog
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <div className="space-y-2">
          <Label required>Item Name</Label>
          <div className="flex">
            <Select value={type} onChange={(e) => setType(e.target.value as "goods" | "services")} wrapperClassName="w-28 shrink-0" className="!rounded-e-none">
              <option value="goods">Goods</option>
              <option value="services">Services</option>
            </Select>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item Name" className="!rounded-s-none !border-s-0" />
          </div>
        </div>
        <div className="space-y-2">
          <Label required>Units</Label>
          <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {CATALOG_UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label required>GST Rate</Label>
            <Select value={gst} onChange={(e) => setGst(e.target.value)}>
              {GST_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label required>HSN/SAC</Label>
            <Input value={hsn} onChange={(e) => setHsn(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Enter HSN/SAC" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>CESS Type</Label>
            <Select value={cessType} onChange={(e) => setCessType(e.target.value as "flat" | "percent")}>
              <option value="flat">Flat Value</option>
              <option value="percent">Percentage</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>CESS</Label>
            <Input value={cess} onChange={(e) => setCess(e.target.value)} placeholder="Enter CESS amount" />
          </div>
        </div>

        <SideFields label="Sales" value={sales} onChange={setSales} />
        <SideFields label="Purchase" value={purchase} onChange={setPurchase} />
      </div>
    </Dialog>
  );
}

function SideFields({ label, value, onChange }: { label: string; value: SideDraft; onChange: (v: SideDraft) => void }) {
  const set = (patch: Partial<SideDraft>) => onChange({ ...value, ...patch });
  const off = !value.on;
  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
        <Checkbox checked={value.on} onChange={(e) => set({ on: e.target.checked })} />
        {label}
      </label>
      <div className="space-y-2">
        <Label required>Price</Label>
        <div className="flex">
          <Input
            value={value.price}
            onChange={(e) => set({ price: e.target.value })}
            placeholder={label === "Sales" ? "Price" : "Purchase Price"}
            disabled={off}
            className="!rounded-e-none"
          />
          <Select
            value={value.inclusive ? "in" : "ex"}
            onChange={(e) => set({ inclusive: e.target.value === "in" })}
            disabled={off}
            wrapperClassName="w-40 shrink-0"
            className="!rounded-s-none !border-s-0"
          >
            <option value="in">Inclusive of GST</option>
            <option value="ex">Exclusive of GST</option>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea rows={2} value={value.description} onChange={(e) => set({ description: e.target.value })} placeholder="Enter Description" disabled={off} />
      </div>
      <div className="space-y-2">
        <Label>Expense Type</Label>
        <Select value={value.expenseType} onChange={(e) => set({ expenseType: e.target.value })} disabled={off}>
          <option value="">Select Expense Type</option>
          {EXPENSE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Non-Taxable</Label>
          <Input value={value.nonTaxable} onChange={(e) => set({ nonTaxable: e.target.value })} placeholder="Non-Taxable" disabled={off} />
        </div>
        <div className="space-y-2">
          <Label>SKU</Label>
          <Input value={value.sku} onChange={(e) => set({ sku: e.target.value })} placeholder="SKU" disabled={off} />
        </div>
      </div>
    </div>
  );
}
