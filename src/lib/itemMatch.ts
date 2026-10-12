import type { CatalogItem, InvoiceLineItem } from "../types";

/**
 * Links a line on a bill received over Bharat Connect to a LEDGERS catalog item. The supplier never
 * sends our catalog id, so:
 *  1. A link saved from an earlier bill (supplier + their item code, or their name when there's no code).
 *  2. Same HSN and the same name (ignoring case, spaces and punctuation): Purchase items first.
 *  3. Otherwise it's a new item; items with the same HSN are offered as suggestions.
 */
export type LineMatch =
  | { kind: "linked"; item: CatalogItem }
  | { kind: "match"; item: CatalogItem }
  | { kind: "new"; similar: CatalogItem[] };

export const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function linkKey(supplierB2bId: string, line: InvoiceLineItem): string {
  return `${supplierB2bId}|${line.itemCode ? `c:${line.itemCode}` : `n:${normName(line.name)}`}`;
}

export function matchLine(
  line: InvoiceLineItem,
  supplierB2bId: string,
  catalog: CatalogItem[],
  links: Record<string, string>,
): LineMatch {
  const active = catalog.filter((c) => c.status === "active");
  const saved = active.find((c) => c.id === links[linkKey(supplierB2bId, line)]);
  if (saved) return { kind: "linked", item: saved };

  if (line.hsnSac) {
    const exact = active
      .filter((c) => c.hsn === line.hsnSac && normName(c.name) === normName(line.name))
      .sort((a, b) => Number(!!b.purchase) - Number(!!a.purchase));
    if (exact[0]) return { kind: "match", item: exact[0] };
  }
  const similar = line.hsnSac ? active.filter((c) => c.hsn === line.hsnSac).slice(0, 3) : [];
  return { kind: "new", similar };
}

/** What the user decided for one line in the Accept form. */
export interface LineResolution {
  lineId: string;
  /** Book against this existing item… */
  catalogId?: string;
  /** …or add a new one with these details (HSN / GST / unit filled in where the bill left them out). */
  create?: { hsn: string; gstRate: number; unit: string };
}
