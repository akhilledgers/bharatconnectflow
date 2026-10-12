import type { CatalogItem, Invoice, InvoiceLineItem } from "../types";

// LEDGERS catalog mock. Units use LEDGERS' "CODE-NAME" labels (GST UQC codes); the Bharat Connect
// invoice sends just the code ("KGS"), so unitLabel() maps one to the other.
export const CATALOG_UNITS = [
  "UNT-UNITS",
  "NOS-NUMBERS",
  "PCS-PIECES",
  "KGS-KILOGRAMS",
  "BAG-BAGS",
  "BOX-BOX",
  "MTR-METERS",
  "LTR-LITRES",
  "PRS-PAIRS",
  "SET-SETS",
  "OTH-OTHERS",
];

export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];

/** Expense Type is a chart-of-accounts ledger in LEDGERS; these are the common purchase ones. */
export const EXPENSE_TYPES = [
  "Purchases",
  "Raw Materials",
  "Packing Materials",
  "Freight Inward",
  "Professional Fees",
  "Repairs & Maintenance",
  "Office Expenses",
  "Consumables",
];

export function unitLabel(code?: string): string | undefined {
  if (!code) return undefined;
  return CATALOG_UNITS.find((u) => u.startsWith(`${code.toUpperCase()}-`));
}

const item = (i: Omit<CatalogItem, "status" | "createdBy" | "createdAt"> & Partial<CatalogItem>): CatalogItem => ({
  status: "active",
  createdBy: "Akhil Manoj",
  createdAt: "12-08-2026",
  ...i,
});

export function makeSeedCatalog(): CatalogItem[] {
  return [
    item({ id: "5363", type: "goods", name: "Steel Rod 10mm", unit: "KGS-KILOGRAMS", gstRate: 18, hsn: "7214", purchase: { price: 62, taxInclusive: false, expenseType: "Raw Materials" } }),
    item({ id: "5362", type: "goods", name: "Binding Wire 18 Gauge", unit: "KGS-KILOGRAMS", gstRate: 18, hsn: "7217", purchase: { price: 78, taxInclusive: false, expenseType: "Raw Materials" } }),
    item({ id: "5361", type: "goods", name: "Cement OPC 53 Grade", unit: "BAG-BAGS", gstRate: 28, hsn: "2523", purchase: { price: 380, taxInclusive: false, expenseType: "Raw Materials" } }),
    item({ id: "5360", type: "goods", name: "Corrugated Box 5 Ply", unit: "NOS-NUMBERS", gstRate: 18, hsn: "4819", sales: { price: 42, taxInclusive: false, description: "5 ply export carton" } }),
    item({ id: "5359", type: "goods", name: "Dell Latitude 5440", unit: "NOS-NUMBERS", gstRate: 18, hsn: "8471", sales: { price: 72000, taxInclusive: false }, purchase: { price: 64500, taxInclusive: false, expenseType: "Purchases" } }),
    item({ id: "5358", type: "services", name: "Freight Charges", unit: "OTH-OTHERS", gstRate: 12, hsn: "996511", purchase: { price: 1, taxInclusive: false, expenseType: "Freight Inward" } }),
    item({ id: "5357", type: "goods", name: "Office Stationery", unit: "NOS-NUMBERS", gstRate: 12, hsn: "4820", purchase: { price: 250, taxInclusive: true, expenseType: "Office Expenses" } }),
    item({ id: "5351", type: "goods", name: "Good Day 50gm", unit: "UNT-UNITS", gstRate: 18, hsn: "1905", purchase: { price: 95, taxInclusive: true }, createdBy: "deepan thirumurthi v", createdAt: "24-08-2026" }),
    item({ id: "5212", type: "services", name: "Mobile App", unit: "UNT-UNITS", gstRate: 18, hsn: "998314", sales: { price: 500000, taxInclusive: false, description: "Social Media App" } }),
    item({ id: "5208", type: "services", name: "Consultancy service - 02", unit: "UNT-UNITS", gstRate: 18, hsn: "998311", sales: { price: 25000, taxInclusive: false, description: "Logo Designing" } }),
    item({ id: "5201", type: "services", name: "Manpower services", unit: "UNT-UNITS", gstRate: 18, hsn: "998519", sales: { price: 20000, taxInclusive: false, description: "Manpower services upto 5 members" } }),
    item({ id: "5190", type: "goods", name: "Tshirt", unit: "PCS-PIECES", gstRate: 5, hsn: "6109", sales: { price: 500, taxInclusive: true, description: "Tshirt" } }),
    item({ id: "5187", type: "goods", name: "Bag pack", unit: "UNT-UNITS", gstRate: 5, hsn: "4202", sales: { price: 100, taxInclusive: true, description: "Testingg" } }),
    item({ id: "5180", type: "goods", name: "water can", unit: "UNT-UNITS", gstRate: 18, hsn: "2201", sales: { price: 1000, taxInclusive: false, description: "Premium arial water" } }),
  ];
}

