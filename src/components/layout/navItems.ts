import {
  ArrowLeftRight,
  Banknote,
  BookOpen,
  BookText,
  Calculator,
  CalendarCheck,
  Coins,
  ContactRound,
  CreditCard,
  DatabaseZap,
  FileChartColumnIncreasing,
  FileCheck,
  FileSpreadsheet,
  FileText,
  GalleryVerticalEnd,
  HandCoins,
  House,
  Landmark,
  LayoutDashboard,
  LayoutPanelLeft,
  Layers,
  Package,
  Percent,
  Receipt,
  Scale,
  ScrollText,
  Settings,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Truck,
  Upload,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * The LEDGERS left menu, mirrored from live LEDGERS (in.ledgers.cloud/v4): same sections, pages, order and icons.
 * Pages this prototype builds keep their routes (and labels: "Bills" stays "Bills"); the rest go to
 * /soon/…, a placeholder page, so every item is clickable. `create` is the row's + (quick create) link.
 */
export interface NavPage {
  label: string;
  icon: LucideIcon;
  to: string;
  end?: boolean;
  create?: string;
}

export interface NavSection {
  label: string;
  icon: LucideIcon;
  /** A page on its own (no sub-pages). */
  to?: string;
  end?: boolean;
  /** Paths under this prefix belong to the section (keeps it open and highlighted). */
  prefix?: string;
  pages?: NavPage[];
}

const soon = (path: string) => `/soon/${path}`;

export const NAV: NavSection[] = [
  { label: "Dashboard", icon: House, to: "/", end: true },
  { label: "Contacts", icon: ContactRound, to: "/contacts" },
  { label: "Catalog", icon: GalleryVerticalEnd, to: "/catalog" },
  { label: "Inventory", icon: Package, to: soon("inventory") },
  {
    label: "Sales",
    icon: TrendingUp,
    prefix: "/sales",
    pages: [
      { label: "Invoices", icon: FileText, to: "/sales/invoices", create: "/sales/invoices/create" },
      { label: "Quotes", icon: Receipt, to: soon("sales/quotes"), create: soon("sales/quotes/create") },
      { label: "Receipts", icon: Wallet, to: soon("sales/receipts"), create: soon("sales/receipts/create") },
      { label: "Credit Notes", icon: CreditCard, to: soon("sales/credit-notes"), create: soon("sales/credit-notes/create") },
      { label: "Delivery Challans", icon: Truck, to: soon("sales/delivery-challans"), create: soon("sales/delivery-challans/create") },
      { label: "Receivables", icon: HandCoins, to: soon("sales/receivables") },
      { label: "Payment Collection", icon: Banknote, to: soon("sales/payment-collection") },
    ],
  },
  {
    label: "Expenses",
    icon: ShoppingBag,
    prefix: "/expenses",
    pages: [
      { label: "Bills", icon: FileText, to: "/expenses/bills", create: "/expenses/bills/create" },
      { label: "Purchase Orders", icon: ShoppingCart, to: soon("expenses/purchase-orders"), create: soon("expenses/purchase-orders/create") },
      { label: "Payment Voucher", icon: Wallet, to: soon("expenses/payment-vouchers"), create: soon("expenses/payment-vouchers/create") },
      { label: "Expense Vouchers", icon: Receipt, to: "/expenses/vouchers" },
      { label: "Debit Note", icon: CreditCard, to: soon("expenses/debit-notes"), create: soon("expenses/debit-notes/create") },
      { label: "Payables", icon: HandCoins, to: soon("expenses/payables") },
    ],
  },
  {
    label: "Accounting",
    icon: BookOpen,
    prefix: soon("accounting"),
    pages: [
      { label: "Chart of Accounts", icon: Calculator, to: soon("accounting/chart-of-accounts") },
      { label: "Journal Entries", icon: BookText, to: soon("accounting/journals") },
      { label: "Financial Statements", icon: FileSpreadsheet, to: soon("accounting/financial-statements") },
    ],
  },
  {
    label: "Taxation",
    icon: Percent,
    prefix: soon("taxation"),
    pages: [
      { label: "GST Filing", icon: FileCheck, to: soon("taxation/gst-filing") },
      { label: "e-Way Bill", icon: Receipt, to: soon("taxation/e-way-bill") },
      { label: "e-Invoice", icon: ScrollText, to: soon("taxation/e-invoice") },
      { label: "GST ITC & IMS", icon: Scale, to: soon("taxation/itc-ims") },
      { label: "GST Reports", icon: FileChartColumnIncreasing, to: soon("taxation/gst-reports") },
      { label: "TDS", icon: Coins, to: soon("taxation/tds") },
    ],
  },
  { label: "Banking", icon: Landmark, to: "/banking" },
  {
    label: "HRMS",
    icon: Layers,
    prefix: "/hrms",
    pages: [
      { label: "Employees", icon: Users, to: "/hrms/employees" },
      { label: "Payroll", icon: LayoutDashboard, to: "/hrms/payroll", end: true },
      { label: "Attendance", icon: CalendarCheck, to: "/hrms/attendance" },
      // Built in this prototype (HRMS replica), not in the live menu yet.
      { label: "Salary Payment", icon: Banknote, to: "/hrms/payroll/salary-payment" },
      { label: "Payroll Reports", icon: FileChartColumnIncreasing, to: "/hrms/reports/monthly-pay" },
    ],
  },
  { label: "Users & Roles", icon: Users, to: soon("users-roles") },
  {
    label: "Dataport",
    icon: DatabaseZap,
    prefix: soon("dataport"),
    pages: [
      { label: "Import", icon: Upload, to: soon("dataport/import") },
      { label: "Export", icon: FileChartColumnIncreasing, to: soon("dataport/export") },
    ],
  },
  {
    label: "Settings",
    icon: Settings2,
    prefix: "/settings",
    pages: [
      { label: "Basic Settings", icon: Settings, to: soon("settings/basic") },
      { label: "Advanced Settings", icon: Settings2, to: "/settings/advanced" },
      { label: "Customization", icon: LayoutPanelLeft, to: soon("settings/customization") },
      { label: "PG Settings", icon: CreditCard, to: soon("settings/pg") },
      { label: "Bharat Connect", icon: ArrowLeftRight, to: "/settings/bharatconnect" },
    ],
  },
];

export const BHARAT_CONNECT_PATH = "/settings/bharatconnect";

/** The section a path belongs to (Sales for /sales/invoices/12, Accounting for /soon/accounting/journals, …). */
export function sectionFor(path: string) {
  return NAV.find((s) => s.prefix && (path === s.prefix || path.startsWith(s.prefix + "/")))?.label ?? null;
}

/** The menu name for a placeholder path, e.g. "Journal Entries", or "New quote" for a + link. */
export function soonTitle(path: string) {
  for (const s of NAV) {
    if (s.to === path) return s.label;
    for (const p of s.pages ?? []) {
      if (p.to === path) return p.label;
      if (p.create === path) return `New ${p.label.replace(/s$/, "").toLowerCase()}`;
    }
  }
  return "This page";
}
