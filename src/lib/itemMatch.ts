import type { CatalogItem, InvoiceLineItem } from "../types";

/**
 * Links a line on a bill received over Bharat Connect to a LEDGERS catalog item. The supplier never
 * sends our catalog id, so:
 *  1. A link saved from an earlier bill (supplier + their item code, or their name when there's no code).
 *  2. Same HSN and the same name (ignoring case, spaces and punctuation): Purchase items first.
 *  3. A likely match: the most similar name among items with the same HSN (or a close name when no HSN was
 *     sent). It's preselected, but the user confirms it.
 *  4. Otherwise nothing is chosen: the user picks from the catalog, or adds it as a new item.
 */
export type LineMatch =
  | { kind: "linked"; item: CatalogItem }
  | { kind: "match"; item: CatalogItem }
  | { kind: "suggest"; item: CatalogItem }
  | { kind: "none" };

export const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Words and numbers in a name: "MS Rod 10MM" → ms, rod, 10, mm. */
const tokens = (s: string) => new Set(s.toLowerCase().match(/[a-z]+|\d+/g) ?? []);

/** Share of words two names have in common (0–1). */
export function nameScore(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  const common = [...ta].filter((t) => tb.has(t)).length;
  return common / (new Set([...ta, ...tb]).size || 1);
}

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
  const best = active
    .filter((c) => (line.hsnSac ? c.hsn === line.hsnSac : true))
    .map((c) => ({ c, score: nameScore(c.name, line.name) + (c.purchase ? 0.01 : 0) }))
    .sort((a, b) => b.score - a.score)[0];
  // Same HSN: any shared word is enough to suggest it. No HSN: the name has to be close.
  if (best && best.score >= (line.hsnSac ? 0.15 : 0.5)) return { kind: "suggest", item: best.c };
  return { kind: "none" };
}

/** Catalog items worth offering for a line: same HSN first, then by how close the name is. */
export function rankCatalog(line: InvoiceLineItem, catalog: CatalogItem[], query: string): CatalogItem[] {
  const q = query.trim().toLowerCase();
  return catalog
    .filter((c) => c.status === "active")
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.hsn.includes(q))
    .map((c) => ({ c, score: (line.hsnSac && c.hsn === line.hsnSac ? 1 : 0) + nameScore(c.name, line.name) }))
    .filter(({ score }) => q || score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .map(({ c }) => c);
}

/** What the user decided for one line in the Accept form. */
export interface LineResolution {
  lineId: string;
  /** Book against this existing item… */
  catalogId?: string;
  /** …or add a new one with these details (HSN / GST / unit filled in where the bill left them out). */
  create?: { name?: string; hsn: string; gstRate: number; unit: string };
  /** Train the matching: remember this line → item for the supplier's future bills (default true). */
  remember?: boolean;
}