const OM_TRADERS = "OMTR.OMTR.1122.001@BCB";

/**
 * Saved links from earlier bills: `${supplier B2B ID}|c:${their item code}` or `|n:${normalised name}`
 * → catalog item id. Om Traders' "TMT-10" was linked to Steel Rod 10mm on an earlier bill.
 */
export function makeSeedItemLinks(): Record<string, string> {
  return { [`${OM_TRADERS}|c:TMT-10`]: "5363" };
}

// ---------- Dev panel: purchase scenarios ----------

export interface PurchaseScenario {
  key: string;
  title: string;
  expect: string;
  bill: Invoice;
}

type Line = Omit<InvoiceLineItem, "id">;

function bill(id: string, supplier: string, b2bId: string, gstin: string, lines: Line[], note: string): Invoice {
  const lineItems = lines.map((l, i) => ({ ...l, id: `li-${i + 1}` }));
  const amount = Math.round(lineItems.reduce((s, l) => s + l.price * l.qty * (1 + l.gstPercent / 100), 0) * 100) / 100;
  return {
    id,
    kind: "purchase",
    counterpartyName: supplier,
    counterpartyGstin: gstin,
    counterpartyB2bId: b2bId,
    amount,
    status: "unpaid",
    date: "08-10-2026",
    dueDate: "07-11-2026",
    lineItems,
    bcSendStatus: "sent",
    bcConfirmationStatus: "pending",
    notes: [{ id: `${id}-n1`, kind: "bc", event: `Sent by ${supplier}`, text: note, author: supplier, at: "08-10-2026, 10:15" }],
  };
}

