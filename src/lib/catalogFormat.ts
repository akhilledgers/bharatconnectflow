import type { CatalogItem } from "../types";

/** "₹500.00 Inclusive of GST", as LEDGERS' catalog list shows the price. */
export function priceLabel(item: CatalogItem, mode: "all" | "sales" | "purchase" = "all"): string {
  const side = mode === "purchase" ? item.purchase : mode === "sales" ? item.sales : (item.sales ?? item.purchase);
  if (!side) return "-";
  const amount = side.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `₹${amount} ${side.taxInclusive ? "Inclusive" : "Exclusive"} of GST`;
}