export function makePurchaseScenarios(): PurchaseScenario[] {
  return [
    {
      key: "in-catalog",
      title: "All items already in catalog",
      expect: "Same name and HSN as Purchase items → linked automatically.",
      bill: bill("BILL-3001", "Om Traders", OM_TRADERS, "24AAOPT5566K1Z9", [
        { name: "Steel Rod 10mm", hsnSac: "7214", unit: "KGS", qty: 500, price: 62, gstPercent: 18, itemCode: "SR-10" },
        { name: "Binding Wire 18 Gauge", hsnSac: "7217", unit: "KGS", qty: 40, price: 78, gstPercent: 18 },
      ], "Order of 02-10. Delivered to site."),
    },
    {
      key: "linked-before",
      title: "Different name, linked before",
      expect: "Om Traders' code TMT-10 was linked to Steel Rod 10mm on an earlier bill → linked again.",
      bill: bill("BILL-3002", "Om Traders", OM_TRADERS, "24AAOPT5566K1Z9", [
        { name: "TMT Bar Fe500 10 MM", hsnSac: "7214", unit: "KGS", qty: 750, price: 61.5, gstPercent: 18, itemCode: "TMT-10" },
      ], "Second lot for October."),
    },
    {
      key: "all-new",
      title: "All new items",
      expect: "Nothing matches → each line is added to the catalog on Accept.",
      bill: bill("BILL-3003", "Kaveri Hardware Stores", "KAVE.HARD.4410.001@BCB", "33AAHFK4410R1Z2", [
        { name: "Safety Helmet ISI Marked", hsnSac: "6506", unit: "NOS", qty: 25, price: 240, gstPercent: 18, itemCode: "KH-HLM-01" },
        { name: "Leather Hand Gloves", hsnSac: "4203", unit: "PRS", qty: 50, price: 180, gstPercent: 12, itemCode: "KH-GLV-02" },
        { name: "Measuring Tape 5m", hsnSac: "9017", unit: "NOS", qty: 10, price: 150, gstPercent: 18, itemCode: "KH-TAP-05" },
      ], "Safety kit for the new site team."),
    },
    {
      key: "similar",
      title: "Similar item exists",
      expect: "\"MS Rod 10 MM\" has the same HSN as Steel Rod 10mm but a different name → New, with Steel Rod suggested.",
      bill: bill("BILL-3004", "Bharat Steel Suppliers", "BHAR.STEE.7788.001@BCB", "27AAECB7788N1Z4", [
        { name: "MS Rod 10 MM", hsnSac: "7214", unit: "KGS", qty: 300, price: 60, gstPercent: 18 },
      ], "Rate as discussed on call."),
    },
    {
      key: "sales-only",
      title: "Item set up only for Sales",
      expect: "Corrugated Box 5 Ply exists as a Sales item → linked, and Purchase is turned on for it.",
      bill: bill("BILL-3005", "Shree Packaging", "SHRE.PACK.5521.001@BCB", "27ABJFS5521C1Z8", [
        { name: "Corrugated Box 5 Ply", hsnSac: "4819", unit: "NOS", qty: 1000, price: 28, gstPercent: 18, itemCode: "SP-CB5" },
      ], "Boxes for the November dispatch."),
    },
    {
      key: "missing",
      title: "Missing HSN, GST or unit",
      expect: "HSN and GST rate are optional in the API but required in LEDGERS → fill them before Accept. No unit → UNT-UNITS.",
      bill: bill("BILL-3006", "Anand Electricals", "ANAN.ELEC.3321.001@BCB", "29AAKFA3321H1Z6", [
        { name: "LED Panel Light 18W", unit: "NOS", qty: 40, price: 420, gstPercent: 18 },
        { name: "Copper Wire 1.5 sqmm (90m)", hsnSac: "8544", qty: 12, price: 1450, gstPercent: 18, gstMissing: true },
      ], "Electrical items for floor 2."),
    },
    {
      key: "services",
      title: "Services bill",
      expect: "isService = YES → added as Services items with their SAC code.",
      bill: bill("BILL-3007", "Swift Logistics", "SWIF.LOGI.6655.001@BCB", "27AAPCS6655L1Z1", [
        { name: "Transport Chennai to Pune (32 ft)", hsnSac: "996511", isService: true, qty: 1, price: 48000, gstPercent: 12 },
        { name: "Loading and unloading", hsnSac: "996719", isService: true, qty: 1, price: 3500, gstPercent: 18 },
      ], "Trip on 05-10. POD attached in email."),
    },
    {
      key: "mixed",
      title: "Mixed bill",
      expect: "Two lines match, one is new, one is new and missing its HSN.",
      bill: bill("BILL-3008", "Metro Building Supplies", "METR.BUIL.9090.001@BCB", "33AAGCM9090P1Z5", [
        { name: "Steel Rod 10mm", hsnSac: "7214", unit: "KGS", qty: 200, price: 63, gstPercent: 18 },
        { name: "Cement OPC 53 Grade", hsnSac: "2523", unit: "BAG", qty: 120, price: 375, gstPercent: 28 },
        { name: "PVC Pipe 4 inch (6m)", hsnSac: "3917", unit: "NOS", qty: 30, price: 690, gstPercent: 18, itemCode: "MB-PVC4" },
        { name: "Wall Putty 40kg", unit: "BAG", qty: 20, price: 820, gstPercent: 18 },
      ], "Monthly supply, October."),
    },
  ];
}

// ---------- Dev panel: "Receive a bill" (a supplier sends one from their platform) ----------

export const BC_SUPPLIERS = [
  { name: "Om Traders", b2bId: OM_TRADERS, gstin: "24AAOPT5566K1Z9" },
  { name: "Metro Building Supplies", b2bId: "METR.BUIL.9090.001@BCB", gstin: "33AAGCM9090P1Z5" },
  { name: "Kaveri Hardware Stores", b2bId: "KAVE.HARD.4410.001@BCB", gstin: "33AAHFK4410R1Z2" },
  { name: "Shree Packaging", b2bId: "SHRE.PACK.5521.001@BCB", gstin: "27ABJFS5521C1Z8" },
  { name: "Swift Logistics", b2bId: "SWIF.LOGI.6655.001@BCB", gstin: "27AAPCS6655L1Z1" },
  { name: "Verve Financial Services Private Limited", b2bId: "VERV.FIN.3984.001@BCB", gstin: "33AABCL3984G2ZH" },
];

export type IncomingItems = "catalog" | "new" | "mixed" | "missing";

export const INCOMING_ITEM_OPTIONS: [IncomingItems, string][] = [
  ["catalog", "In catalog"],
  ["new", "New items"],
  ["mixed", "Mixed"],
  ["missing", "Missing HSN"],
];

const NEW_LINES: Line[] = [
  { name: "GI Wire Mesh 4ft", hsnSac: "7314", unit: "MTR", qty: 50, price: 210, gstPercent: 18 },
  { name: "Wooden Pallet 1200x1000", hsnSac: "4415", unit: "NOS", qty: 20, price: 950, gstPercent: 12 },
  { name: "Bubble Wrap Roll 1m", hsnSac: "3920", unit: "NOS", qty: 15, price: 640, gstPercent: 18 },
];

/** A fresh bill from a supplier on Bharat Connect, Awaiting Response. Quantities and rates vary a little each time. */
export function makeIncomingBill(id: string, supplier: (typeof BC_SUPPLIERS)[number], items: IncomingItems, note: string, catalog: CatalogItem[]): Invoice {
  const jitter = (n: number) => Math.max(1, Math.round(n * (0.8 + Math.random() * 0.4)));
  const fromCatalog: Line[] = catalog
    .filter((c) => c.purchase && c.status === "active")
    .slice(0, 2)
    .map((c) => ({ name: c.name, hsnSac: c.hsn, unit: c.unit.split("-")[0], qty: jitter(20), price: c.purchase!.price, gstPercent: c.gstRate }));
  const fresh = NEW_LINES.map((l) => ({ ...l, qty: jitter(l.qty) }));
  const lines: Line[] =
    items === "catalog"
      ? fromCatalog
      : items === "new"
        ? fresh.slice(0, 2)
        : items === "mixed"
          ? [...fromCatalog.slice(0, 1), ...fresh.slice(0, 2)]
          : [{ ...fresh[0], hsnSac: undefined }, { ...fresh[2], gstMissing: true }];
  const b = bill(id, supplier.name, supplier.b2bId, supplier.gstin, lines, note.trim() || "Please find the bill attached.");
  // Received just now: today's date, due in 30 days.
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const ddmmyyyy = (d: Date) => `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
  const due = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    ...b,
    date: ddmmyyyy(now),
    dueDate: ddmmyyyy(due),
    notes: (b.notes ?? []).map((n) => ({ ...n, at: `${ddmmyyyy(now)}, ${p(now.getHours())}:${p(now.getMinutes())}` })),
  };
}
